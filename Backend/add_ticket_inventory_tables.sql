-- Run once on your MySQL database to persist purchased seats + standing tickets.
--
-- Seats are enforced unique per concert so two buyers can't purchase the same seat.
-- Standing tickets are stored in the SAME TABLE as pseudo-seats:
--   section='Standing', row_label='NOSEAT', seat_number='1','2','3',...
-- This keeps everything in `sold_seats`.

CREATE TABLE IF NOT EXISTS sold_seats (
  sold_seat_id INT NOT NULL AUTO_INCREMENT,
  concert_id INT NOT NULL,
  user_id INT NULL,
  history_id INT NULL,
  section VARCHAR(64) NOT NULL,
  row_label VARCHAR(16) NOT NULL,
  seat_number VARCHAR(16) NOT NULL,
  price DECIMAL(10,2) NULL,
  purchased_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sold_seat_id),
  UNIQUE KEY uniq_concert_seat (concert_id, section, row_label, seat_number),
  KEY idx_concert (concert_id),
  KEY idx_user (user_id)
);

-- If you previously created `standing_ticket_sales`, you can remove it (optional):
-- DROP TABLE IF EXISTS standing_ticket_sales;

-- If you already created sold_seats earlier (without price), run this once:
-- ALTER TABLE sold_seats ADD COLUMN price DECIMAL(10,2) NULL;
