-- Migration: add checkout_batch_size to concerts table
-- This column controls how many people at the front of each concert's queue
-- can simultaneously proceed to the checkout/payment page.
-- Default of 5 preserves the previous hardcoded behavior.

ALTER TABLE concerts
  ADD COLUMN checkout_batch_size INT NOT NULL DEFAULT 5
  AFTER concert_status;
