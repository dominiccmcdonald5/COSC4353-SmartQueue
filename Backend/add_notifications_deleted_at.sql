-- Soft-delete for mailbox: inbox (deleted_at IS NULL) vs trash (deleted_at set).
-- Run once against your SmartQueue MySQL database.

ALTER TABLE notifications
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL
  AFTER status;

CREATE INDEX idx_notifications_user_deleted
  ON notifications (user_id, deleted_at);
