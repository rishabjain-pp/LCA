/**
 * Orchestrator Agent — Entry point for all incoming calls.
 *
 * Greets the caller and routes to the appropriate specialist agent
 * based on the caller's intent. Currently supports:
 * - Billing queries → BillingAgent
 */

import { voice, llm } from '@livekit/agents';
import { z } from 'zod';
import type { ConversationData } from './definitions.js';
import { BillingAgent } from './billing.js';

export class OrchestratorAgent extends voice.Agent<ConversationData> {
  constructor() {
    super({
      instructions: `You are a friendly customer service representative for Acme Services.
Your role is to greet callers warmly and understand what they need help with.

When the caller mentions anything related to billing, payments, invoices, account balance,
charges, or refunds — use the routeToBilling tool to transfer them to our billing specialist.

For all other inquiries, do your best to help directly. Be concise and professional.
Always ask for the caller's name if they haven't provided it.`,

      tools: {
        routeToBilling: llm.tool({
          description: 'Transfer the caller to the billing specialist when they have billing, payment, invoice, account balance, charges, or refund questions.',
          parameters: z.object({
            reason: z.string().describe('Brief description of the billing issue'),
          }),
          execute: async ({ reason }, { ctx }) => {
            ctx.userData.issue = reason;
            console.log(`[Orchestrator] Transferring to Billing Agent. Reason: ${reason}`);
            return llm.handoff({
              agent: new BillingAgent(),
              returns: `I'll connect you with our billing specialist right away.`,
            });
          },
        }),
      },
    });
  }

  override async onEnter(): Promise<void> {
    this.session.generateReply({
      instructions: 'Greet the caller warmly. Say: "Thank you for calling Acme Services. My name is Sarah, how can I help you today?"',
    });
  }
}
