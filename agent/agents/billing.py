"""
Billing Agent — Specialist for billing and payment queries.

Handles: account balance, payment issues, invoice questions,
charges, refunds, and payment plans.
"""

import logging
import time
from livekit.agents import Agent, llm

logger = logging.getLogger("lca-agent.billing")


class BillingAgent(Agent):
    def __init__(self, handoff_reason: str = "") -> None:
        self._handoff_reason = handoff_reason
        super().__init__(
            instructions="""You are a billing specialist for Acme Services. Your name is Mike.

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
scheduling, or general inquiries), use the route_to_orchestrator tool to transfer them back.

Be professional, empathetic, and concise.""",
        )

    @llm.function_tool()
    async def lookup_account(self, identifier: str) -> dict:
        """Look up a customer account by account number or phone number.

        Args:
            identifier: Account number or phone number
        """
        logger.info(f"Looking up account: {identifier}")
        return {
            "accountNumber": identifier,
            "plan": "Premium",
            "balance": "$124.99",
            "lastPayment": "2026-03-15",
            "nextDue": "2026-04-15",
            "status": "Active",
        }

    @llm.function_tool()
    async def process_refund(self, amount: str, reason: str) -> dict:
        """Process a refund for the customer.

        Args:
            amount: Refund amount (e.g. "$49.99")
            reason: Reason for the refund
        """
        logger.info(f"Processing refund: ${amount} - {reason}")
        return {
            "status": "approved",
            "refundId": f"RF-{int(time.time())}",
            "amount": amount,
            "estimatedProcessing": "5-7 business days",
        }

    @llm.function_tool()
    async def route_to_orchestrator(self, reason: str) -> Agent:
        """Transfer the caller back to the main menu for non-billing questions.

        Args:
            reason: Why the caller needs to be transferred
        """
        logger.info(f"Transferring back to Orchestrator. Reason: {reason}")
        from .orchestrator import OrchestratorAgent
        agent = OrchestratorAgent()
        agent._handoff_reason = reason
        return agent

    async def on_enter(self) -> None:
        """Called when this agent becomes active."""
        if self._handoff_reason:
            self.session.generate_reply(
                instructions=f'Say: "Hi, I\'m Mike from the billing department. I understand you need help with: {self._handoff_reason}. Let me look into that for you."'
            )
        else:
            self.session.generate_reply(
                instructions='Say: "Hi, I\'m Mike from the billing department. How can I help you with your billing today?"'
            )
