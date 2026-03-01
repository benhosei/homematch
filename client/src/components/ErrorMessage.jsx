import React from 'react';

function ErrorMessage({ message }) {
  return (
    <div
      style={{
        margin: '40px auto',
        maxWidth: 500,
        padding: '20px 24px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        color: '#991b1b',
        textAlign: 'center',
        fontSize: '0.95rem',
      }}
    >
      <strong>Error: </strong>
      {message}
    </div>
  );
}

export default ErrorMessage;
