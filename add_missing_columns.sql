-- เพิ่ม column ที่ขาดหายไปใน trades table
alter table public.trades
  add column if not exists balance    text,
  add column if not exists timeopen   text,
  add column if not exists timeclose  text;
