import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrades, deleteTrade } from '../storage';

const fmt = (n) => {
  if (n == null || n === '') return '—';
  const v = parseFloat(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2);
};

const EMOTIONS = { calm:'😌', confident:'💪', anxious:'😰', greedy:'🤑', revenge:'😤' };

/* ── Lightbox ── */
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
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 22,
        background: 'rgba(255,255,255,0.12)', border: 'none',
        color: '#fff', fontSize: 22, borderRadius: '50%',
        width: 40, height: 40, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      {images.length > 1 && (
        <div style={{ position: 'absolute', top: 22, left: 22, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {idx > 0 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }} style={{
          position: 'absolute', left: 18, background: 'rgba(255,255,255,0.12)',
          border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%',
          width: 44, height: 44, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
      )}

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

      {idx < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }} style={{
          position: 'absolute', right: 18, background: 'rgba(255,255,255,0.12)',
          border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%',
          width: 44, height: 44, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      )}

      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 20, display: 'flex', gap: 8 }}>
          {images.map((src, i) => (
            <img key={i} src={src} alt="" onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: 52, height: 36, objectFit: 'cover', borderRadius: 4, cursor: 'pointer',
                border: i === idx ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)',
                opacity: i === idx ? 1 : 0.55, transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const navigate = useNavigate();
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState({ outcome: 'all', direction: 'all', pair: 'all' });
  const [detail, setDetail] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, index }

  useEffect(() => { getTrades().then(setTrades).catch(console.error); }, []);

  const pairs = [...new Set(trades.map(t => t.pair))].filter(Boolean);

  const filtered = trades.filter(t => {
    if (filter.outcome !== 'all' && t.outcome !== filter.outcome) return false;
    if (filter.direction !== 'all' && t.direction !== filter.direction) return false;
    if (filter.pair !== 'all' && t.pair !== filter.pair) return false;
    return true;
  });

  const handleDelete = async (id) => {
    if (!window.confirm('ลบ trade นี้?')) return;
    await deleteTrade(id);
    getTrades().then(setTrades).catch(console.error);
    if (detail?.id === id) setDetail(null);
  };

  const getPnl = (t) => t.finalPnl ?? t.pnl;
  // migrate old chartImg → chartImgs
  const getImgs = (t) => t.chartImgs || (t.chartImg ? [t.chartImg] : []);

  const totalPnl = filtered.reduce((s, t) => s + (parseFloat(getPnl(t)) || 0), 0);
  const wins = filtered.filter(t => t.outcome === 'win').length;
  const closed = filtered.filter(t => t.outcome !== 'running').length;

  return (
    <div className="page">
      {lightbox && (
        <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      <div className="page-header">
        <h1>journal</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{filtered.length} trades</span>
          {closed > 0 && <span style={{ fontSize: 13, color: 'var(--text2)' }}>·</span>}
          {closed > 0 && <span className={`mono ${totalPnl >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 13, fontWeight: 500 }}>{fmt(totalPnl)} USD</span>}
          {closed > 0 && <span style={{ fontSize: 13, color: 'var(--text2)' }}>· {Math.round((wins/closed)*100)}% WR</span>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'outcome', options: [['all','all outcomes'],['win','win'],['loss','loss'],['breakeven','breakeven'],['running','running']] },
          { key: 'direction', options: [['all','all directions'],['buy','buy'],['sell','sell']] },
        ].map(({ key, options }) => (
          <select key={key} value={filter[key]} onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-mid)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <select value={filter.pair} onChange={e => setFilter(f => ({ ...f, pair: e.target.value }))}
          style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-mid)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
          <option value="all">all pairs</option>
          {pairs.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <p>ยังไม่มี trade — กด "+ new trade" เพื่อเริ่มบันทึก</p>
        </div>
      ) : (
        <div style={{ display: detail ? 'grid' : 'block', gridTemplateColumns: detail ? '1fr 340px' : undefined, gap: 16 }}>
          {/* Trade List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 60 }} />
                <col /><col style={{ width: 70 }} /><col style={{ width: 70 }} />
                <col style={{ width: 80 }} /><col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['pair','date','dir','strategy','entry','exit','pips','Final P&L'].map(h => (
                    <th key={h} style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 16px', textAlign: h === 'Final P&L' || h === 'pips' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const displayPnl = getPnl(t);
                  return (
                    <tr key={t.id} onClick={() => setDetail(detail?.id === t.id ? null : t)}
                      style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', background: detail?.id === t.id ? 'var(--surface2)' : 'transparent', transition: 'background 0.1s' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>{t.pair}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 12 }}>{t.date}</td>
                      <td style={{ padding: '10px 16px' }}><span className={`badge badge-${t.direction}`}>{t.direction}</span></td>
                      <td style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.strategy || '—'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 12 }}>{t.entry || '—'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 12 }}>{t.exit || '—'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right', color: parseFloat(t.pips) >= 0 ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                        {t.pips ? `${parseFloat(t.pips) >= 0 ? '+' : ''}${t.pips}` : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right', fontWeight: 500, color: parseFloat(displayPnl) >= 0 ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                        {displayPnl ? fmt(displayPnl) : <span className={`badge badge-${t.outcome}`}>{t.outcome}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail Panel */}
          {detail && (() => {
            const imgs = getImgs(detail);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 16 }}>{detail.pair}</div>
                      <div className="tiny">{detail.date} · {detail.session}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`badge badge-${detail.direction}`}>{detail.direction}</span>
                      <span className={`badge badge-${detail.outcome}`}>{detail.outcome}</span>
                    </div>
                  </div>

                  {[
                    ['entry', detail.entry], ['exit', detail.exit],
                    ['stop loss', detail.sl], ['take profit', detail.tp],
                    ['lot size', detail.lotSize], ['timeframe', detail.timeframe],
                  ].map(([k, v]) => v ? (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{k}</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ) : null)}

                  {detail.pips && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>pips</span>
                      <span className={`mono ${parseFloat(detail.pips) >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 500, fontSize: 13 }}>
                        {parseFloat(detail.pips) >= 0 ? '+' : ''}{detail.pips}
                      </span>
                    </div>
                  )}

                  {detail.pnl && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text2)' }}>gross P&L</span>
                        <span className={`mono ${parseFloat(detail.pnl) >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 500, fontSize: 13 }}>{fmt(detail.pnl)}</span>
                      </div>
                      {detail.swap && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                          <span style={{ fontSize: 13, color: 'var(--text2)' }}>swap</span>
                          <span className={`mono ${parseFloat(detail.swap) >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 13 }}>{fmt(detail.swap)}</span>
                        </div>
                      )}
                      {detail.commission && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                          <span style={{ fontSize: 13, color: 'var(--text2)' }}>commission</span>
                          <span className="mono neg" style={{ fontSize: 13 }}>−{parseFloat(detail.commission).toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Final P&L</span>
                        <span className={`mono ${parseFloat(getPnl(detail)) >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600, fontSize: 18 }}>{fmt(getPnl(detail))} USD</span>
                      </div>
                    </>
                  )}

                  {detail.emotion && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)' }}>
                      {EMOTIONS[detail.emotion]} {detail.emotion}
                    </div>
                  )}
                </div>

                {/* Chart images in detail panel */}
                {imgs.length > 0 && (
                  <div className="card" style={{ padding: 8 }}>
                    <div className="tiny" style={{ marginBottom: 6, paddingLeft: 4 }}>
                      {imgs.length} รูป · double click เพื่อดูใหญ่
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: imgs.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                      gap: 6,
                    }}>
                      {imgs.map((src, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                          <img
                            src={src}
                            alt={`chart ${i + 1}`}
                            onDoubleClick={() => setLightbox({ images: imgs, index: i })}
                            style={{
                              width: '100%',
                              height: imgs.length === 1 ? 180 : 100,
                              objectFit: 'cover', display: 'block',
                              cursor: 'zoom-in',
                            }}
                          />
                          {imgs.length > 1 && (
                            <div style={{
                              position: 'absolute', bottom: 4, left: 5,
                              background: 'rgba(0,0,0,0.45)', borderRadius: 3,
                              fontSize: 10, color: '#fff', padding: '1px 5px',
                            }}>{i + 1}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(detail.note || detail.noteGood || detail.noteLesson) && (
                  <div className="card" style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {detail.note && <><div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>เหตุผลที่เข้า</div><p style={{ marginBottom: 10 }}>{detail.note}</p></>}
                    {detail.noteGood && <><div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>ทำดี / ผิด</div><p style={{ marginBottom: 10 }}>{detail.noteGood}</p></>}
                    {detail.noteLesson && <><div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>บทเรียน</div><p>{detail.noteLesson}</p></>}
                  </div>
                )}

                {detail.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detail.tags.map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => navigate(`/edit/${detail.id}`)}>✏ edit</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(detail.id)}>🗑 delete</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
