"""WebSocket endpoint for real-time viva sessions via Gemini Live API."""

import asyncio
import base64
import json
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


@router.websocket("/ws/ivas/session/{session_id}")
async def viva_websocket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    logger.info("viva_ws_connected", session_id=session_id)

    db = _get_db()
    if db is None:
        await websocket.send_json({"type": "error", "data": "Service not ready."})
        await websocket.close()
        return

    # Validate session_id
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        await websocket.send_json({"type": "error", "data": "Invalid session ID."})
        await websocket.close()
        return

    # Load session
    session = await db.get_session(session_uuid)
    if not session:
        await websocket.send_json({"type": "error", "data": "Session not found."})
        await websocket.close()
        return

    # Load assignment + questions
    assignment = await db.get_assignment(session["assignment_id"])
    if not assignment:
        await websocket.send_json({"type": "error", "data": "Assignment not found."})
        await websocket.close()
        return

    questions = await db.list_questions(session["assignment_id"], status_filter="approved")
    system_prompt = _build_system_prompt(assignment, questions)

    # Mark session as in_progress
    await db.update_session_status(session_uuid, "in_progress")

    settings = get_settings()

    try:
        from google import genai

        gemini_client = genai.Client(api_key=settings.gemini_api_key)

        live_config = {
            "response_modalities": ["AUDIO", "TEXT"],
            "system_instruction": system_prompt,
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": "Aoede"}
                }
            },
        }

        async with gemini_client.aio.live.connect(
            model=settings.gemini_live_model, config=live_config
        ) as live:
            await websocket.send_json({"type": "session_started", "session_id": session_id})
            logger.info("viva_gemini_connected", session_id=session_id)

            end_event = asyncio.Event()

            async def client_to_gemini() -> None:
                """Forward audio from WebSocket client to Gemini."""
                from google.genai import types

                try:
                    while not end_event.is_set():
                        try:
                            raw = await asyncio.wait_for(
                                websocket.receive_text(), timeout=60.0
                            )
                        except asyncio.TimeoutError:
                            continue
                        except WebSocketDisconnect:
                            break

                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        msg_type = msg.get("type")
                        if msg_type == "audio" and msg.get("data"):
                            audio_bytes = base64.b64decode(msg["data"])
                            await live.send_realtime_input(
                                audio=types.Blob(
                                    data=audio_bytes,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                        elif msg_type == "end_viva":
                            break
                        elif msg_type == "ping":
                            await websocket.send_json({"type": "pong"})
                except WebSocketDisconnect:
                    pass
                finally:
                    end_event.set()

            async def gemini_to_client() -> None:
                """Forward Gemini responses to WebSocket client."""
                try:
                    async for msg in live.receive():
                        if end_event.is_set():
                            break
                        sc = msg.server_content
                        if not sc:
                            continue
                        if sc.model_turn:
                            for part in sc.model_turn.parts or []:
                                if part.inline_data and part.inline_data.data:
                                    b64 = base64.b64encode(part.inline_data.data).decode()
                                    await websocket.send_json({"type": "audio", "data": b64})
                                if part.text:
                                    await websocket.send_json(
                                        {"type": "text", "data": part.text}
                                    )
                        if sc.turn_complete:
                            await websocket.send_json({"type": "turn_complete"})
                except Exception as exc:
                    logger.warning("viva_gemini_recv_error", error=str(exc))
                finally:
                    end_event.set()

            client_task = asyncio.create_task(client_to_gemini())
            gemini_task = asyncio.create_task(gemini_to_client())

            _done, pending = await asyncio.wait(
                [client_task, gemini_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    except Exception as exc:
        logger.error("viva_ws_error", session_id=session_id, error=str(exc))
        with suppress(Exception):
            await websocket.send_json({"type": "error", "data": str(exc)})
    finally:
        await db.update_session_status(session_uuid, "completed")
        with suppress(Exception):
            await websocket.send_json({"type": "session_ended", "status": "completed"})
        with suppress(Exception):
            await websocket.close()
        logger.info("viva_ws_closed", session_id=session_id)
