import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saveTrade, getTradeById, getPairs, getSetups } from '../storage';

const TIMEFRAMES = ['M1','M5','M15','M30','H1','H4','D1','W1'];
const SESSIONS = ['london','new york','tokyo','sydney','overlap'];
const EMOTIONS = [
  { id: 'calm', label: 'calm', emoji: '😌' },
  { id: 'confident', label: 'confident', emoji: '💪' },
  { id: 'anxious', label: 'anxious', emoji: '😰' },
  { id: 'greedy', label: 'greedy', emoji: '🤑' },
  { id: 'revenge', label: 'revenge', emoji: '😤' },
];
const TAG_PRESETS = ['breakout','trend follow','reversal','range','news trade','london open','ny open','support/resistance','fibonacci','ema cross','double top','double bottom','head & shoulders'];
const OUTCOMES = ['win','loss','breakeven','running'];

function calcRR(entry, sl, tp) {
  const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp);
  if (!e || !s || !t) return null;
  const risk = Math.abs(e - s), reward = Math.abs(t - e);
  if (risk === 0) return null;
  return (reward / risk).toFixed(2);
}

function calcPips(entry, exit, pair) {
  const e = parseFloat(entry), x = parseFloat(exit);
  if (!e || !x) return null;
  const diff = Math.abs(x - e);
  const isJpy = pair && pair.includes('JPY');
  return (diff * (isJpy ? 100 : 10000)).toFixed(1);
}

function calcFinalPnl(pnl, swap, commission) {
  const p = parseFloat(pnl) || 0;
  const s = parseFloat(swap) || 0;
  const c = parseFloat(commission) || 0;
  return p + s - c;
}

