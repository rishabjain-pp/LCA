"""
LiveKit AI Agent Worker — Entry point for the voice agent service.

Uses AWS Nova Sonic realtime model for STT+LLM+TTS in a single model.
Connects to LiveKit server, listens for SIP calls, and dispatches
the Orchestrator agent to handle each call.

Run: python main.py start
"""

import os
import logging
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero, aws
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from agents.orchestrator import OrchestratorAgent
from services.dashboard_bridge import DashboardBridge

load_dotenv()

logger = logging.getLogger("lca-agent")
logging.basicConfig(level=logging.INFO)


def prewarm(proc: JobProcess) -> None:
    """Pre-load VAD model for faster agent startup."""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("VAD model pre-loaded")


async def entrypoint(ctx: JobContext) -> None:
    """Handle a new incoming SIP call."""
    logger.info(f"New call received, room: {ctx.room.name}")

    await ctx.connect()

    # Initialize the dashboard bridge for sending transcripts to the LCA UI
    relay_url = os.getenv("LCA_RELAY_URL", "http://127.0.0.1:8080")
    bridge = DashboardBridge(relay_url=relay_url)

    # Build the Nova Sonic realtime model
    region = os.getenv("AWS_AI_REGION", os.getenv("AWS_REGION", "us-east-1"))
    realtime_model = aws.realtime.RealtimeModel(
        voice="ruth",
        region=region,
        temperature=0.7,
        turn_detection="HIGH",
    )

    # Create the orchestrator agent
    orchestrator = OrchestratorAgent()

    # Create the agent session with Nova Sonic
    session = AgentSession(
        llm=realtime_model,
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
    )

    # Hook up transcript events to the dashboard bridge
    # Pass the room for room-level transcription_received (streaming partials)
    bridge.attach(session, room_name=ctx.room.name, room=ctx.room)

    # Start the session
    await session.start(
        agent=orchestrator,
        room=ctx.room,
    )

    logger.info("Agent session started, waiting for caller...")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="lca-agent",
        )
    )
