import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPairs, addPair, deletePair, getSetups, addSetup, deleteSetup } from '../storage';

export default function Settings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pairs');

  const [pairs, setPairs] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newPairDesc, setNewPairDesc] = useState('');
  const [pairError, setPairError] = useState('');

  const [setups, setSetups] = useState([]);
  const [newSetupName, setNewSetupName] = useState('');
  const [newSetupDesc, setNewSetupDesc] = useState('');
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    getPairs().then(setPairs).catch(console.error);
    getSetups().then(setSetups).catch(console.error);
  }, []);

  const handleAddPair = async () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) { setPairError('กรุณาใส่ชื่อ pair'); return; }
    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(sym)) { setPairError('รูปแบบต้องเป็น XXX/XXX เช่น EUR/USD'); return; }
    if (pairs.find(p => p.symbol === sym)) { setPairError('Pair นี้มีอยู่แล้ว'); return; }
    const updated = await addPair(sym, newPairDesc.trim());
    setPairs(updated);
    setNewSymbol('');
    setNewPairDesc('');
    setPairError('');
  };

  const handleDeletePair = async (id) => {
    if (!window.confirm('ลบ pair นี้?')) return;
    setPairs(await deletePair(id));
  };

  const handleAddSetup = async () => {
    const name = newSetupName.trim();
    if (!name) { setSetupError('กรุณาใส่ชื่อ setup'); return; }
    if (setups.find(s => s.name.toLowerCase() === name.toLowerCase())) { setSetupError('Setup นี้มีอยู่แล้ว'); return; }
    const updated = await addSetup(name, newSetupDesc.trim());
    setSetups(updated);
    setNewSetupName('');
    setNewSetupDesc('');
    setSetupError('');
  };

  const handleDeleteSetup = async (id) => {
    if (!window.confirm('ลบ setup นี้?')) return;
    setSetups(await deleteSetup(id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn" onClick={() => navigate(-1)}>← back</button>
          <h1>settings</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'pairs', label: '💱 Currency Pairs' },
          { key: 'setups', label: '🎯 Strategies & Setups' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', fontSize: 13, fontFamily: 'var(--font)', cursor: 'pointer',
            border: 'none', borderBottom: tab === t.key ? '2px solid var(--green)' : '2px solid transparent',
            background: 'none', color: tab === t.key ? 'var(--text)' : 'var(--text2)', fontWeight: tab === t.key ? 500 : 400,
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PAIRS TAB */}
      {tab === 'pairs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Add form */}
          <div className="card">
            <div className="sec-title">เพิ่ม Currency Pair ใหม่</div>
            <div className="field">
              <label>symbol <span className="tiny">เช่น EUR/USD</span></label>
              <input
                type="text"
                value={newSymbol}
                onChange={e => { setNewSymbol(e.target.value.toUpperCase()); setPairError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddPair()}
                placeholder="EUR/USD"
                style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase' }}
              />
            </div>
            <div className="field">
              <label>คำอธิบาย <span className="tiny">(ไม่จำเป็น)</span></label>
              <input
                type="text"
                value={newPairDesc}
                onChange={e => setNewPairDesc(e.target.value)}
                placeholder="Euro / US Dollar"
              />
            </div>
            {pairError && <div style={{ color: 'var(--red-dark)', fontSize: 12, marginBottom: 10 }}>⚠ {pairError}</div>}
            <button className="btn btn-primary" onClick={handleAddPair} style={{ width: '100%' }}>
              + เพิ่ม Pair
            </button>
          </div>

          {/* List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sec-title" style={{ margin: 0 }}>Pairs ที่มีอยู่</span>
              <span className="tiny">{pairs.length} pairs</span>
            </div>
            {pairs.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}><p>ยังไม่มี pair</p></div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {pairs.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '0.5px solid var(--border)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 14 }}>{p.symbol}</div>
                      {p.description && <div className="tiny" style={{ marginTop: 2 }}>{p.description}</div>}
                    </div>
                    <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleDeletePair(p.id)}>ลบ</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETUPS TAB */}
      {tab === 'setups' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Add form */}
          <div className="card">
            <div className="sec-title">เพิ่ม Strategy / Setup ใหม่</div>
            <div className="field">
              <label>ชื่อ setup</label>
              <input
                type="text"
                value={newSetupName}
                onChange={e => { setNewSetupName(e.target.value); setSetupError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddSetup()}
                placeholder="EMA Crossover"
              />
            </div>
            <div className="field">
              <label>คำอธิบาย <span className="tiny">(ไม่จำเป็น)</span></label>
              <textarea
                rows={3}
                value={newSetupDesc}
                onChange={e => setNewSetupDesc(e.target.value)}
                placeholder="อธิบาย setup นี้..."
              />
            </div>
            {setupError && <div style={{ color: 'var(--red-dark)', fontSize: 12, marginBottom: 10 }}>⚠ {setupError}</div>}
            <button className="btn btn-primary" onClick={handleAddSetup} style={{ width: '100%' }}>
              + เพิ่ม Setup
            </button>
          </div>

          {/* List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sec-title" style={{ margin: 0 }}>Setups ที่มีอยู่</span>
              <span className="tiny">{setups.length} setups</span>
            </div>
            {setups.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}><p>ยังไม่มี setup</p></div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {setups.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 20px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
                      {s.description && <div className="tiny" style={{ marginTop: 3, lineHeight: 1.5 }}>{s.description}</div>}
                    </div>
                    <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => handleDeleteSetup(s.id)}>ลบ</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
