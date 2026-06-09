-- ============================================================
--  PipLog – Full Schema Reset
--  รัน SQL นี้ใน Supabase → SQL Editor
--  ⚠️  จะลบข้อมูลเก่าทั้งหมด
-- ============================================================

drop table if exists public.trades  cascade;
drop table if exists public.pairs   cascade;
drop table if exists public.setups  cascade;

-- TRADES (lowercase ทุก column ให้ตรงกับ JS mapper)
create table public.trades (
  id          bigserial    primary key,
  pair        text,
  direction   text,
  outcome     text,
  date        text,
  session     text,
  timeframe   text,
  entry       text,
  exit        text,
  sl          text,
  tp          text,
  lotsize     text,
  balance     text,
  pips        text,
  pnl         text,
  swap        text,
  commission  text,
  finalpnl    text,
  emotion     text,
  strategy    text,
  tags        jsonb        default '[]',
  chartimgs   jsonb        default '[]',
  note        text,
  notegood    text,
  notelesson  text,
  timeopen    text,
  timeclose   text,
  created_at  timestamptz  default now()
);

-- PAIRS
create table public.pairs (
  id          text  primary key,
  symbol      text  not null,
  description text  default ''
);

-- SETUPS
create table public.setups (
  id          text  primary key,
  name        text  not null,
  description text  default ''
);

-- RLS
alter table public.trades  enable row level security;
alter table public.pairs   enable row level security;
alter table public.setups  enable row level security;

create policy "anon select trades"  on public.trades for select to anon using (true);
create policy "anon insert trades"  on public.trades for insert to anon with check (true);
create policy "anon update trades"  on public.trades for update to anon using (true);
create policy "anon delete trades"  on public.trades for delete to anon using (true);

create policy "anon select pairs"   on public.pairs  for select to anon using (true);
create policy "anon insert pairs"   on public.pairs  for insert to anon with check (true);
create policy "anon update pairs"   on public.pairs  for update to anon using (true);
create policy "anon delete pairs"   on public.pairs  for delete to anon using (true);

create policy "anon select setups"  on public.setups for select to anon using (true);
create policy "anon insert setups"  on public.setups for insert to anon with check (true);
create policy "anon update setups"  on public.setups for update to anon using (true);
create policy "anon delete setups"  on public.setups for delete to anon using (true);
