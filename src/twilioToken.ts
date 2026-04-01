import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * Generates a Twilio Access Token with a Voice grant for the given identity.
 * The token allows the browser client to register as a Twilio Device and
 * receive incoming calls directed to the specified identity.
 */
export function generateAccessToken(identity: string): string {
  const accountSid = process.env['TWILIO_ACCOUNT_SID'] || '';
  const apiKeySid = process.env['TWILIO_API_KEY_SID'] || '';
  const apiKeySecret = process.env['TWILIO_API_KEY_SECRET'] || '';
  const twimlAppSid = process.env['TWILIO_TWIML_APP_SID'] || '';

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}
