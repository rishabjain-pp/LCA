/**
 * SIP Trunk + Dispatch Rule Setup Script
 *
 * Run once to configure LiveKit SIP server with:
 * 1. An inbound SIP trunk (accepts calls from Twilio)
 * 2. A dispatch rule (routes calls to individual rooms, triggering the agent)
 *
 * Usage: npx tsx src/setupSip.ts
 */

import 'dotenv/config';
import { SipClient } from 'livekit-server-sdk';

async function setup() {
  const livekitUrl = process.env['LIVEKIT_URL'] || 'http://localhost:7880';
  const apiKey = process.env['LIVEKIT_API_KEY'] || 'devkey';
  const apiSecret = process.env['LIVEKIT_API_SECRET'] || 'secret';

  const sipClient = new SipClient(livekitUrl, apiKey, apiSecret);

  console.log('[SIP Setup] Creating inbound SIP trunk...');

  const trunk = await sipClient.createSipInboundTrunk(
    'LCA Demo Trunk',  // name
    [],                 // numbers (empty = accept any)
    {
      allowedAddresses: [], // Accept from any IP (local dev)
    },
  );

  console.log(`[SIP Setup] Trunk created: ${trunk.sipTrunkId}`);

  console.log('[SIP Setup] Creating dispatch rule...');

  const rule = await sipClient.createSipDispatchRule({
    type: 'individual' as const,
    roomPrefix: 'call-',
  }, {
    trunkIds: [trunk.sipTrunkId],
  });

  console.log(`[SIP Setup] Dispatch rule created: ${rule.sipDispatchRuleId}`);
  console.log('\n[SIP Setup] Done! Configuration:');
  console.log(`  Trunk ID: ${trunk.sipTrunkId}`);
  console.log(`  Dispatch Rule ID: ${rule.sipDispatchRuleId}`);
  console.log(`  Room prefix: call-`);
  console.log('\nNext steps:');
  console.log('  1. Configure Twilio SIP trunk → point to your LiveKit SIP server (port 5060)');
  console.log('  2. Start the agent: npm run agent');
  console.log('  3. Call your Twilio number');
}

setup().catch(console.error);
