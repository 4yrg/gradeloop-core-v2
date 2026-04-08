"""WebSocket endpoint for real-time viva sessions via Gemini Live API."""

import asyncio
import base64
import json
import traceback
from contextlib import suppress
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


def _get_db():
    from app.main import postgres_client
    return postgres_client


def _build_system_prompt(assignment: dict, questions: list[dict]) -> str:
    parts = [
        "You are an AI viva examiner conducting an oral examination.",
        f"\nAssignment: {assignment['title']}",
    ]
    if assignment.get("description"):
        parts.append(f"Description: {assignment['description']}")
    if assignment.get("programming_language"):
        parts.append(f"Language: {assignment['programming_language']}")
    if assignment.get("code_context"):
        parts.append(f"\nCode context:\n{assignment['code_context']}")
    if questions:
        parts.append("\nQuestions to cover during the viva:")
        for i, q in enumerate(questions, 1):
            parts.append(f"{i}. {q['question_text']}")
    else:
        parts.append(
            "\nNo preset questions — conduct a general viva covering key concepts "
            "of the assignment."
        )
    parts.append(
        "\nInstructions:"
        "\n- Greet the student warmly and briefly explain the viva process."
        "\n- Ask one question at a time; wait for the student's response."
        "\n- Ask short follow-up questions to probe understanding."
        "\n- Be encouraging but academically rigorous."
        "\n- When all questions are covered, thank the student and close the session."
        "\n- Keep responses concise and conversational — this is a spoken exam."
    )
    return "\n".join(parts)


async def _run_live_session(websocket: WebSocket, settings, system_instruction: str | None = None):
    """Core bidirectional audio loop shared by both endpoints."""
    from google import genai
    from google.genai import types

    gemini_client = genai.Client(api_key=settings.gemini_api_key)

    live_config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
    )

    logger.info("gemini_connecting", model=settings.gemini_live_model)

    async with gemini_client.aio.live.connect(
        model=settings.gemini_live_model, config=live_config
    ) as live:
        logger.info("gemini_connected")
        await websocket.send_json({"type": "session_started"})

        end_event = asyncio.Event()
        stats = {"audio_sent": 0, "audio_recv": 0}

        async def client_to_gemini() -> None:
            """Read from browser WebSocket, forward audio to Gemini."""
            try:
                while not end_event.is_set():
                    try:
                        raw = await asyncio.wait_for(websocket.receive_text(), timeout=120.0)
                    except asyncio.TimeoutError:
                        logger.debug("client_recv_timeout")
                        continue
                    except WebSocketDisconnect:
                        logger.info("client_ws_disconnected")
                        break

                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    msg_type = msg.get("type")

                    if msg_type == "audio" and msg.get("data"):
                        try:
                            audio_bytes = base64.b64decode(msg["data"])
                            await live.send_realtime_input(
                                audio=types.Blob(
                                    data=audio_bytes,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                            stats["audio_sent"] += 1
                            if stats["audio_sent"] % 100 == 0:
                                logger.info("audio_sent", total=stats["audio_sent"])
                        except Exception as e:
                            logger.error("send_audio_failed", error=str(e))

                    elif msg_type == "mic_stop":
                        # User released mic — tell Gemini the audio stream ended
                        # so VAD knows the user is done speaking
                        logger.info("mic_stop_received")
                        try:
                            await live.send_realtime_input(audio_stream_end=True)
                        except Exception as e:
                            logger.warning("audio_stream_end_failed", error=str(e))

                    elif msg_type == "end_viva":
                        logger.info("end_viva_requested")
                        break

                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

            except WebSocketDisconnect:
                logger.info("client_disconnected")
            except Exception as e:
                logger.error("client_to_gemini_error", error=str(e), tb=traceback.format_exc())
            finally:
                logger.info("client_to_gemini_done", audio_sent=stats["audio_sent"])
                end_event.set()

        async def gemini_to_client() -> None:
            """Read from Gemini live session, forward audio/text to browser."""
            try:
                # live.receive() returns an async iterator that may exhaust
                # after one turn. We call it in a loop so we keep listening
                # across multiple conversation turns.
                while not end_event.is_set():
                    try:
                        async for msg in live.receive():
                            if end_event.is_set():
                                return

                            sc = msg.server_content
                            if not sc:
                                logger.debug("non_content_msg", type=type(msg).__name__)
                                continue

                            if getattr(sc, "interrupted", False):
                                logger.info("gemini_interrupted")
                                await websocket.send_json({"type": "turn_complete"})

                            if sc.model_turn and sc.model_turn.parts:
                                for part in sc.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        b64 = base64.b64encode(part.inline_data.data).decode()
                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": b64,
                                        })
                                        stats["audio_recv"] += 1
                                        if stats["audio_recv"] % 20 == 0:
                                            logger.info("audio_recv", total=stats["audio_recv"])
                                    if part.text:
                                        logger.info("gemini_text_internal", text=part.text[:200])

                            if getattr(sc, "turn_complete", False):
                                logger.info("turn_complete", audio_recv=stats["audio_recv"])
                                await websocket.send_json({"type": "turn_complete"})

                    except StopAsyncIteration:
                        # Iterator exhausted for this turn — loop back to
                        # call receive() again for the next turn
                        logger.info("receive_iterator_exhausted_restarting")
                        continue

            except Exception as exc:
                logger.error("gemini_to_client_error", error=str(exc), tb=traceback.format_exc())
            finally:
                logger.info("gemini_to_client_done", audio_recv=stats["audio_recv"])
                end_event.set()

        # Run both loops concurrently. When one exits (client disconnect
        # or unrecoverable Gemini error), cancel the other.
        client_task = asyncio.create_task(client_to_gemini())
        gemini_task = asyncio.create_task(gemini_to_client())

        done, pending = await asyncio.wait(
            [client_task, gemini_task], return_when=asyncio.FIRST_COMPLETED
        )
        logger.info("tasks_finished", done=len(done), pending=len(pending))

        for task in pending:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


