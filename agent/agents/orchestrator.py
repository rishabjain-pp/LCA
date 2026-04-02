"""
Orchestrator Agent — Entry point for all incoming calls.

Greets the caller and routes to the appropriate specialist agent
based on the caller's intent. Currently supports:
- Billing queries → BillingAgent
"""

import logging
from livekit.agents import Agent, llm

logger = logging.getLogger("lca-agent.orchestrator")


class OrchestratorAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a friendly customer service representative for Acme Services. Your name is Sarah.

Your role is to greet callers warmly and understand what they need help with.

When the caller mentions anything related to billing, payments, invoices, account balance,
charges, or refunds — use the route_to_billing tool to transfer them to our billing specialist.

For all other inquiries, do your best to help directly. Be concise and professional.
Always ask for the caller's name if they haven't provided it.""",
            tools=[self._route_to_billing],
        )

    @llm.function_tool()
    async def _route_to_billing(
        self,
        reason: str,
    ) -> Agent:
        """Transfer the caller to the billing specialist when they have billing,
        payment, invoice, account balance, charges, or refund questions.

        Args:
            reason: Brief description of the billing issue
        """
        logger.info(f"Transferring to Billing Agent. Reason: {reason}")
        from .billing import BillingAgent
        return BillingAgent(handoff_reason=reason)

    async def on_enter(self) -> None:
        """Called when this agent becomes active."""
        # Check if returning from a specialist
        handoff = getattr(self, "_handoff_reason", None)
        if handoff:
            self.session.generate_reply(
                instructions=f"The caller was returned from a specialist. Continue helping them. Context: {handoff}"
            )
        else:
            self.session.generate_reply(
                instructions='Greet the caller warmly. Say: "Thank you for calling Acme Services. My name is Sarah, how can I help you today?"'
            )
