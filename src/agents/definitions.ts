/**
 * Shared types and configuration for all AI agents.
 */

/** Shared conversation data that persists across agent transfers */
export type ConversationData = {
  customerName?: string;
  issue?: string;
  accountNumber?: string;
};
