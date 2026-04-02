/**
 * LiveKit AI Agent Worker — Entry point for the voice agent service.
 *
 * Connects to LiveKit server, listens for SIP calls, and dispatches
 * the Orchestrator agent to handle each call.
 *
 * Run: npx tsx src/agents/worker.ts start
 */

import 'dotenv/config';
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as livekit from '@livekit/agents-plugin-livekit';
import { OrchestratorAgent } from './orchestrator.js';
import type { ConversationData } from './definitions.js';

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Pre-load VAD model for faster agent startup
    proc.userData.vad = await silero.VAD.load();
    console.log('[Agent Worker] VAD model pre-loaded');
  },

  entry: async (ctx: JobContext) => {
    console.log('[Agent Worker] New call received, room:', ctx.room.name);

    // Shared conversation data across agent transfers
    const userData: ConversationData = {};

    // Create the voice pipeline session
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'en',
      }),
      llm: new inference.LLM({
        model: 'openai/gpt-4o-mini',
      }),
      tts: new inference.TTS({
        model: 'openai/tts-1',
        voice: 'alloy',
      }),
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      },
      userData,
    });

    // Log transcription events
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      console.log(`[CALLER] ${ev.transcript} (final: ${ev.isFinal})`);
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      console.log(`[Agent] State: ${ev.oldState} → ${ev.newState}`);
    });

    // Start the session with the Orchestrator agent
    await session.start({
      agent: new OrchestratorAgent(),
      room: ctx.room,
    });

    console.log('[Agent Worker] Session started, waiting for SIP participant...');
  },
});

// Run the agent worker CLI
cli.runApp(new WorkerOptions({ agent: __filename }));
