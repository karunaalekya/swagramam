-- Swagramam ordering schema (Cloudflare D1 / SQLite). Money = integer paise. Times = unix ms.
CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY, name TEXT, email TEXT,
  member INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, noshows INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, phone TEXT NOT NULL, name TEXT, email TEXT,
  state TEXT NOT NULL, pay_method TEXT NOT NULL CHECK (pay_method IN ('payu','cod')),
  slot_date TEXT NOT NULL, slot_time TEXT NOT NULL, meal TEXT NOT NULL, note TEXT,
  subtotal_minor INTEGER NOT NULL, tax_minor INTEGER NOT NULL, total_minor INTEGER NOT NULL,
  gst_bp INTEGER NOT NULL, gst_assumed INTEGER NOT NULL DEFAULT 1,
  points_to_earn INTEGER NOT NULL DEFAULT 0, points_credit_path TEXT,
  token_nonce TEXT UNIQUE, flag TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone, created_at);
CREATE INDEX IF NOT EXISTS orders_slot ON orders(slot_date, slot_time);
CREATE INDEX IF NOT EXISTS orders_state ON orders(state, created_at);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL,
  qty INTEGER NOT NULL, unit_minor INTEGER NOT NULL, line_minor INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, order_id TEXT, kind TEXT NOT NULL, granted INTEGER NOT NULL,
  wording_version TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, provider TEXT NOT NULL, txnid TEXT NOT NULL,
  status TEXT NOT NULL, amount_minor INTEGER, mihpayid TEXT, raw TEXT, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS payments_txn ON payments(txnid, provider);
CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS loyalty_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, order_id TEXT NOT NULL, type TEXT NOT NULL,
  points INTEGER NOT NULL, path TEXT NOT NULL, ts INTEGER NOT NULL, UNIQUE (order_id, type));
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, kind TEXT NOT NULL, data TEXT, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_order ON events(order_id, ts);
