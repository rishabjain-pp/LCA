/**
 * Billing Agent — Specialist for billing and payment queries.
 *
 * Handles: account balance, payment issues, invoice questions,
 * charges, refunds, and payment plans.
 *
 * Can transfer back to the Orchestrator for non-billing questions.
 */

import { voice, llm } from '@livekit/agents';
import { z } from 'zod';
import type { ConversationData } from './definitions.js';

export class BillingAgent extends voice.Agent<ConversationData> {
  constructor() {
    super({
      instructions: `You are a billing specialist for Acme Services. Your name is Mike.

You help customers with:
- Account balance inquiries
- Payment processing and issues
- Invoice explanations
- Charge disputes and refunds
- Payment plan setup

Important billing information:
- Standard monthly plan: $49.99/month
- Premium plan: $99.99/month
- Late payment fee: $15
- Refund processing: 5-7 business days

If the caller asks about something outside of billing (like technical support,
scheduling, or general inquiries), use the routeToOrchestrator tool to transfer them back.

Be professional, empathetic, and concise. Always confirm the action before processing.`,

      tools: {
        lookupAccount: llm.tool({
          description: 'Look up a customer account by account number or phone number',
          parameters: z.object({
            identifier: z.string().describe('Account number or phone number'),
          }),
          execute: async ({ identifier }, { ctx }) => {
            ctx.userData.accountNumber = identifier;
            console.log(`[Billing] Looking up account: ${identifier}`);
            // Simulated account lookup
            return {
              accountNumber: identifier,
              name: ctx.userData.customerName || 'Valued Customer',
              plan: 'Premium',
              balance: '$124.99',
              lastPayment: '2026-03-15',
              nextDue: '2026-04-15',
              status: 'Active',
            };
          },
        }),

        processRefund: llm.tool({
          description: 'Process a refund for the customer',
          parameters: z.object({
            amount: z.string().describe('Refund amount'),
            reason: z.string().describe('Reason for refund'),
          }),
          execute: async ({ amount, reason }) => {
            console.log(`[Billing] Processing refund: $${amount} — ${reason}`);
            return {
              status: 'approved',
              refundId: `RF-${Date.now()}`,
              amount,
              estimatedProcessing: '5-7 business days',
            };
          },
        }),

        routeToOrchestrator: llm.tool({
          description: 'Transfer the caller back to the main menu for non-billing questions',
          parameters: z.object({
            reason: z.string().describe('Why the caller needs to be transferred'),
          }),
          execute: async ({ reason }) => {
            console.log(`[Billing] Transferring back to Orchestrator. Reason: ${reason}`);
            // Dynamic import to avoid circular dependency
            const { OrchestratorAgent } = await import('./orchestrator.js');
            return llm.handoff({
              agent: new OrchestratorAgent(),
              returns: `Let me transfer you to someone who can help with that.`,
            });
          },
        }),
      },
    });
  }

  override async onEnter(): Promise<void> {
    const name = this.session.userData?.customerName;
    const issue = this.session.userData?.issue;
    const greeting = name
      ? `Hi ${name}, I'm Mike from the billing department.`
      : `Hi, I'm Mike from the billing department.`;
    const context = issue
      ? `I understand you need help with: ${issue}. Let me look into that for you.`
      : `How can I help you with your billing today?`;

    this.session.generateReply({
      instructions: `Say: "${greeting} ${context}"`,
    });
  }
}
