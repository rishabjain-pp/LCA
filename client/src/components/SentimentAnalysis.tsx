import type { TranscriptSegment } from '../types';

interface SentimentAnalysisProps {
  segments: TranscriptSegment[];
}

export function SentimentAnalysis({ segments }: SentimentAnalysisProps) {
  const finalSegments = segments.filter(s => !s.isPartial && s.sentiment);

  const counts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
  for (const seg of finalSegments) {
    if (seg.sentiment) counts[seg.sentiment]++;
  }

  const total = finalSegments.length;

  const getPercent = (count: number) => total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="sentiment-card">
      <div className="sentiment-header">
        <div className="sentiment-title-group">
          <h3>Call Sentiment Analysis</h3>
          <span className="sentiment-info-link">Info</span>
        </div>
        <span className="sentiment-info">
          {total} segment{total !== 1 ? 's' : ''} analyzed
        </span>
      </div>

      {total === 0 ? (
        <div className="sentiment-empty">
          Waiting for transcript data...
        </div>
      ) : (
        <>
          <div className="sentiment-bar">
            {counts.POSITIVE > 0 && (
              <div
                className="sentiment-section sentiment-positive"
                style={{ width: `${getPercent(counts.POSITIVE)}%` }}
                title={`Positive: ${counts.POSITIVE}`}
              >
                {getPercent(counts.POSITIVE) > 10 && (
                  <span className="sentiment-percent-label">
                    {Math.round(getPercent(counts.POSITIVE))}%
                  </span>
                )}
              </div>
            )}
            {counts.NEUTRAL > 0 && (
              <div
                className="sentiment-section sentiment-neutral"
                style={{ width: `${getPercent(counts.NEUTRAL)}%` }}
                title={`Neutral: ${counts.NEUTRAL}`}
              >
                {getPercent(counts.NEUTRAL) > 10 && (
                  <span className="sentiment-percent-label">
                    {Math.round(getPercent(counts.NEUTRAL))}%
                  </span>
                )}
              </div>
            )}
            {counts.MIXED > 0 && (
              <div
                className="sentiment-section sentiment-mixed"
                style={{ width: `${getPercent(counts.MIXED)}%` }}
                title={`Mixed: ${counts.MIXED}`}
              >
                {getPercent(counts.MIXED) > 10 && (
                  <span className="sentiment-percent-label">
                    {Math.round(getPercent(counts.MIXED))}%
                  </span>
                )}
              </div>
            )}
            {counts.NEGATIVE > 0 && (
              <div
                className="sentiment-section sentiment-negative"
                style={{ width: `${getPercent(counts.NEGATIVE)}%` }}
                title={`Negative: ${counts.NEGATIVE}`}
              >
                {getPercent(counts.NEGATIVE) > 10 && (
                  <span className="sentiment-percent-label">
                    {Math.round(getPercent(counts.NEGATIVE))}%
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="sentiment-legend">
            <div className="sentiment-legend-item">
              <span className="legend-dot sentiment-positive" />
              <span>Positive ({counts.POSITIVE})</span>
            </div>
            <div className="sentiment-legend-item">
              <span className="legend-dot sentiment-neutral" />
              <span>Neutral ({counts.NEUTRAL})</span>
            </div>
            <div className="sentiment-legend-item">
              <span className="legend-dot sentiment-mixed" />
              <span>Mixed ({counts.MIXED})</span>
            </div>
            <div className="sentiment-legend-item">
              <span className="legend-dot sentiment-negative" />
              <span>Negative ({counts.NEGATIVE})</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
