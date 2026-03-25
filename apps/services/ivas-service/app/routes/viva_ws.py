"""WebSocket endpoint for live viva sessions.

Protocol (JSON messages over WebSocket):

Browser → Server:
    {"type": "audio", "data": "<base64 PCM 16kHz>"}
    {"type": "end_viva"}
    {"type": "ping"}

Server → Browser:
    {"type": "audio", "data": "<base64 PCM 24kHz>", "mime_type": "audio/pcm;rate=24000"}
    {"type": "text", "data": "transcribed text"}
    {"type": "turn_complete"}
    {"type": "session_started", "session_id": "..."}
    {"type": "session_ended", "status": "completed"}
    {"type": "error", "data": "error message"}
    {"type": "pong"}
"""

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.logging_config import get_logger
from app.services.viva.session_manager import get_active_session

logger = get_logger(__name__)

router = APIRouter()


@router.websocket("/ws/ivas/session/{session_id}")
async def viva_websocket(websocket: WebSocket, session_id: UUID) -> None:
    """Full viva lifecycle over WebSocket.

    The session must be created via POST /sessions first (which returns
    a session_id). Then the client connects here to start streaming audio.
    """
    await websocket.accept()

    session = get_active_session(session_id)
    if not session:
        await websocket.send_json({
            "type": "error",
            "data": "Session not found. Create a session first via POST /api/v1/ivas/sessions.",
        })
        await websocket.close(code=4004)
        return

    # Start the Gemini connection and begin the viva
    try:
        await session.start()
    except Exception as e:
        logger.error("session_start_failed", session_id=str(session_id), error=str(e))
        await websocket.send_json({"type": "error", "data": f"Failed to start viva: {e}"})
        await session.abandon()
        await websocket.close(code=4500)
        return

    await websocket.send_json({
        "type": "session_started",
        "session_id": str(session_id),
    })

    # Run send and receive loops concurrently
    receive_from_gemini_task = asyncio.create_task(
        _forward_gemini_to_browser(session, websocket)
    )
    send_to_gemini_task = asyncio.create_task(
        _forward_browser_to_gemini(session, websocket)
    )

    try:
        # Wait for either task to finish (disconnect or completion)
        done, pending = await asyncio.wait(
            [receive_from_gemini_task, send_to_gemini_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        # Cancel the other task
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Check for errors in completed tasks
        for task in done:
            if task.exception():
                logger.error(
                    "viva_task_error",
                    session_id=str(session_id),
                    error=str(task.exception()),
                )

    except Exception as e:
        logger.error("viva_ws_error", session_id=str(session_id), error=str(e))
    finally:
        # Persist session state
        db = _get_db()
        if db:
            if session.status == "completed":
                await db.update_session_status(session_id, "completed")
            elif session.status != "abandoned":
                await session.abandon()
                await db.update_session_status(session_id, "abandoned")

        try:
            await websocket.send_json({
                "type": "session_ended",
                "status": session.status,
            })
        except Exception:
            pass

        logger.info("viva_ws_closed", session_id=str(session_id), status=session.status)


async def _forward_browser_to_gemini(session, websocket: WebSocket) -> None:
    """Read messages from browser WebSocket and forward audio to Gemini."""
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "audio":
                await session.send_audio(msg["data"])

            elif msg_type == "end_viva":
                await session.end_viva()
                # Wait for Gemini to finish its closing statement
                await asyncio.sleep(5)
                await session.complete()
                return

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info("browser_disconnected", session_id=str(session.session_id))
        await session.abandon()
    except json.JSONDecodeError as e:
        logger.warning("invalid_ws_message", error=str(e))
    except Exception as e:
        logger.error("browser_to_gemini_error", error=str(e))
        await session.abandon()


async def _forward_gemini_to_browser(session, websocket: WebSocket) -> None:
    """Read responses from Gemini and forward to browser WebSocket."""
    try:
        async for response in session.receive_responses():
            await websocket.send_json(response)

            if response.get("type") == "error":
                await session.abandon()
                return

    except WebSocketDisconnect:
        logger.info("browser_disconnected_during_receive", session_id=str(session.session_id))
        await session.abandon()
    except Exception as e:
        logger.error("gemini_to_browser_error", error=str(e))
        await session.abandon()


def _get_db():
    """Get postgres client."""
    from app.main import postgres_client
    return postgres_client
