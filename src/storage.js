// ============================================================
//  storage.js  –  Supabase REST API  (all columns lowercase)
// ============================================================

const SUPABASE_URL = 'https://snwyygvxshhbqwszbvgb.supabase.co/rest/v1';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNud3l5Z3Z4c2hoYnF3c3pidmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Njc4NDYsImV4cCI6MjA5NjQ0Mzg0Nn0.Ppj0mRH6We3Uad7m3cUqMXlyJf5d6TnWKoW36DJApCs';

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function req(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Supabase]', res.status, url, err);
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ── camelCase ↔ lowercase mappers ──────────────────────────

function toDb(trade) {
  // แปลง camelCase field → lowercase column ใน Postgres
  const t = { ...trade };
  if ('lotSize'    in t) { t.lotsize    = t.lotSize;    delete t.lotSize;    }
  if ('finalPnl'  in t) { t.finalpnl   = t.finalPnl;   delete t.finalPnl;   }
  if ('chartImgs' in t) { t.chartimgs  = t.chartImgs;  delete t.chartImgs;  }
  if ('chartImg'  in t) { delete t.chartImg; }          // legacy field
  if ('noteGood'  in t) { t.notegood   = t.noteGood;   delete t.noteGood;   }
  if ('noteLesson'in t) { t.notelesson = t.noteLesson;  delete t.noteLesson; }
  if ('timeOpen'  in t) { t.timeopen   = t.timeOpen;   delete t.timeOpen;   }
  if ('timeClose' in t) { t.timeclose  = t.timeClose;  delete t.timeClose;  }
  return t;
}

function fromDb(row) {
  // แปลง lowercase column → camelCase ใน JS
  if (!row) return null;
  const t = { ...row };
  if ('lotsize'    in t) { t.lotSize    = t.lotsize;    delete t.lotsize;    }
  if ('finalpnl'  in t) { t.finalPnl   = t.finalpnl;   delete t.finalpnl;   }
  if ('chartimgs' in t) { t.chartImgs  = t.chartimgs || []; delete t.chartimgs; }
  if ('notegood'  in t) { t.noteGood   = t.notegood;   delete t.notegood;   }
  if ('notelesson'in t) { t.noteLesson = t.notelesson;  delete t.notelesson; }
  if ('timeopen'  in t) { t.timeOpen   = t.timeopen;   delete t.timeopen;   }
  if ('timeclose' in t) { t.timeClose  = t.timeclose;  delete t.timeclose;  }
  return t;
}

// ============================================================
//  TRADES
// ============================================================

export async function getTrades() {
  const rows = await req('/trades?order=created_at.desc');
  return rows.map(fromDb);
}

