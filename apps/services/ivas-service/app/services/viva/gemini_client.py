"""Gemini Live API client using google-genai SDK.

Uses the free-tier Gemini Live API for real-time bidirectional audio
streaming. The backend is the sole Gemini client — the browser never
talks to Gemini directly.

Audio format: Raw 16-bit PCM at 16kHz (little-endian), base64-encoded.
"""

import asyncio
import base64
from typing import AsyncGenerator

from google import genai
from google.genai import types

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)


def _build_system_prompt(
    assignment_title: str,
    code_context: str | None,
    programming_language: str,
    questions: list[dict],
    criteria: list[dict],
) -> str:
    """Build the system instruction for the viva examiner.

    Includes assignment context, student code, rubric, and programming
    vocabulary so Gemini can accurately discuss technical concepts.
    """
    parts = [
        "You are an AI viva examiner conducting an oral examination.",
        "Your role is to assess the student's understanding of their code submission "
        "through a structured voice conversation.",
        "",
        "## Rules",
        "- Ask ONE question at a time, wait for the student's answer.",
        "- Adapt difficulty: follow up on weak answers, go harder on strong ones.",
        "- If an answer is unclear, ask for clarification before moving on.",
        "- Be encouraging but rigorous — this is an assessment, not a tutorial.",
        "- Keep responses concise and conversational (this is voice, not text).",
        "- After each answer, internally score it (0-10) and note misconceptions.",
        "- When all questions are covered or time is up, wrap up politely.",
        "",
        f"## Assignment: {assignment_title}",
        f"## Programming Language: {programming_language}",
    ]

    if code_context:
        parts.extend([
            "",
            "## Student's Code",
            "```",
            code_context,
            "```",
        ])

    if criteria:
        parts.extend(["", "## Grading Criteria"])
        for c in criteria:
            parts.append(
                f"- {c['competency']} (max {c.get('max_score', 10)} pts, "
                f"weight {c.get('weight', 1.0)}, difficulty {c.get('difficulty', 3)}/5)"
            )
            if c.get("description"):
                parts.append(f"  {c['description']}")

    if questions:
        parts.extend(["", "## Question Bank (use as guide, adapt as needed)"])
        for i, q in enumerate(questions, 1):
            parts.append(f"{i}. [{q.get('competency', 'general')}] {q['question_text']}")
            if q.get("expected_topics"):
                parts.append(f"   Expected topics: {', '.join(q['expected_topics'])}")

    parts.extend([
        "",
        "## Technical Vocabulary",
        "Use correct programming terminology. Common terms for this language:",
        _get_vocab(programming_language),
    ])

    return "\n".join(parts)


def _get_vocab(language: str) -> str:
    """Get programming vocabulary for the language."""
    vocabs = {
        "python": (
            "def, class, self, __init__, decorator, generator, yield, list comprehension, "
            "dictionary, tuple, lambda, try/except, import, module, package, pip, "
            "virtualenv, async/await, coroutine, GIL, type hint, dataclass, pytest"
        ),
        "java": (
            "class, interface, abstract, extends, implements, override, generics, "
            "ArrayList, HashMap, try/catch, throws, package, import, Maven, Gradle, "
            "JUnit, Spring, annotation, lambda, stream, Optional"
        ),
        "javascript": (
            "const, let, var, function, arrow function, Promise, async/await, "
            "callback, closure, prototype, class, module, import/export, npm, "
            "DOM, event listener, fetch, JSON, array methods, destructuring"
        ),
        "c": (
            "pointer, malloc, free, struct, typedef, header file, preprocessor, "
            "array, string (char*), segfault, memory leak, stack, heap, "
            "pass by reference, pass by value, linked list, Makefile"
        ),
        "cpp": (
            "class, template, namespace, STL, vector, map, smart pointer, "
            "reference, virtual, override, constructor, destructor, RAII, "
            "inheritance, polymorphism, iterator, lambda, move semantics"
        ),
    }
    return vocabs.get(language.lower(), vocabs["python"])


class GeminiLiveSession:
    """Wraps a single Gemini Live API session for one viva.

    Manages the bidirectional audio stream between our backend and Gemini.
    """

    def __init__(
        self,
        assignment_title: str,
        code_context: str | None = None,
        programming_language: str = "python",
        questions: list[dict] | None = None,
        criteria: list[dict] | None = None,
    ) -> None:
        self._settings = get_settings()
        self._system_prompt = _build_system_prompt(
            assignment_title=assignment_title,
            code_context=code_context,
            programming_language=programming_language,
            questions=questions or [],
            criteria=criteria or [],
        )
        self._session = None
        self._client = None
        self._closed = False

    async def connect(self) -> None:
        """Establish the Gemini Live API session."""
        self._client = genai.Client(api_key=self._settings.gemini_api_key)

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=self._system_prompt)]
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede",
                    )
                )
            ),
        )

        self._session = await self._client.aio.live.connect(
            model=self._settings.gemini_live_model,
            config=config,
        )
        logger.info("gemini_live_connected", model=self._settings.gemini_live_model)

    async def send_audio(self, pcm_base64: str) -> None:
        """Send a base64-encoded PCM audio chunk to Gemini.

        Args:
            pcm_base64: Base64-encoded raw 16-bit PCM audio at 16kHz.
        """
        if self._closed or not self._session:
            return

        raw_bytes = base64.b64decode(pcm_base64)
        await self._session.send(
            input=types.LiveClientRealtimeInput(
                media_chunks=[
                    types.Blob(
                        mime_type="audio/pcm;rate=16000",
                        data=raw_bytes,
                    )
                ]
            )
        )

    async def send_text(self, text: str) -> None:
        """Send a text message to Gemini (e.g., instructions to wrap up)."""
        if self._closed or not self._session:
            return
        await self._session.send(input=text, end_of_turn=True)

    async def receive_audio(self) -> AsyncGenerator[dict, None]:
        """Yield audio/text responses from Gemini.

        Yields dicts with keys:
            - type: "audio" | "text" | "turn_complete"
            - data: base64 PCM audio (for audio) or text string
        """
        if self._closed or not self._session:
            return

        try:
            turn = self._session.receive()
            async for response in turn:
                if response.server_content:
                    sc = response.server_content

                    # Check for turn completion
                    if sc.turn_complete:
                        yield {"type": "turn_complete", "data": ""}
                        continue

                    if sc.model_turn and sc.model_turn.parts:
                        for part in sc.model_turn.parts:
                            if part.inline_data:
                                audio_b64 = base64.b64encode(
                                    part.inline_data.data
                                ).decode("utf-8")
                                yield {
                                    "type": "audio",
                                    "data": audio_b64,
                                    "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000",
                                }
                            elif part.text:
                                yield {"type": "text", "data": part.text}

        except asyncio.CancelledError:
            logger.info("gemini_receive_cancelled")
        except Exception as e:
            logger.error("gemini_receive_error", error=str(e))
            yield {"type": "error", "data": str(e)}

    async def close(self) -> None:
        """Close the Gemini Live session."""
        if self._closed:
            return
        self._closed = True

        if self._session:
            try:
                await self._session.close()
            except Exception as e:
                logger.warning("gemini_close_error", error=str(e))

        logger.info("gemini_live_disconnected")
