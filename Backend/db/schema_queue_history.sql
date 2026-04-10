-- Optional: queue / ticket history for admin data report (revenue, wait time, monthly trend).
-- If this table does not exist, the report still works; those metrics are zero / empty.

CREATE TABLE IF NOT EXISTS queue_history (
  history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  concert_id INT UNSIGNED NOT NULL,
  ticket_count INT UNSIGNED NOT NULL DEFAULT 1,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  wait_time INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'minutes or seconds; report uses AVG as minutes',
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  in_line_status VARCHAR(32) NULL,
  queued_at DATETIME NULL,
  PRIMARY KEY (history_id),
  KEY idx_queue_history_user (user_id),
  KEY idx_queue_history_concert (concert_id),
  KEY idx_queue_history_status_queued (status, queued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
