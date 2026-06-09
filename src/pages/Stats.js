import React, { useState, useEffect } from 'react';
import { getTrades, calcStats } from '../storage';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';

const GREEN = '#1D9E75', RED = '#D85A30', AMBER = '#EF9F27', BLUE = '#378ADD';
const fmtUsd = (n) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(0);
const fmtPct = (n) => n.toFixed(1) + '%';

function KpiCard({ label, value, sub, pos }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val" style={{ color: pos === true ? 'var(--green-dark)' : pos === false ? 'var(--red-dark)' : 'var(--text)' }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border-mid)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: parseFloat(p.value) >= 0 ? GREEN : RED, fontWeight: 500, fontFamily: 'var(--mono)' }}>
          {prefix}{parseFloat(p.value) >= 0 ? '+' : ''}{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

// ── Consecutive streak calc ──────────────────────────────────────
function calcStreaks(trades) {
  const closed = [...trades]
    .filter(t => t.outcome === 'win' || t.outcome === 'loss')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let maxWin = 0, maxLoss = 0;
  let curWin = 0, curLoss = 0;
  let currentStreak = 0, currentStreakType = null;

  // streak history for chart (last 40 trades)
  const streakHistory = [];

  closed.forEach((t, i) => {
    const isWin = t.outcome === 'win';
    if (isWin) {
      curWin++; curLoss = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else {
      curLoss++; curWin = 0;
      if (curLoss > maxLoss) maxLoss = curLoss;
    }
    // running streak at this point
    if (i === 0) {
      currentStreak = 1;
      currentStreakType = t.outcome;
    } else {
      const prev = closed[i - 1];
      if (t.outcome === prev.outcome) {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentStreakType = t.outcome;
      }
    }
    streakHistory.push({
      idx: i + 1,
      date: t.date,
      outcome: t.outcome,
      streak: isWin ? currentStreak : -currentStreak,
    });
  });

  // current live streak (end of list)
  const last = closed[closed.length - 1];
  let liveStreak = 0, liveType = null;
  if (last) {
    liveType = last.outcome;
    for (let i = closed.length - 1; i >= 0; i--) {
      if (closed[i].outcome === liveType) liveStreak++;
      else break;
    }
  }

  return {
    maxWin, maxLoss,
    liveStreak, liveType,
    history: streakHistory.slice(-40),
  };
}

// ── Streak bar chart ─────────────────────────────────────────────
function StreakChart({ history }) {
  if (!history.length) return null;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={history} barSize={history.length > 20 ? 6 : 10}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="idx" tick={{ fontSize: 9, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={24} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border-mid)', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: 12 }}>
                <div style={{ color: 'var(--text2)', marginBottom: 2 }}>#{d.idx} · {d.date}</div>
                <div style={{ fontWeight: 500, color: d.outcome === 'win' ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                  {d.outcome} (streak {Math.abs(d.streak)})
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="streak" radius={[3, 3, 0, 0]}>
          {history.map((e, i) => (
            <Cell key={i} fill={e.streak > 0 ? GREEN : RED} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Stats() {
  const [trades, setTrades] = useState([]);
  const [period, setPeriod] = useState('1m');

  useEffect(() => { getTrades().then(setTrades).catch(console.error); }, []);

  const filterByPeriod = (ts) => {
    const now = new Date();
    const cutoff = period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : period === 'ytd'
      ? Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000) : 99999;
    if (cutoff === 99999) return ts;
    const cut = new Date(now - cutoff * 86400000);
    return ts.filter(t => t.date && new Date(t.date) >= cut);
  };

  const filtered = filterByPeriod(trades);
  const s = calcStats(filtered);
  const streaks = calcStreaks(filtered);

  const equityData = (() => {
    let cum = 0;
    return [...filtered].reverse()
      .filter(t => (t.finalPnl != null || t.pnl) && t.outcome !== 'running')
      .map(t => {
        cum += parseFloat(t.finalPnl ?? t.pnl) || 0;
        return { date: t.date, pnl: parseFloat(cum.toFixed(2)) };
      });
  })();

  const EMOTIONS = [
    { id: 'calm', emoji: '😌' }, { id: 'confident', emoji: '💪' },
    { id: 'anxious', emoji: '😰' }, { id: 'greedy', emoji: '🤑' }, { id: 'revenge', emoji: '😤' },
  ];
  const sessColors = [GREEN, '#5DCAA5', '#9FE1CB', BLUE, AMBER];

  if (filtered.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><h1>statistics</h1></div>
        <div className="empty">
          <div className="empty-icon">📊</div>
          <p>บันทึก trade อย่างน้อย 1 รายการเพื่อดูสถิติ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>statistics</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7d','1m','3m','ytd','all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className="btn" style={{
              padding: '5px 12px', fontSize: 12,
              background: period === p ? 'var(--surface2)' : 'var(--surface)',
              fontWeight: period === p ? 500 : 400,
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KpiCard label="total P&L" value={fmtUsd(s.totalPnl)} pos={s.totalPnl >= 0} sub={`${s.closed} closed trades`} />
        <KpiCard label="win rate" value={fmtPct(s.winRate)} sub={`${s.wins}W · ${s.losses}L`} />
        <KpiCard label="profit factor" value={isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'} pos={s.profitFactor >= 1.5 ? true : s.profitFactor < 1 ? false : undefined} sub="gross win / loss" />
        <KpiCard label="max drawdown" value={`-$${s.maxDrawdown.toFixed(0)}`} pos={false} sub="consecutive loss peak" />
      </div>
      {/* KPIs row 2 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: -14 }}>
        <KpiCard label="avg win" value={`+$${s.avgWin.toFixed(0)}`} pos={true} sub="per winning trade" />
        <KpiCard label="avg loss" value={`-$${Math.abs(s.avgLoss).toFixed(0)}`} pos={false} sub="per losing trade" />
        <KpiCard label="avg R:R" value={s.avgRR.toFixed(2)} pos={s.avgRR >= 1} sub="actual achieved" />
        <KpiCard label="total pips" value={(s.totalPips >= 0 ? '+' : '') + s.totalPips.toFixed(1)} pos={s.totalPips >= 0} sub={`avg ${(s.closed ? s.totalPips / s.closed : 0).toFixed(1)}/trade`} />
      </div>

      {/* ── Consecutive Streaks ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title" style={{ marginBottom: 14 }}>consecutive streaks</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {/* Max Win Streak */}
          <div style={{
            background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '14px 16px',
            border: '0.5px solid var(--green-mid)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--green-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, opacity: 0.7 }}>
              max win streak
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 600, color: 'var(--green-dark)', lineHeight: 1 }}>
              {streaks.maxWin}
            </div>
            <div style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 4, opacity: 0.65 }}>
              consecutive wins
            </div>
          </div>

          {/* Max Loss Streak */}
          <div style={{
            background: 'var(--red-light)', borderRadius: 'var(--radius)', padding: '14px 16px',
            border: '0.5px solid #F0997B',
          }}>
            <div style={{ fontSize: 11, color: 'var(--red-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, opacity: 0.7 }}>
              max loss streak
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 600, color: 'var(--red-dark)', lineHeight: 1 }}>
              {streaks.maxLoss}
            </div>
            <div style={{ fontSize: 11, color: 'var(--red-dark)', marginTop: 4, opacity: 0.65 }}>
              consecutive losses
            </div>
          </div>

          {/* Current / Live Streak */}
          <div style={{
            background: streaks.liveType === 'win' ? 'var(--green-light)' : streaks.liveType === 'loss' ? 'var(--red-light)' : 'var(--surface2)',
            borderRadius: 'var(--radius)', padding: '14px 16px',
            border: `0.5px solid ${streaks.liveType === 'win' ? 'var(--green-mid)' : streaks.liveType === 'loss' ? '#F0997B' : 'var(--border-mid)'}`,
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, opacity: 0.7,
              color: streaks.liveType === 'win' ? 'var(--green-dark)' : streaks.liveType === 'loss' ? 'var(--red-dark)' : 'var(--text2)' }}>
              current streak
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 600, lineHeight: 1,
              color: streaks.liveType === 'win' ? 'var(--green-dark)' : streaks.liveType === 'loss' ? 'var(--red-dark)' : 'var(--text)' }}>
              {streaks.liveStreak || '—'}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65,
              color: streaks.liveType === 'win' ? 'var(--green-dark)' : streaks.liveType === 'loss' ? 'var(--red-dark)' : 'var(--text2)' }}>
              {streaks.liveType ? `${streaks.liveType}s in a row` : 'no data'}
            </div>
          </div>
        </div>

        {/* Streak history chart */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>streak history (last {streaks.history.length} trades)</div>
          <StreakChart history={streaks.history} />
        </div>
      </div>

      {/* Equity Curve */}
      {equityData.length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-title" style={{ marginBottom: 14 }}>equity curve</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={equityData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={48} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip prefix="$" />} />
              <Line type="monotone" dataKey="pnl" stroke={GREEN} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {s.byPair.length > 0 && (
          <div className="card">
            <div className="sec-title" style={{ marginBottom: 14 }}>P&L by pair</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={s.byPair} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="pair" tick={{ fontSize: 11, fill: 'var(--text2)' }} tickLine={false} axisLine={false} width={58} />
                <Tooltip content={<CustomTooltip prefix="$" />} />
                <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                  {s.byPair.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {s.bySess.length > 0 && (
          <div className="card">
            <div className="sec-title" style={{ marginBottom: 14 }}>trades by session</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={s.bySess} dataKey="trades" nameKey="session" cx="50%" cy="50%" outerRadius={60}
                  label={({ session, percent }) => `${session} ${(percent*100).toFixed(0)}%`}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {s.bySess.map((e, i) => <Cell key={i} fill={sessColors[i % sessColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v + ' trades', n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {s.byPair.length > 0 && (
          <div className="card">
            <div className="sec-title" style={{ marginBottom: 12 }}>win rate by pair</div>
            {s.byPair.map(p => {
              const wr = p.trades ? (p.wins / p.trades) * 100 : 0;
              return (
                <div key={p.pair} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text)' }}>{p.pair}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: wr >= 50 ? 'var(--green-dark)' : 'var(--red-dark)', fontWeight: 500 }}>{wr.toFixed(0)}% <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({p.trades})</span></span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${wr}%`, background: wr >= 50 ? GREEN : RED, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {s.byDay.some(d => d.trades > 0) && (
          <div className="card">
            <div className="sec-title" style={{ marginBottom: 14 }}>P&L by day of week</div>
            {s.byDay.map(d => (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', width: 28 }}>{d.day}</span>
                <div style={{ flex: 1, height: 16, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                  {d.trades > 0 && (
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.min(100, Math.abs(d.pnl) / Math.max(...s.byDay.map(x => Math.abs(x.pnl))) * 100)}%`,
                      background: d.pnl >= 0 ? GREEN : RED,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: d.pnl >= 0 ? 'var(--green-dark)' : 'var(--red-dark)', width: 56, textAlign: 'right', fontWeight: 500 }}>
                  {d.trades > 0 ? fmtUsd(d.pnl) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {s.byEmo.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-title" style={{ marginBottom: 12 }}>สภาพจิตใจ vs ผลลัพธ์</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['emotion','trades','win rate','avg P&L'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: h === 'trades' || h === 'avg P&L' || h === 'win rate' ? 'right' : 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.byEmo.sort((a, b) => (b.wins / b.trades || 0) - (a.wins / a.trades || 0)).map(e => {
                  const wr = e.trades ? (e.wins / e.trades) * 100 : 0;
                  const avgP = e.trades ? e.pnl / e.trades : 0;
                  const emoInfo = EMOTIONS.find(x => x.id === e.emotion);
                  return (
                    <tr key={e.emotion} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{emoInfo?.emoji || '?'} {e.emotion}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)' }}>{e.trades}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500, color: wr >= 50 ? 'var(--green-dark)' : 'var(--red-dark)' }}>{wr.toFixed(0)}%</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500, color: avgP >= 0 ? 'var(--green-dark)' : 'var(--red-dark)' }}>{avgP >= 0 ? '+' : ''}${avgP.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {s.byPair.length > 0 && (() => {
        const insights = [];
        const worstPair = [...s.byPair].sort((a, b) => (a.wins / a.trades || 0) - (b.wins / b.trades || 0))[0];
        const bestPair = s.byPair[0];
        const worstDay = s.byDay.filter(d => d.trades > 0).sort((a, b) => a.pnl - b.pnl)[0];
        const revengeEmo = s.byEmo.find(e => e.emotion === 'revenge');

        if (worstPair && (worstPair.wins / worstPair.trades || 0) < 0.4)
          insights.push({ icon: '⚠️', text: `win rate ของ ${worstPair.pair} ต่ำเพียง ${((worstPair.wins / worstPair.trades || 0) * 100).toFixed(0)}% ลองหยุด trade pair นี้ก่อนสักสัปดาห์` });
        if (bestPair && bestPair.pnl > 0)
          insights.push({ icon: '💡', text: `${bestPair.pair} ทำกำไรได้ดีที่สุด +$${bestPair.pnl.toFixed(0)} — focus ที่ pair นี้ก่อน` });
        if (worstDay && worstDay.pnl < 0)
          insights.push({ icon: '📅', text: `วัน${worstDay.day}ขาดทุนบ่อยที่สุด ($${worstDay.pnl.toFixed(0)}) ลองหยุดพัก หรือ trade ขนาดเล็กลงวันนี้` });
        if (revengeEmo && revengeEmo.trades > 0 && (revengeEmo.wins / revengeEmo.trades) < 0.3)
          insights.push({ icon: '🚨', text: `Revenge trade มี win rate ${((revengeEmo.wins / revengeEmo.trades) * 100).toFixed(0)}% ทุกครั้งที่ mood เป็น 😤 ให้หยุดพักแทน` });
        if (streaks.maxLoss >= 4)
          insights.push({ icon: '🔥', text: `Max loss streak สูงถึง ${streaks.maxLoss} ครั้งติดกัน — พิจารณาตั้ง daily loss limit เพื่อป้องกัน` });
        if (streaks.liveType === 'loss' && streaks.liveStreak >= 3)
          insights.push({ icon: '⛔', text: `ขาดทุนติดกัน ${streaks.liveStreak} ครั้งแล้ว แนะนำหยุดพักก่อนแล้วค่อยกลับมา` });

        return insights.length > 0 ? (
          <div className="card">
            <div className="sec-title" style={{ marginBottom: 12 }}>✦ insights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 14px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>{ins.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
