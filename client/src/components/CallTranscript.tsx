import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '../types';

interface CallTranscriptProps {
  segments: TranscriptSegment[];
  autoScroll: boolean;
  showAgentTranscripts: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

function getSentimentDot(sentiment?: string): string {
  switch (sentiment) {
    case 'POSITIVE': return 'dot-positive';
    case 'NEGATIVE': return 'dot-negative';
    case 'NEUTRAL': return 'dot-neutral';
    case 'MIXED': return 'dot-mixed';
    default: return 'dot-none';
  }
}

function getEntrySentimentClass(sentiment?: string): string {
  switch (sentiment) {
    case 'POSITIVE': return 'transcript-entry-sentiment-positive';
    case 'NEGATIVE': return 'transcript-entry-sentiment-negative';
    default: return '';
  }
}

export function CallTranscript({ segments, autoScroll, showAgentTranscripts }: CallTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSegments = showAgentTranscripts
    ? segments
    : segments.filter(s => s.channel !== 'AGENT');

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredSegments.length, autoScroll]);

  if (filteredSegments.length === 0) {
    return (
      <div className="transcript-container" ref={containerRef}>
        <div className="transcript-empty">
          No transcript data yet. Conversation will appear here as the call progresses.
        </div>
      </div>
    );
  }

  return (
    <div className="transcript-container" ref={containerRef}>
      {filteredSegments.map((seg) => {
        const channelClass = seg.channel === 'CALLER' ? 'transcript-entry-caller' : 'transcript-entry-agent';
        const sentimentClass = getEntrySentimentClass(seg.sentiment);
        return (
          <div
            key={`${seg.resultId}-${seg.isPartial ? 'p' : 'f'}`}
            className={`transcript-entry ${channelClass} ${sentimentClass} ${seg.isPartial ? 'transcript-partial' : ''}`}
          >
            <div className="transcript-entry-header">
              <span className={`sentiment-dot ${getSentimentDot(seg.sentiment)}`} />
              <span className={`transcript-channel channel-${seg.channel.toLowerCase()}`}>
                {seg.channel}
              </span>
              <span className="transcript-time">
                {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
              </span>
            </div>
            <div className="transcript-entry-body">
              <span className="transcript-text">{seg.text}</span>
              {seg.issueDetected && (
                <span className="issue-badge">{'\u26A0'} Issue Detected</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