export async function saveTrade(trade) {
  if (trade.id) {
    const { id, ...rest } = toDb(trade);
    const result = await req(`/trades?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(rest),
    });
    return fromDb(result[0]);
  } else {
    const { id: _id, ...rest } = toDb(trade); // strip undefined id
    const result = await req('/trades', {
      method: 'POST',
      body: JSON.stringify(rest),
    });
    return fromDb(result[0]);
  }
}

export async function deleteTrade(id) {
  await req(`/trades?id=eq.${id}`, { method: 'DELETE' });
}

export async function getTradeById(id) {
  const result = await req(`/trades?id=eq.${id}`);
  return fromDb(result[0]) || null;
}

// ============================================================
//  CURRENCY PAIRS
// ============================================================

const DEFAULT_PAIRS = [
  { id: 'EURUSD', symbol: 'EUR/USD', description: 'Euro / US Dollar' },
  { id: 'GBPUSD', symbol: 'GBP/USD', description: 'British Pound / US Dollar' },
  { id: 'USDJPY', symbol: 'USD/JPY', description: 'US Dollar / Japanese Yen' },
  { id: 'GBPJPY', symbol: 'GBP/JPY', description: 'British Pound / Japanese Yen' },
  { id: 'AUDUSD', symbol: 'AUD/USD', description: 'Australian Dollar / US Dollar' },
  { id: 'USDCHF', symbol: 'USD/CHF', description: 'US Dollar / Swiss Franc' },
  { id: 'EURCAD', symbol: 'EUR/CAD', description: 'Euro / Canadian Dollar' },
  { id: 'NZDUSD', symbol: 'NZD/USD', description: 'New Zealand Dollar / US Dollar' },
];

export async function getPairs() {
  try {
    const rows = await req('/pairs?order=symbol.asc');
    return rows.length ? rows : DEFAULT_PAIRS;
  } catch { return DEFAULT_PAIRS; }
}

export async function addPair(symbol, description = '') {
  const id = symbol.replace('/', '').toUpperCase();
  await req('/pairs', {
    method: 'POST',
    body: JSON.stringify({ id, symbol: symbol.toUpperCase(), description }),
  });
  return getPairs();
}

export async function deletePair(id) {
  await req(`/pairs?id=eq.${id}`, { method: 'DELETE' });
  return getPairs();
}

// ============================================================
//  SETUPS
// ============================================================

const DEFAULT_SETUPS = [
  { id: 'breakout',    name: 'Breakout',     description: 'Price breaks key level with momentum' },
  { id: 'trend_follow',name: 'Trend Follow', description: 'Trade in direction of established trend' },
  { id: 'reversal',    name: 'Reversal',     description: 'Counter-trend at key S/R levels' },
  { id: 'range',       name: 'Range Trade',  description: 'Buy low / sell high within range' },
  { id: 'news',        name: 'News Trade',   description: 'Fundamental event-driven trade' },
];

export async function getSetups() {
  try {
    const rows = await req('/setups?order=name.asc');
    return rows.length ? rows : DEFAULT_SETUPS;
  } catch { return DEFAULT_SETUPS; }
}

export async function addSetup(name, description = '') {
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  await req('/setups', {
    method: 'POST',
    body: JSON.stringify({ id, name, description }),
  });
  return getSetups();
}

export async function deleteSetup(id) {
  await req(`/setups?id=eq.${id}`, { method: 'DELETE' });
  return getSetups();
}

// ============================================================
//  STATS  (pure JS – no DB call)
// ============================================================

export function calcStats(trades) {
  const closed = trades.filter(t => t.outcome !== 'running');
  const wins   = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');

  const totalPnl = closed.reduce((s, t) => s + (parseFloat(t.finalPnl ?? t.pnl) || 0), 0);
  const totalPips = closed.reduce((s, t) => s + (parseFloat(t.pips) || 0), 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const avgWin  = wins.length   ? wins.reduce((s, t)   => s + (parseFloat(t.finalPnl ?? t.pnl) || 0), 0) / wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (parseFloat(t.finalPnl ?? t.pnl) || 0), 0) / losses.length : 0;
  const grossWin  = wins.reduce((s, t) => s + (parseFloat(t.finalPnl ?? t.pnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (parseFloat(t.finalPnl ?? t.pnl) || 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const rrArr = closed.filter(t => t.entry && t.sl && t.tp).map(t => {
    const e = parseFloat(t.entry), sl = parseFloat(t.sl), tp = parseFloat(t.tp);
    const risk = Math.abs(e - sl), reward = Math.abs(tp - e);
    return risk > 0 ? reward / risk : null;
  }).filter(Boolean);
  const avgRR = rrArr.length ? rrArr.reduce((a, b) => a + b, 0) / rrArr.length : 0;

  let peak = 0, dd = 0, running = 0;
  closed.forEach(t => {
    running += parseFloat(t.finalPnl ?? t.pnl) || 0;
    if (running > peak) peak = running;
    const cur = peak - running; if (cur > dd) dd = cur;
  });

  const byPair = {}, bySess = {}, byEmo = {};
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDay = {}; days.forEach(d => { byDay[d] = { day: d, trades: 0, pnl: 0 }; });

  closed.forEach(t => {
    if (t.pair) {
      if (!byPair[t.pair]) byPair[t.pair] = { pair: t.pair, trades: 0, wins: 0, pnl: 0 };
      byPair[t.pair].trades++; if (t.outcome === 'win') byPair[t.pair].wins++;
      byPair[t.pair].pnl += parseFloat(t.finalPnl ?? t.pnl) || 0;
    }
    const s = t.session || 'unknown';
    if (!bySess[s]) bySess[s] = { session: s, trades: 0, wins: 0, pnl: 0 };
    bySess[s].trades++; if (t.outcome === 'win') bySess[s].wins++;
    bySess[s].pnl += parseFloat(t.finalPnl ?? t.pnl) || 0;

    if (t.date) { const d = days[new Date(t.date).getDay()]; byDay[d].trades++; byDay[d].pnl += parseFloat(t.finalPnl ?? t.pnl) || 0; }

    const e = t.emotion || 'unknown';
    if (!byEmo[e]) byEmo[e] = { emotion: e, trades: 0, wins: 0, pnl: 0 };
    byEmo[e].trades++; if (t.outcome === 'win') byEmo[e].wins++;
    byEmo[e].pnl += parseFloat(t.finalPnl ?? t.pnl) || 0;
  });

  return {
    total: trades.length, closed: closed.length, wins: wins.length, losses: losses.length,
    totalPnl, totalPips, winRate, avgWin, avgLoss, profitFactor, avgRR, maxDrawdown: dd,
    byPair: Object.values(byPair).sort((a, b) => b.pnl - a.pnl),
    bySess: Object.values(bySess),
    byDay:  days.slice(1, 6).map(d => byDay[d]),
    byEmo:  Object.values(byEmo),
  };
}
