"""
Dashboard Bridge — Sends transcript events from the LiveKit agent
to the Node.js LCA relay server for display in the React dashboard.

Hooks into AgentSession events and POSTs formatted transcript segments
to the /api/agent-transcript endpoint.
"""

import logging
import time
import uuid
import asyncio
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

    def attach(self, session: AgentSession, room_name: str) -> None:
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

        # Listen for user speech (CALLER) — fires when user's speech is transcribed
        @session.on("user_input_transcribed")
        def on_user_transcript(ev):
            self._on_user_transcript(ev)

        # Listen for conversation items (includes agent speech)
        @session.on("conversation_item_added")
        def on_conversation_item(ev):
            self._on_conversation_item(ev)

        # Listen for session close
        @session.on("close")
        def on_close(ev):
            self._on_close()

        logger.info(f"Dashboard bridge attached for room: {room_name}")

    def _on_user_transcript(self, ev) -> None:
        """Handle user (caller) speech transcription."""
        transcript = getattr(ev, "transcript", "") or ""
        if not transcript.strip():
            return

        is_final = getattr(ev, "is_final", True)
        elapsed = time.time() - self._session_start

        # Only run sentiment on final transcripts
        if is_final:
            sentiment_result = self._analyze_sentiment(transcript)
        else:
            sentiment_result = {"sentiment": None, "issue": False}

        segment = {
            "resultId": f"CALLER-{uuid.uuid4().hex[:12]}",
            "channel": "CALLER",
            "text": transcript,
            "isPartial": not is_final,
            "startTime": round(max(elapsed - 3, 0), 1),
            "endTime": round(elapsed, 1),
            "sentiment": sentiment_result["sentiment"],
            "issueDetected": sentiment_result["issue"],
        }

        if is_final:
            logger.info(f"[CALLER] {transcript} ({sentiment_result['sentiment']})")

        self._fire_event({
            "type": "transcript",
            "callSid": self._room_name,
            "segment": segment,
        })

    def _on_conversation_item(self, ev) -> None:
        """Handle conversation items — extract agent speech."""
        item = getattr(ev, "item", ev)
        role = getattr(item, "role", None)

        # Only process assistant (agent) messages
        if role != "assistant":
            return

        # Extract text content
        text = ""
        content = getattr(item, "content", [])
        if isinstance(content, list):
            for c in content:
                t = getattr(c, "text", "") or ""
                if t:
                    text = t
                    break
        elif isinstance(content, str):
            text = content

        if not text.strip():
            return

        elapsed = time.time() - self._session_start
        sentiment_result = self._analyze_sentiment(text)

        segment = {
            "resultId": f"AGENT-{uuid.uuid4().hex[:12]}",
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
            result = self._comprehend.detect_sentiment(
                Text=text,
                LanguageCode="en",
            )
            sentiment = result.get("Sentiment", "NEUTRAL")
            neg_score = result.get("SentimentScore", {}).get("Negative", 0)
            issue = sentiment == "NEGATIVE" or (sentiment == "MIXED" and neg_score > 0.4)
            return {"sentiment": sentiment, "issue": issue}
        except Exception as e:
            logger.error(f"Comprehend error: {e}")
            return {"sentiment": "NEUTRAL", "issue": False}

    def _fire_event(self, payload: dict) -> None:
        """POST an event to the LCA relay server (fire-and-forget)."""
        try:
            loop = asyncio.get_running_loop()
            asyncio.ensure_future(self._async_post(payload))
        except RuntimeError:
            # No running event loop — create one
            try:
                asyncio.run(self._async_post(payload))
            except Exception:
                logger.warning("Could not send dashboard event")

    async def _async_post(self, payload: dict) -> None:
        """Async POST to relay server."""
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
