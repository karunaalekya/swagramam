-- Phase 2: redemptions (coupon, freebie, points). Run AFTER 002. Safe to run twice.
-- state: reserved (order created) -> committed (payment verified, or pay-at-pickup order placed) | released (payment failed, expired).
-- amount_minor: money off the bill (coupon, points). For a freebie it is the dish's menu value and is NOT deducted.
CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, phone TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('coupon','freebie','points')),
  ref TEXT, points INTEGER NOT NULL DEFAULT 0, amount_minor INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('reserved','committed','released')), ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS redemptions_order ON redemptions(order_id);
CREATE INDEX IF NOT EXISTS redemptions_phone ON redemptions(phone, state);
-- One use of a coupon or freebie per mobile number, enforced by the database so two simultaneous orders cannot both win.
CREATE UNIQUE INDEX IF NOT EXISTS redemptions_once ON redemptions(phone, ref) WHERE kind IN ('coupon','freebie') AND state IN ('reserved','committed');
