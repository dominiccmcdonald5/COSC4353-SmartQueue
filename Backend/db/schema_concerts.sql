-- Run once on your MySQL database (adjust types if needed).
-- Public + admin concert APIs expect this table shape.

CREATE TABLE IF NOT EXISTS concerts (
  concert_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  concert_name VARCHAR(200) NOT NULL,
  artist_name VARCHAR(50) NOT NULL,
  genre VARCHAR(80) NOT NULL,
  event_date DATETIME NOT NULL,
  venue VARCHAR(200) NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  ticket_price DECIMAL(10, 2) NOT NULL,
  concert_image VARCHAR(500) NOT NULL,
  concert_status ENUM('open', 'sold_out') NOT NULL DEFAULT 'open',
  PRIMARY KEY (concert_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: admin user dashboard extras (only if you want status / spend in DB)
-- ALTER TABLE users ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active';
-- ALTER TABLE users ADD COLUMN total_spent DECIMAL(10, 2) NOT NULL DEFAULT 0;
