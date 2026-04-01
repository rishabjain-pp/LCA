import { describe, it, expect } from 'vitest';
import { mulawToPcm16, upsample8kTo16k, convertTwilioAudio } from '../src/audioConverter';

describe('audioConverter', () => {
  describe('mulawToPcm16', () => {
    it('decodes silence (0xFF) to approximately 0', () => {
      const input = Buffer.from([0xFF]);
      const output = mulawToPcm16(input);
      expect(output.length).toBe(2);
      expect(output.readInt16LE(0)).toBe(0);
    });
    it('decodes 0x00 to +32124 (max positive)', () => {
      const input = Buffer.from([0x00]);
      const output = mulawToPcm16(input);
      expect(output.readInt16LE(0)).toBe(32124);
    });
    it('decodes 0x80 to -32124 (max negative)', () => {
      const input = Buffer.from([0x80]);
      const output = mulawToPcm16(input);
      expect(output.readInt16LE(0)).toBe(-32124);
    });
    it('output length is 2x input length', () => {
      const input = Buffer.from([0xFF, 0x00, 0x80, 0x55]);
      expect(mulawToPcm16(input).length).toBe(8);
    });
  });
  describe('upsample8kTo16k', () => {
    it('output length is 2x input length', () => {
      const input = Buffer.alloc(100);
      expect(upsample8kTo16k(input).length).toBe(200);
    });
    it('duplicates each sample', () => {
      const input = Buffer.alloc(4);
      input.writeInt16LE(1234, 0);
      input.writeInt16LE(-5678, 2);
      const output = upsample8kTo16k(input);
      expect(output.readInt16LE(0)).toBe(1234);
      expect(output.readInt16LE(2)).toBe(1234);
      expect(output.readInt16LE(4)).toBe(-5678);
      expect(output.readInt16LE(6)).toBe(-5678);
    });
  });
  describe('convertTwilioAudio', () => {
    it('output length is 4x mulaw input length', () => {
      const input = Buffer.from([0xFF, 0x00, 0x80]);
      expect(convertTwilioAudio(input).length).toBe(12);
    });
    it('returns empty buffer for empty input', () => {
      expect(convertTwilioAudio(Buffer.alloc(0)).length).toBe(0);
    });
  });
});