/* ── Image Lightbox ── */
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 18, right: 22,
          background: 'rgba(255,255,255,0.12)', border: 'none',
          color: '#fff', fontSize: 22, borderRadius: '50%',
          width: 40, height: 40, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      {/* Counter */}
      {images.length > 1 && (
        <div style={{ position: 'absolute', top: 22, left: 22, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Prev arrow */}
      {idx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
          style={{
            position: 'absolute', left: 18, background: 'rgba(255,255,255,0.12)',
            border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
      )}

      {/* Image */}
      <img
        src={images[idx]}
        alt={`chart ${idx + 1}`}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh',
          borderRadius: 8, boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          objectFit: 'contain',
        }}
      />

      {/* Next arrow */}
      {idx < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
          style={{
            position: 'absolute', right: 18, background: 'rgba(255,255,255,0.12)',
            border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >›</button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 20,
          display: 'flex', gap: 8,
        }}>
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: 52, height: 36, objectFit: 'cover',
                borderRadius: 4, cursor: 'pointer',
                border: i === idx ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)',
                opacity: i === idx ? 1 : 0.55,
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddTrade() {
  const navigate = useNavigate();
  const { id } = useParams();
  const imgRef = useRef();
  const isEdit = Boolean(id);

  const [pairs, setPairs] = useState([]);
  const [setups, setSetups] = useState([]);

  const [form, setForm] = useState({
    pair: '', direction: 'buy', date: new Date().toISOString().slice(0,10),
    timeOpen: '', timeClose: '', timeframe: 'H4', session: 'london',
    entry: '', exit: '', sl: '', tp: '', lotSize: '', balance: '',
    outcome: '', emotion: 'calm', strategy: '',
    tags: [], note: '', noteGood: '', noteLesson: '',
    pnl: '', pips: '', chartImgs: [],
    swap: '', commission: '',
  });
  const [lightbox, setLightbox] = useState(null); // { index }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [loadedPairs, loadedSetups] = await Promise.all([getPairs(), getSetups()]);
      setPairs(loadedPairs);
      setSetups(loadedSetups);

      if (isEdit) {
        const t = await getTradeById(id);
        if (t) {
          // migrate old single chartImg → chartImgs array
          const imgs = t.chartImgs || (t.chartImg ? [t.chartImg] : []);
          setForm({ ...t, chartImgs: imgs });
        }
      } else {
        if (loadedPairs.length > 0) {
          setForm(f => ({ ...f, pair: loadedPairs[0].symbol }));
        }
      }
    }
    load().catch(console.error);
  }, [id, isEdit]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTag = (tag) => {
    set('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);
  };

  const handleImgs = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setForm(f => ({ ...f, chartImgs: [...f.chartImgs, ev.target.result] }));
      };
      reader.readAsDataURL(file);
    });
    // reset input so same file can be re-added
    e.target.value = '';
  };

  const removeImg = (idx) => {
    setForm(f => ({ ...f, chartImgs: f.chartImgs.filter((_, i) => i !== idx) }));
  };

  const validate = () => {
    const e = {};
    if (!form.pair) e.pair = 'กรุณาเลือก pair';
    if (!form.entry) e.entry = 'กรุณาใส่ราคา entry';
    if (!form.outcome) e.outcome = 'กรุณาเลือก outcome';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const pips = form.pips || (form.exit ? calcPips(form.entry, form.exit, form.pair) : '');
    const finalPnl = calcFinalPnl(form.pnl, form.swap, form.commission);
    try {
      await saveTrade({ ...form, pips, finalPnl: finalPnl.toFixed(2), id: isEdit ? id : undefined });
      navigate('/');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const rr = calcRR(form.entry, form.sl, form.tp);
  const autoPips = form.exit ? calcPips(form.entry, form.exit, form.pair) : null;
  const previewFinalPnl = calcFinalPnl(form.pnl, form.swap, form.commission);
  const hasPnlInputs = form.pnl !== '' || form.swap !== '' || form.commission !== '';

  return (
    <div className="page">
      {lightbox !== null && (
        <Lightbox
          images={form.chartImgs}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn" onClick={() => navigate(-1)}>← back</button>
          <h1>{isEdit ? 'edit trade' : 'new trade'}</h1>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'saving...' : '✓ save trade'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Trade Setup */}
          <div className="card">
            <div className="sec-title">trade setup</div>
            <div className="field">
              <label>
                currency pair
                <a href="/settings" onClick={e => { e.preventDefault(); navigate('/settings'); }}
                  style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
                  + จัดการ pairs
                </a>
              </label>
              <select value={form.pair} onChange={e => set('pair', e.target.value)}>
                {pairs.length === 0 && <option value="">— ยังไม่มี pair —</option>}
                {pairs.map(p => (
                  <option key={p.id} value={p.symbol}>{p.symbol}{p.description ? ` — ${p.description}` : ''}</option>
                ))}
              </select>
              {errors.pair && <div style={{ color: 'var(--red-dark)', fontSize: 11, marginTop: 3 }}>{errors.pair}</div>}
            </div>
            <div className="field">
              <label>direction</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['buy','sell'].map(d => (
                  <button key={d} onClick={() => set('direction', d)} style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius)',
                    border: '0.5px solid', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500,
                    borderColor: form.direction === d ? (d === 'buy' ? 'var(--green-mid)' : '#F0997B') : 'var(--border-mid)',
                    background: form.direction === d ? (d === 'buy' ? 'var(--green-light)' : 'var(--red-light)') : 'var(--surface)',
                    color: form.direction === d ? (d === 'buy' ? 'var(--green-dark)' : 'var(--red-dark)') : 'var(--text2)',
                  }}>
                    {d === 'buy' ? '↑ buy / long' : '↓ sell / short'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-row col2">
              <div className="field" style={{ margin: 0 }}>
                <label>date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>timeframe</label>
                <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                  {TIMEFRAMES.map(tf => <option key={tf}>{tf}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row col2" style={{ marginTop: 14 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>เวลาเปิด</label>
                <input type="time" value={form.timeOpen} onChange={e => set('timeOpen', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>เวลาปิด</label>
                <input type="time" value={form.timeClose} onChange={e => set('timeClose', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Price Levels */}
          <div className="card">
            <div className="sec-title">price levels</div>
            <div className="field-row col3">
              {[['entry','entry price'],['sl','stop loss'],['tp','take profit']].map(([k,lbl]) => (
                <div className="field" key={k} style={{ margin: 0 }}>
                  <label>{lbl}</label>
                  <input className="mono" type="number" step="any" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0.0000" />
                  {errors[k] && <div style={{ color: 'var(--red-dark)', fontSize: 11, marginTop: 3 }}>{errors[k]}</div>}
                </div>
              ))}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>exit price <span className="tiny">(ถ้าปิดแล้ว)</span></label>
              <input className="mono" type="number" step="any" value={form.exit} onChange={e => set('exit', e.target.value)} placeholder="0.0000" />
            </div>
            {(rr || autoPips) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {rr && (
                  <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tiny">risk : reward</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 500, color: parseFloat(rr) >= 1 ? 'var(--green-dark)' : 'var(--red-dark)' }}>1 : {rr}</span>
                  </div>
                )}
                {autoPips && (
                  <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tiny">pips</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{autoPips}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Position & Risk */}
          <div className="card">
            <div className="sec-title">position & risk</div>
            <div className="field-row col2">
              <div className="field" style={{ margin: 0 }}>
                <label>lot size</label>
                <input className="mono" type="number" step="0.01" value={form.lotSize} onChange={e => set('lotSize', e.target.value)} placeholder="0.10" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>P&L ($) <span className="tiny">gross</span></label>
                <input className="mono" type="number" step="any" value={form.pnl} onChange={e => set('pnl', e.target.value)} placeholder="+210" />
              </div>
            </div>
            <div className="field-row col2" style={{ marginTop: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Swap ($) <span className="tiny">+ รับ / - จ่าย</span></label>
                <input className="mono" type="number" step="any" value={form.swap} onChange={e => set('swap', e.target.value)} placeholder="-1.20" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Commission ($) <span className="tiny">ค่าธรรมเนียม</span></label>
                <input className="mono" type="number" step="any" value={form.commission} onChange={e => set('commission', e.target.value)} placeholder="3.50" />
              </div>
            </div>
            {hasPnlInputs && (
              <div style={{
                marginTop: 12,
                background: previewFinalPnl >= 0 ? 'var(--green-light)' : 'var(--red-light)',
                borderRadius: 'var(--radius)', padding: '12px 16px',
                border: `0.5px solid ${previewFinalPnl >= 0 ? 'var(--green-mid)' : '#F0997B'}`,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Final PnL = P&L + Swap − Commission
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                    {form.pnl || '0'} + {form.swap || '0'} − {form.commission || '0'}
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 600, fontFamily: 'var(--mono)',
                    color: previewFinalPnl >= 0 ? 'var(--green-dark)' : 'var(--red-dark)',
                  }}>
                    {previewFinalPnl >= 0 ? '+' : ''}{previewFinalPnl.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Outcome */}
          <div className="card">
            <div className="sec-title">outcome {errors.outcome && <span style={{ color: 'var(--red-dark)', fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— {errors.outcome}</span>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {OUTCOMES.map(o => (
                <button key={o} onClick={() => set('outcome', o)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 'var(--radius)',
                  border: '0.5px solid', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: form.outcome === o ? 500 : 400,
                  borderColor: form.outcome === o
                    ? o === 'win' ? 'var(--green-mid)' : o === 'loss' ? '#F0997B' : o === 'breakeven' ? 'var(--amber)' : 'var(--blue)'
                    : 'var(--border-mid)',
                  background: form.outcome === o
                    ? o === 'win' ? 'var(--green-light)' : o === 'loss' ? 'var(--red-light)' : o === 'breakeven' ? 'var(--amber-light)' : 'var(--blue-light)'
                    : 'var(--surface)',
                  color: form.outcome === o
                    ? o === 'win' ? 'var(--green-dark)' : o === 'loss' ? 'var(--red-dark)' : o === 'breakeven' ? '#633806' : 'var(--blue-dark)'
                    : 'var(--text2)',
                }}>
                  {o === 'win' ? '🏆 win' : o === 'loss' ? '✕ loss' : o === 'breakeven' ? '— b/e' : '⟳ running'}
                </button>
              ))}
            </div>
          </div>

          {/* Session */}
          <div className="card">
            <div className="sec-title">session</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SESSIONS.map(s => (
                <button key={s} onClick={() => set('session', s)} className={'tag-pill' + (form.session === s ? ' active' : '')}
                  style={{ background: form.session === s ? 'var(--blue-light)' : undefined, borderColor: form.session === s ? '#85B7EB' : undefined, color: form.session === s ? 'var(--blue-dark)' : undefined }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Chart Screenshots — multi-image */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="sec-title" style={{ margin: 0 }}>chart screenshots</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {form.chartImgs.length > 0 && (
                  <span className="tiny">{form.chartImgs.length} รูป · double click เพื่อดูใหญ่</span>
                )}
                <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => imgRef.current?.click()}>
                  + เพิ่มรูป
                </button>
              </div>
            </div>

            {form.chartImgs.length === 0 ? (
              <div onClick={() => imgRef.current?.click()} style={{
                border: '0.5px dashed var(--border-mid)', borderRadius: 'var(--radius)',
                padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--surface2)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>แนบรูป chart ก่อน/หลัง trade</div>
                <div className="tiny" style={{ marginTop: 4 }}>คลิกหรือเพิ่มได้หลายรูป · PNG, JPG, WEBP</div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: form.chartImgs.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: 8,
              }}>
                {form.chartImgs.map((src, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                    <img
                      src={src}
                      alt={`chart ${i + 1}`}
                      onDoubleClick={() => setLightbox(i)}
                      style={{
                        width: '100%',
                        height: form.chartImgs.length === 1 ? 200 : 130,
                        objectFit: 'cover',
                        cursor: 'zoom-in',
                        display: 'block',
                      }}
                    />
                    {/* Overlay hint on hover */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0)',
                      transition: 'background 0.15s',
                      fontSize: 11, color: '#fff', opacity: 0,
                    }}
                      className="img-overlay"
                    >
                      double click to expand
                    </div>
                    <button
                      onClick={() => removeImg(i)}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.55)', border: 'none',
                        color: '#fff', borderRadius: '50%',
                        width: 22, height: 22, cursor: 'pointer',
                        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >✕</button>
                    {form.chartImgs.length > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 5, left: 7,
                        background: 'rgba(0,0,0,0.45)', borderRadius: 3,
                        fontSize: 10, color: '#fff', padding: '1px 5px',
                      }}>
                        {i + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgs} />
          </div>

          {/* Strategy */}
          <div className="card">
            <div className="sec-title">strategy & setup</div>
            <div className="field">
              <label>
                strategy / setup
                <a href="/settings" onClick={e => { e.preventDefault(); navigate('/settings?tab=setups'); }}
                  style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
                  + จัดการ setups
                </a>
              </label>
              <select value={form.strategy} onChange={e => set('strategy', e.target.value)}>
                <option value="">— เลือก setup —</option>
                {setups.map(s => (
                  <option key={s.id} value={s.name}>{s.name}{s.description ? ` — ${s.description}` : ''}</option>
                ))}
                <option value="__custom__">custom (พิมพ์เอง)...</option>
              </select>
            </div>
            {form.strategy === '__custom__' && (
              <div className="field">
                <label>custom strategy</label>
                <input type="text" value={form.customStrategy || ''} onChange={e => set('customStrategy', e.target.value)} placeholder="EMA crossover, breakout H4..." />
              </div>
            )}
            {form.strategy && form.strategy !== '__custom__' && (() => {
              const found = setups.find(s => s.name === form.strategy);
              return found?.description ? (
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  {found.description}
                </div>
              ) : null;
            })()}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {TAG_PRESETS.map(tag => (
                  <span key={tag} className={'tag-pill' + (form.tags.includes(tag) ? ' active' : '')} onClick={() => toggleTag(tag)}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Emotion */}
          <div className="card">
            <div className="sec-title">สภาพจิตใจ</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {EMOTIONS.map(e => (
                <button key={e.id} onClick={() => set('emotion', e.id)} title={e.label} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 'var(--radius)',
                  border: '0.5px solid', cursor: 'pointer', fontSize: 20, textAlign: 'center',
                  borderColor: form.emotion === e.id ? 'var(--border-mid)' : 'var(--border)',
                  background: form.emotion === e.id ? 'var(--surface2)' : 'var(--surface)',
                }}>
                  {e.emoji}
                </button>
              ))}
            </div>
            <div className="tiny" style={{ marginTop: 8 }}>
              {EMOTIONS.find(e => e.id === form.emotion)?.emoji} {form.emotion}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="sec-title">note & บทเรียน</div>
            <div className="field">
              <label>เหตุผลที่เข้า trade</label>
              <textarea rows={3} value={form.note} onChange={e => set('note', e.target.value)} placeholder="เห็น breakout แท่งเทียน H4 พร้อม volume สูง, EMA 20 cross 50 ขึ้น..." />
            </div>
            <div className="field">
              <label>สิ่งที่ทำดี / ทำผิด</label>
              <textarea rows={3} value={form.noteGood} onChange={e => set('noteGood', e.target.value)} placeholder="ทำดี: รอ confirmation ก่อนเข้า&#10;ทำผิด: ไม่ได้ดู news calendar..." />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>บทเรียนสำหรับครั้งหน้า</label>
              <textarea rows={3} value={form.noteLesson} onChange={e => set('noteLesson', e.target.value)} placeholder="ควรดู high-impact news ก่อนเปิด position เสมอ..." />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn" onClick={() => navigate(-1)}>cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'saving...' : '✓ save trade'}
        </button>
      </div>
    </div>
  );
}
