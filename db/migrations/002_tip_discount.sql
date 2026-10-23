-- Phase 1: tip, discount, item notes. Run AFTER db/schema.sql (D1 console or: npx wrangler d1 execute swagramam-orders --remote --file=db/migrations/002_tip_discount.sql)
-- Run once only. A second run fails with "duplicate column name": harmless, nothing changes.
ALTER TABLE orders ADD COLUMN tip_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN redeem_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN redeem_ref TEXT;
ALTER TABLE orders ADD COLUMN loyalty_status TEXT;
ALTER TABLE order_items ADD COLUMN note TEXT;
