'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const handleUnsubscribe = async () => {
    if (!email) {
      setStatus('error');
      setMessage('No email address provided.');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/unsubscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setMessage('You have been unsubscribed successfully.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to unsubscribe. Please try again.');
    }
  };

  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '50px auto', 
      padding: '40px', 
      textAlign: 'center',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Unsubscribe from emails</h1>
      
      {status === 'loading' && (
        <>
          <p>We're sorry to see you go. You'll no longer receive marketing emails.</p>
          {email && <p>Email: <strong>{email}</strong></p>}
          <button 
            onClick={handleUnsubscribe}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '14px 32px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Unsubscribe
          </button>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={{ fontSize: '64px', color: '#27ae60', marginBottom: '20px' }}>✓</div>
          <h2>You're unsubscribed</h2>
          <p>{message}</p>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '20px' }}>
            You'll still receive important account-related emails.
          </p>
          <a 
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '20px',
              color: '#4a90e2',
              textDecoration: 'none'
            }}
          >
            Return
          </a>
        </>
      )}
      
      {status === 'error' && (
        <>
          <p style={{ color: '#e74c3c', marginBottom: '20px' }}>{message}</p>
          <button 
            onClick={handleUnsubscribe}
            style={{
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              padding: '14px 32px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </>
      )}
    </div>
  );
}