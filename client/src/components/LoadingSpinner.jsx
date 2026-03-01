import React from 'react';

function ShimmerCard() {
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--color-border-light)',
    }}>
      <div className="skeleton" style={{ height: 200, borderRadius: 0 }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div className="skeleton" style={{ height: 24, width: '45%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: '75%', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div className="skeleton" style={{ height: 14, width: 50 }} />
          <div className="skeleton" style={{ height: 14, width: 50 }} />
          <div className="skeleton" style={{ height: 14, width: 60 }} />
        </div>
        <div className="skeleton" style={{ height: 24, width: 80, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 24,
      padding: '24px 0',
      animation: 'fadeIn 0.3s ease',
    }}>
      {[...Array(8)].map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}

export default LoadingSpinner;
