import React, { useEffect, useState } from 'react';

const URL  = 'https://snwyygvxshhbqwszbvgb.supabase.co/rest/v1';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNud3l5Z3Z4c2hoYnF3c3pidmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Njc4NDYsImV4cCI6MjA5NjQ0Mzg0Nn0.Ppj0mRH6We3Uad7m3cUqMXlyJf5d6TnWKoW36DJApCs';

export default function SupabaseStatus() {
  const [status, setStatus] = useState('checking...');
  const [color, setColor]   = useState('#aaa');

  useEffect(() => {
    fetch(`${URL}/trades?limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    }).then(async r => {
      if (r.ok) {
        setStatus(`✅ Connected (HTTP ${r.status})`);
        setColor('#4ade80');
      } else {
        const body = await r.text();
        setStatus(`❌ HTTP ${r.status}: ${body.slice(0, 120)}`);
        setColor('#f87171');
      }
    }).catch(e => {
      setStatus(`❌ Network error: ${e.message}`);
      setColor('#f87171');
    });
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', color, borderRadius: 8,
      padding: '6px 12px', fontSize: 12, fontFamily: 'monospace',
      maxWidth: 340, wordBreak: 'break-all',
    }}>
      Supabase: {status}
    </div>
  );
}
