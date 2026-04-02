"""
SIP Trunk + Dispatch Rule Setup Script

Run once to configure LiveKit SIP server with:
1. An inbound SIP trunk (accepts calls from Twilio/MicroSIP)
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

    # First, clean up any existing trunks/rules from previous runs
    print("[SIP Setup] Cleaning up existing SIP config...")
    try:
        existing_rules = await lk.sip.list_dispatch_rule(api.ListSIPDispatchRuleRequest())
        for r in existing_rules.items:
            await lk.sip.delete_dispatch_rule(
                api.DeleteSIPDispatchRuleRequest(sip_dispatch_rule_id=r.sip_dispatch_rule_id)
            )
            print(f"  Deleted rule: {r.sip_dispatch_rule_id}")
    except Exception:
        pass

    try:
        existing_trunks = await lk.sip.list_sip_inbound_trunk(api.ListSIPInboundTrunkRequest())
        for t in existing_trunks.items:
            await lk.sip.delete_sip_trunk(
                api.DeleteSIPTrunkRequest(sip_trunk_id=t.sip_trunk_id)
            )
            print(f"  Deleted trunk: {t.sip_trunk_id}")
    except Exception:
        pass

    print("[SIP Setup] Creating inbound SIP trunk...")
    trunk = await lk.sip.create_inbound_trunk(
        api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="LCA Demo Trunk",
                numbers=[],
                allowed_addresses=["0.0.0.0/0"],
            )
        )
    )
    trunk_id = trunk.sip_trunk_id
    print(f"[SIP Setup] Trunk created: {trunk_id}")

    print("[SIP Setup] Creating dispatch rule with agent_name='lca-agent'...")
    rule = await lk.sip.create_dispatch_rule(
        api.CreateSIPDispatchRuleRequest(
            trunk_ids=[trunk_id],
            rule=api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                    room_prefix="call-",
                )
            ),
            room_config=api.RoomConfiguration(
                agents=[
                    api.RoomAgentDispatch(agent_name="lca-agent"),
                ],
            ),
        )
    )
    rule_id = rule.sip_dispatch_rule_id
    print(f"[SIP Setup] Dispatch rule created: {rule_id}")

    print("\n[SIP Setup] Done!")
    print(f"  Trunk ID: {trunk_id}")
    print(f"  Dispatch Rule ID: {rule_id}")
    print(f"  Agent Name: lca-agent")
    print(f"  Room prefix: call-")

    await lk.aclose()


if __name__ == "__main__":
    asyncio.run(setup())