# =============================================================================
# Standalone Gemini voice chat (no DB, no session)
# =============================================================================

@router.websocket("/ws/ivas/viva")
async def simple_viva_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("simple_viva_ws_accepted")

    settings = get_settings()
    logger.info("config", model=settings.gemini_live_model, key_len=len(settings.gemini_api_key))

    try:
        await _run_live_session(
            websocket,
            settings,
            system_instruction=(
                "You are a friendly, intelligent AI assistant. "
                "The user is talking to you via voice in real time. "
                "Keep your responses natural, concise, and conversational. "
                "Greet the user when the session starts."
            ),
        )
    except Exception as exc:
        logger.error("simple_ws_error", error=str(exc), tb=traceback.format_exc())
        with suppress(Exception):
            await websocket.send_json({"type": "error", "data": str(exc)})
    finally:
        with suppress(Exception):
            await websocket.send_json({"type": "session_ended", "status": "completed"})
        with suppress(Exception):
            await websocket.close()
        logger.info("simple_viva_ws_closed")


# =============================================================================
# Session-based viva (with DB)
# =============================================================================

@router.websocket("/ws/ivas/session/{session_id}")
async def viva_websocket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    logger.info("session_viva_ws_accepted", session_id=session_id)

    db = _get_db()
    if db is None:
        await websocket.send_json({"type": "error", "data": "Service not ready."})
        await websocket.close()
        return

    try:
        session_uuid = UUID(session_id)
    except ValueError:
        await websocket.send_json({"type": "error", "data": "Invalid session ID."})
        await websocket.close()
        return

    session = await db.get_session(session_uuid)
    if not session:
        await websocket.send_json({"type": "error", "data": "Session not found."})
        await websocket.close()
        return

    assignment = await db.get_assignment(session["assignment_id"])
    if not assignment:
        await websocket.send_json({"type": "error", "data": "Assignment not found."})
        await websocket.close()
        return

    questions = await db.list_questions(session["assignment_id"], status_filter="approved")
    system_prompt = _build_system_prompt(assignment, questions)

    await db.update_session_status(session_uuid, "in_progress")
    settings = get_settings()

    try:
        await _run_live_session(websocket, settings, system_instruction=system_prompt)
    except Exception as exc:
        logger.error("session_ws_error", session_id=session_id, error=str(exc))
        with suppress(Exception):
            await websocket.send_json({"type": "error", "data": str(exc)})
    finally:
        await db.update_session_status(session_uuid, "completed")
        with suppress(Exception):
            await websocket.send_json({"type": "session_ended", "status": "completed"})
        with suppress(Exception):
            await websocket.close()
        logger.info("session_viva_ws_closed", session_id=session_id)
