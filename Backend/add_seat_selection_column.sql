-- Run once on your MySQL database so checkout can persist seat labels for history.
ALTER TABLE queue_history ADD COLUMN seat_selection TEXT NULL;
