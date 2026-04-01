/**
 * Audio conversion utilities for Twilio Media Streams.
 * Converts mulaw (G.711) encoded audio at 8kHz to PCM16 at 16kHz.
 * Zero external dependencies.
 */

// Build the 256-entry mulaw-to-PCM16 lookup table at module load time.
// Algorithm follows ITU G.711 mulaw decode specification.
// Note: in mulaw encoding, the sign bit (bit 7) being set after complementing
// indicates a POSITIVE sample (opposite of two's complement convention).
const MULAW_TABLE: Int16Array = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const complemented = (~i) & 0xFF;
    const sign = complemented & 0x80;       // non-zero = positive
    const exponent = (complemented & 0x70) >> 4;
    const mantissa = complemented & 0x0F;
    // ITU G.711 standard bias is 0x84 (132). The formula expands to:
    // ((mantissa << 3) + 132) << exponent, then subtract the bias 132.
    let magnitude = ((mantissa << 3) + 0x84) << exponent;
    magnitude -= 0x84;
    table[i] = sign !== 0 ? magnitude : -magnitude;
  }
  return table;
})();

/**
 * Decodes mulaw-encoded bytes to 16-bit signed PCM samples (little-endian).
 * Each input byte produces 2 output bytes.
 */
export function mulawToPcm16(mulawBytes: Buffer): Buffer {
  const output = Buffer.allocUnsafe(mulawBytes.length * 2);
  for (let i = 0; i < mulawBytes.length; i++) {
    output.writeInt16LE(MULAW_TABLE[mulawBytes[i]!]!, i * 2);
  }
  return output;
}

/**
 * Upsamples PCM16 audio from 8kHz to 16kHz by duplicating each sample.
 * Each 16-bit input sample is written twice to the output buffer.
 */
export function upsample8kTo16k(pcm16At8k: Buffer): Buffer {
  const sampleCount = pcm16At8k.length / 2;
  const output = Buffer.allocUnsafe(pcm16At8k.length * 2);
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm16At8k.readInt16LE(i * 2);
    output.writeInt16LE(sample, i * 4);
    output.writeInt16LE(sample, i * 4 + 2);
  }
  return output;
}

/**
 * Converts Twilio mulaw audio payload to PCM16 at 16kHz.
 * Chains mulawToPcm16 then upsample8kTo16k.
 * Output length is 4x the input length.
 */
export function convertTwilioAudio(mulawPayload: Buffer): Buffer {
  return upsample8kTo16k(mulawToPcm16(mulawPayload));
}
