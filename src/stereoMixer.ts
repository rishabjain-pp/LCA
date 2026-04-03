/**
 * Stereo audio mixer for combining two mono PCM16 streams into one
 * interleaved stereo stream. Required for AWS Transcribe Call Analytics
 * which expects 2-channel stereo audio (channel 0 = CUSTOMER, channel 1 = AGENT).
 *
 * Twilio sends separate inbound (caller) and outbound (agent) mono tracks.
 * This mixer interleaves them into stereo PCM16 at the same sample rate.
 */

export class StereoMixer {
  private callerQueue: Buffer[] = [];
  private agentQueue: Buffer[] = [];
  private outputQueue: Buffer[] = [];
  private outputResolve: (() => void) | null = null;
  private ended = false;

  /**
   * Push caller (inbound) audio. Each buffer is PCM16 LE mono.
   */
  pushCaller(pcm: Buffer): void {
    if (this.ended) return;
    this.callerQueue.push(pcm);
    this.tryMix();
  }

  /**
   * Push agent (outbound) audio. Each buffer is PCM16 LE mono.
   */
  pushAgent(pcm: Buffer): void {
    if (this.ended) return;
    this.agentQueue.push(pcm);
    this.tryMix();
  }

  /**
   * Signal end of audio. Flushes remaining buffers.
   */
  close(): void {
    this.ended = true;
    // Flush remaining: pad the shorter queue with silence
    while (this.callerQueue.length > 0 || this.agentQueue.length > 0) {
      const caller = this.callerQueue.shift() ?? Buffer.alloc(640); // silence
      const agent = this.agentQueue.shift() ?? Buffer.alloc(640);   // silence
      this.outputQueue.push(this.interleave(caller, agent));
    }
    if (this.outputResolve) {
      this.outputResolve();
      this.outputResolve = null;
    }
  }

  /**
   * Async generator yielding interleaved stereo PCM16 buffers.
   */
  async *stream(): AsyncGenerator<Buffer> {
    while (!this.ended || this.outputQueue.length > 0) {
      if (this.outputQueue.length > 0) {
        yield this.outputQueue.shift()!;
      } else if (!this.ended) {
        await new Promise<void>(resolve => {
          this.outputResolve = resolve;
        });
      }
    }
  }

  /**
   * Try to mix when both queues have data.
   */
  private tryMix(): void {
    while (this.callerQueue.length > 0 && this.agentQueue.length > 0) {
      const caller = this.callerQueue.shift()!;
      const agent = this.agentQueue.shift()!;
      this.outputQueue.push(this.interleave(caller, agent));
      if (this.outputResolve) {
        this.outputResolve();
        this.outputResolve = null;
      }
    }
  }

  /**
   * Interleave two mono PCM16 buffers into one stereo PCM16 buffer.
   * Input:  [L0, L1, L2, ...] and [R0, R1, R2, ...]  (each sample is 2 bytes LE)
   * Output: [L0, R0, L1, R1, L2, R2, ...]
   */
  private interleave(left: Buffer, right: Buffer): Buffer {
    const samples = Math.min(left.length / 2, right.length / 2);
    const output = Buffer.allocUnsafe(samples * 4); // 2 channels * 2 bytes per sample
    for (let i = 0; i < samples; i++) {
      // Channel 0 (CUSTOMER/caller)
      output.writeInt16LE(left.readInt16LE(i * 2), i * 4);
      // Channel 1 (AGENT)
      output.writeInt16LE(right.readInt16LE(i * 2), i * 4 + 2);
    }
    return output;
  }
}
