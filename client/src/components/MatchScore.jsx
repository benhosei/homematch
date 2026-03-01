import React from 'react';
import './MatchScore.css';

function MatchScore({ score, showBreakdown = false, breakdown }) {
  const colorClass =
    score >= 80 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low';

  return (
    <div className={`match-score ${colorClass}`}>
      <span className="score-value">{score}%</span>
      <span className="score-label">match</span>
      {showBreakdown && breakdown && (
        <div className="score-breakdown">
          <div className="breakdown-item">
            <span>Price</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${Math.round(breakdown.price)}%` }}
              />
            </div>
            <span>{Math.round(breakdown.price)}%</span>
          </div>
          <div className="breakdown-item">
            <span>Beds</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${Math.round(breakdown.beds)}%` }}
              />
            </div>
            <span>{Math.round(breakdown.beds)}%</span>
          </div>
          <div className="breakdown-item">
            <span>Baths</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${Math.round(breakdown.baths)}%` }}
              />
            </div>
            <span>{Math.round(breakdown.baths)}%</span>
          </div>
          <div className="breakdown-item">
            <span>Type</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{ width: `${Math.round(breakdown.propType)}%` }}
              />
            </div>
            <span>{Math.round(breakdown.propType)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchScore;
