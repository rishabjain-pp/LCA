"""
SIP Trunk + Dispatch Rule Setup Script

Run once to configure LiveKit SIP server with:
1. An inbound SIP trunk (accepts calls from Twilio)
2. A dispatch rule (routes calls to individual rooms, triggering the agent)

Usage: python setup_sip.py
"""

import os
import asyncio
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def setup():
    livekit_url = os.getenv("LIVEKIT_URL", "http://127.0.0.1:7880")
    api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "secret")

    lk = api.LiveKitAPI(livekit_url, api_key, api_secret)

    print("[SIP Setup] Creating inbound SIP trunk...")

    trunk = await lk.sip.create_sip_inbound_trunk(
        api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="LCA Demo Trunk",
                numbers=[],
                allowed_addresses=[],
            )
        )
    )

    trunk_id = trunk.sip_trunk_id
    print(f"[SIP Setup] Trunk created: {trunk_id}")

    print("[SIP Setup] Creating dispatch rule...")

    rule = await lk.sip.create_sip_dispatch_rule(
        api.CreateSIPDispatchRuleRequest(
            trunk_ids=[trunk_id],
            rule=api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                    room_prefix="call-",
                )
            ),
        )
    )

    rule_id = rule.sip_dispatch_rule_id
    print(f"[SIP Setup] Dispatch rule created: {rule_id}")

    print("\n[SIP Setup] Done! Configuration:")
    print(f"  Trunk ID: {trunk_id}")
    print(f"  Dispatch Rule ID: {rule_id}")
    print(f"  Room prefix: call-")
    print("\nNext steps:")
    print("  1. Configure Twilio SIP trunk → point to your LiveKit SIP server (port 5060)")
    print("  2. Start the agent: cd agent && python main.py start")
    print("  3. Call your Twilio number")

    await lk.aclose()


if __name__ == "__main__":
    asyncio.run(setup())
