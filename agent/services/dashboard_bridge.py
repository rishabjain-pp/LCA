"""
Dashboard Bridge — Sends real-time transcript events from the LiveKit agent
to the Node.js LCA relay server for display in the React dashboard.

Key behaviors:
- Caller partials use stable resultId so UI replaces (not duplicates)
- Only final transcripts are shown (partials are skipped to avoid clutter)
- Agent speech captured via conversation_item_added
"""

import logging
import time
import uuid
import asyncio
import json
import aiohttp
import boto3

from livekit.agents import AgentSession

logger = logging.getLogger("lca-agent.bridge")


class DashboardBridge:
    def __init__(self, relay_url: str = "http://127.0.0.1:8080") -> None:
        self.relay_url = relay_url
        self._session_start = time.time()
        self._room_name = ""
        self._comprehend = boto3.client("comprehend", region_name="us-east-1")
        self._last_agent_text = ""
        self._caller_turn_id = 0

    def attach(self, session: AgentSession, room_name: str, room=None) -> None:
        """Attach event listeners to the AgentSession."""
        self._room_name = room_name
        self._session_start = time.time()

        # Notify dashboard of call start
        self._fire_event({
            "type": "call.started",
            "call": {
                "callSid": room_name,
                "streamSid": room_name,
                "callerNumber": "",
                "calledNumber": "Acme Services",
                "startTime": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "status": "active",
            },
        })

        # CALLER: user_input_transcribed — fires with partial + final
        @session.on("user_input_transcribed")
        def on_user_transcript(ev):
            self._on_user_transcript(ev)

        # AGENT: conversation_item_added — fires when agent finishes a response
        @session.on("conversation_item_added")
        def on_conversation_item(ev):
            self._on_conversation_item(ev)

        # Room-level transcription (if available — captures both sides)
        if room:
            @room.on("transcription_received")
            def on_transcription(participant, track_publication, segments):
                self._on_room_transcription(participant, segments)

        @session.on("close")
        def on_close(ev):
            self._on_close()

        logger.info(f"Dashboard bridge attached for room: {room_name}")

    def _on_user_transcript(self, ev) -> None:
        """Handle caller speech — only emit FINAL transcripts."""
        transcript = getattr(ev, "transcript", "") or ""
        if not transcript.strip():
            return

        is_final = getattr(ev, "is_final", True)

        # Skip partials — only show final complete sentences
        if not is_final:
            return

        elapsed = time.time() - self._session_start
        self._caller_turn_id += 1
        sentiment_result = self._analyze_sentiment(transcript)

        segment = {
            "resultId": f"CALLER-{self._caller_turn_id}",
            "channel": "CALLER",
            "text": transcript,
            "isPartial": False,
            "startTime": round(max(elapsed - 3, 0), 1),
            "endTime": round(elapsed, 1),
            "sentiment": sentiment_result["sentiment"],
            "issueDetected": sentiment_result["issue"],
        }

        logger.info(f"[CALLER] {transcript} ({sentiment_result['sentiment']})")

        self._fire_event({
            "type": "transcript",
            "callSid": self._room_name,
            "segment": segment,
        })

    def _on_conversation_item(self, ev) -> None:
        """Handle agent speech from conversation_item_added."""
        item = getattr(ev, "item", ev)
        role = getattr(item, "role", None)

        # Debug: log ALL conversation items to understand the structure
        attrs = [a for a in dir(item) if not a.startswith('_')]
        logger.info(f"[CONV_ITEM] role={role}, type={type(item).__name__}, attrs={attrs[:15]}")

        if role != "assistant":
            return

        # Extract text — try all known patterns
        text = self._extract_text(item)
        logger.info(f"[CONV_ITEM] Extracted agent text: '{text[:80]}...' " if len(text) > 80 else f"[CONV_ITEM] Extracted agent text: '{text}'")
        if not text.strip() or text == self._last_agent_text:
            return

        self._last_agent_text = text
        elapsed = time.time() - self._session_start
        sentiment_result = self._analyze_sentiment(text)

        segment = {
            "resultId": f"AGENT-{uuid.uuid4().hex[:8]}",
            "channel": "AGENT",
            "text": text,
            "isPartial": False,
            "startTime": round(max(elapsed - 3, 0), 1),
            "endTime": round(elapsed, 1),
            "sentiment": sentiment_result["sentiment"],
            "issueDetected": sentiment_result["issue"],
        }

        logger.info(f"[AGENT] {text} ({sentiment_result['sentiment']})")

        self._fire_event({
            "type": "transcript",
            "callSid": self._room_name,
            "segment": segment,
        })

    def _on_room_transcription(self, participant, segments) -> None:
        """Handle room-level transcription — captures agent text that session events miss."""
        if not segments:
            return

        identity = getattr(participant, "identity", "") or ""
        is_agent = "agent" in identity.lower()

        # Only use room-level for AGENT (caller already handled by user_input_transcribed)
        if not is_agent:
            return

        for seg in segments:
            text = getattr(seg, "text", "") or ""
            is_final = getattr(seg, "final", False)

            if not text.strip() or not is_final:
                continue

            if text == self._last_agent_text:
                continue

            self._last_agent_text = text
            elapsed = time.time() - self._session_start
            sentiment_result = self._analyze_sentiment(text)

            segment = {
                "resultId": f"AGENT-room-{uuid.uuid4().hex[:8]}",
                "channel": "AGENT",
                "text": text,
                "isPartial": False,
                "startTime": round(max(elapsed - 3, 0), 1),
                "endTime": round(elapsed, 1),
                "sentiment": sentiment_result["sentiment"],
                "issueDetected": sentiment_result["issue"],
            }

            logger.info(f"[AGENT/room] {text} ({sentiment_result['sentiment']})")

            self._fire_event({
                "type": "transcript",
                "callSid": self._room_name,
                "segment": segment,
            })

    def _extract_text(self, item) -> str:
        """Extract text from a conversation item using multiple strategies."""
        # Strategy 1: direct .text
        text = getattr(item, "text", "") or ""
        if text:
            return text

        # Strategy 2: .content list
        content = getattr(item, "content", [])
        if isinstance(content, list):
            for c in content:
                t = getattr(c, "text", "") or getattr(c, "content", "") or ""
                if t:
                    return t
        elif isinstance(content, str) and content:
            return content

        # Strategy 3: .text_content
        text_content = getattr(item, "text_content", "") or ""
        if text_content:
            return text_content

        # Strategy 4: try to serialize and find text
        try:
            d = item.__dict__ if hasattr(item, "__dict__") else {}
            for key in ["text", "content", "message", "output"]:
                if key in d and isinstance(d[key], str) and d[key].strip():
                    return d[key]
        except Exception:
            pass

        # Log the item structure for debugging
        logger.debug(f"[AGENT] Could not extract text from item: {type(item).__name__}, attrs: {[a for a in dir(item) if not a.startswith('_')]}")

        return ""

    def _on_close(self) -> None:
        """Handle session close."""
        logger.info(f"Session closed for room: {self._room_name}")
        self._fire_event({
            "type": "call.ended",
            "callSid": self._room_name,
        })

    def _analyze_sentiment(self, text: str) -> dict:
        """Use AWS Comprehend for real AI sentiment analysis."""
        try:
            result = self._comprehend.detect_sentiment(Text=text, LanguageCode="en")
            sentiment = result.get("Sentiment", "NEUTRAL")
            neg_score = result.get("SentimentScore", {}).get("Negative", 0)
            issue = sentiment == "NEGATIVE" or (sentiment == "MIXED" and neg_score > 0.4)
            return {"sentiment": sentiment, "issue": issue}
        except Exception as e:
            logger.error(f"Comprehend error: {e}")
            return {"sentiment": "NEUTRAL", "issue": False}

    def _fire_event(self, payload: dict) -> None:
        """POST event to relay server."""
        try:
            asyncio.get_running_loop()
            asyncio.ensure_future(self._async_post(payload))
        except RuntimeError:
            try:
                asyncio.run(self._async_post(payload))
            except Exception:
                pass

    async def _async_post(self, payload: dict) -> None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.relay_url}/api/agent-transcript",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status != 200:
                        logger.warning(f"Dashboard POST failed: {resp.status}")
        except Exception as e:
            logger.debug(f"Dashboard POST error: {e}")
