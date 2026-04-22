"""WebSocket endpoints for real-time Gemini Live voice sessions.

Architecture:
  Browser  ←──WebSocket──→  IVAS backend  ←──Gemini Live WS──→  Google

  The browser continuously streams PCM16 audio from the mic.
  Gemini's built-in VAD detects silence and auto-responds with audio.
  Two async tasks run concurrently for the life of the session:
    1. client → Gemini  (forward mic audio)
    2. Gemini → client  (forward response audio)
  The session ends only when the client disconnects or sends "end_session".
"""

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


# =============================================================================
# Core Gemini Live bridge
# =============================================================================


async def _bridge_gemini_live(websocket: WebSocket, settings) -> None:
    """Bridge a browser WebSocket to a Gemini Live session.

    The browser sends:  {"type": "audio", "data": "<base64 PCM16 16kHz>"}
                        {"type": "end_session"}
    The backend sends:  {"type": "session_started"}
                        {"type": "audio", "data": "<base64 PCM16 24kHz>"}
                        {"type": "turn_complete"}
                        {"type": "session_ended"}
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.LiveConnectConfig(response_modalities=["AUDIO"])

    logger.info("gemini_connecting", model=settings.gemini_live_model)

    async with client.aio.live.connect(
        model=settings.gemini_live_model,
        config=config,
    ) as live:
        logger.info("gemini_connected")
        await websocket.send_json({"type": "session_started"})

        end = asyncio.Event()

        # ── Task 1: Browser mic → Gemini ────────────────────────────────
        async def forward_audio_to_gemini() -> None:
            try:
                while not end.is_set():
                    try:
                        raw = await asyncio.wait_for(
                            websocket.receive_text(),
                            timeout=300,
                        )
                    except asyncio.TimeoutError:
                        continue
                    except WebSocketDisconnect:
                        break

                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    if msg.get("type") == "audio" and msg.get("data"):
                        audio = base64.b64decode(msg["data"])
                        await live.send_realtime_input(
                            audio=types.Blob(
                                data=audio,
                                mime_type="audio/pcm;rate=16000",
                            ),
                        )
                    elif msg.get("type") == "end_session":
                        break

            except WebSocketDisconnect:
                pass
            except Exception as exc:
                logger.error("fwd_to_gemini_err", error=str(exc))
            finally:
                end.set()

        # ── Task 2: Gemini → Browser speaker ────────────────────────────
        async def forward_audio_to_browser() -> None:
            try:
                # live.receive() yields messages until the underlying WS
                # closes. After each turn_complete the iterator may exhaust,
                # so we re-enter it in a while-loop.
                while not end.is_set():
                    async for msg in live.receive():
                        if end.is_set():
                            return

                        sc = msg.server_content
                        if not sc:
                            continue

                        # Audio / text chunks from Gemini
                        if sc.model_turn and sc.model_turn.parts:
                            for part in sc.model_turn.parts:
                                if part.inline_data and part.inline_data.data:
                                    b64 = base64.b64encode(
                                        part.inline_data.data,
                                    ).decode()
                                    await websocket.send_json(
                                        {
                                            "type": "audio",
                                            "data": b64,
                                        }
                                    )

                        # Gemini finished this response turn
                        if getattr(sc, "turn_complete", False):
                            await websocket.send_json({"type": "turn_complete"})

                        # Gemini was interrupted by user speech — just ack
                        if getattr(sc, "interrupted", False):
                            await websocket.send_json({"type": "turn_complete"})

            except Exception as exc:
                logger.error("fwd_to_browser_err", error=str(exc))
            finally:
                end.set()

        # Run both tasks; when either finishes, cancel the other.
        t1 = asyncio.create_task(forward_audio_to_gemini())
        t2 = asyncio.create_task(forward_audio_to_browser())

        await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)

        for t in (t1, t2):
            if not t.done():
                t.cancel()
                with suppress(asyncio.CancelledError):
                    await t


# =============================================================================
# Endpoints
# =============================================================================


@router.websocket("/ws/ivas/viva")
async def gemini_voice_chat(websocket: WebSocket) -> None:
    """Standalone Gemini voice chat — no DB, no session."""
    await websocket.accept()
    logger.info("ws_accepted")
    try:
        await _bridge_gemini_live(websocket, get_settings())
    except Exception as exc:
        logger.error("ws_error", error=str(exc))
        with suppress(Exception):
            await websocket.send_json({"type": "error", "data": str(exc)})
    finally:
        with suppress(Exception):
            await websocket.send_json({"type": "session_ended"})
        with suppress(Exception):
            await websocket.close()
        logger.info("ws_closed")


@router.websocket("/ws/ivas/session/{session_id}")
async def session_viva(websocket: WebSocket, session_id: str) -> None:
    """Session-backed viva — loads assignment context from DB."""
    await websocket.accept()
    logger.info("session_ws_accepted", session_id=session_id)

    from app.main import postgres_client as db

    if db is None:
        await websocket.send_json({"type": "error", "data": "Service not ready."})
        await websocket.close()
        return

    try:
        sid = UUID(session_id)
    except ValueError:
        await websocket.send_json({"type": "error", "data": "Invalid session ID."})
        await websocket.close()
        return

    session = await db.get_session(sid)
    if not session:
        await websocket.send_json({"type": "error", "data": "Session not found."})
        await websocket.close()
        return

    await db.update_session_status(sid, "in_progress")

    try:
        await _bridge_gemini_live(websocket, get_settings())
    except Exception as exc:
        logger.error("session_ws_error", error=str(exc))
        with suppress(Exception):
            await websocket.send_json({"type": "error", "data": str(exc)})
    finally:
        await db.update_session_status(sid, "completed")
        with suppress(Exception):
            await websocket.send_json({"type": "session_ended"})
        with suppress(Exception):
            await websocket.close()
        logger.info("session_ws_closed", session_id=session_id)
