"""
Dashboard Bridge — Sends transcript events from the LiveKit agent
to the Node.js LCA relay server for display in the React dashboard.

Hooks into AgentSession events and POSTs formatted transcript segments
to the /api/agent-transcript endpoint.
"""

import logging
import time
import uuid
import aiohttp
import boto3

from livekit.agents import AgentSession
from livekit.agents.voice import AgentSessionEventTypes

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
        self._post_event({
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

        # Listen for user speech (CALLER)
        session.on(
            AgentSessionEventTypes.UserInputTranscribed,
            lambda ev: self._on_user_transcript(ev),
        )

        # Listen for agent speech (AGENT)
        session.on(
            AgentSessionEventTypes.AgentSpeechTranscriptionCompleted,
            lambda ev: self._on_agent_transcript(ev),
        )

        # Listen for session close
        session.on(
            AgentSessionEventTypes.Close,
            lambda ev: self._on_close(ev),
        )

        logger.info(f"Dashboard bridge attached for room: {room_name}")

    def _on_user_transcript(self, ev) -> None:
        """Handle user (caller) speech transcription."""
        if not ev.transcript or not ev.transcript.strip():
            return

        elapsed = time.time() - self._session_start
        sentiment = self._analyze_sentiment(ev.transcript)

        segment = {
            "resultId": f"CALLER-{uuid.uuid4().hex[:12]}",
            "channel": "CALLER",
            "text": ev.transcript,
            "isPartial": not getattr(ev, "is_final", True),
            "startTime": round(elapsed - 2, 1),
            "endTime": round(elapsed, 1),
            "sentiment": sentiment["sentiment"],
            "issueDetected": sentiment["issue"],
        }

        logger.info(f"[CALLER] {ev.transcript} ({sentiment['sentiment']})")

        self._post_event({
            "type": "transcript",
            "callSid": self._room_name,
            "segment": segment,
        })

    def _on_agent_transcript(self, ev) -> None:
        """Handle agent speech transcription."""
        text = getattr(ev, "transcript", "") or ""
        if not text.strip():
            return

        elapsed = time.time() - self._session_start
        sentiment = self._analyze_sentiment(text)

        segment = {
            "resultId": f"AGENT-{uuid.uuid4().hex[:12]}",
            "channel": "AGENT",
            "text": text,
            "isPartial": False,
            "startTime": round(elapsed - 2, 1),
            "endTime": round(elapsed, 1),
            "sentiment": sentiment["sentiment"],
            "issueDetected": sentiment["issue"],
        }

        logger.info(f"[AGENT] {text} ({sentiment['sentiment']})")

        self._post_event({
            "type": "transcript",
            "callSid": self._room_name,
            "segment": segment,
        })

    def _on_close(self, ev) -> None:
        """Handle session close."""
        logger.info(f"Session closed for room: {self._room_name}")
        self._post_event({
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

    def _post_event(self, payload: dict) -> None:
        """POST an event to the LCA relay server (fire-and-forget)."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(self._async_post(payload))
            else:
                loop.run_until_complete(self._async_post(payload))
        except RuntimeError:
            # No event loop — skip
            logger.warning("No event loop available for dashboard POST")

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
            logger.warning(f"Dashboard POST error: {e}")
