CREATE TABLE teams (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE matches (
  id VARCHAR(80) PRIMARY KEY,
  home_team_id VARCHAR(191) NOT NULL,
  away_team_id VARCHAR(191) NOT NULL,
  match_date DATE,
  match_time TIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE markets (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE match_markets (
  match_id VARCHAR(80) NOT NULL,
  market_id VARCHAR(191) NOT NULL,
  name_override VARCHAR(191),
  display_order INT UNSIGNED,
  back_odds DOUBLE,
  lay_odds DOUBLE,
  PRIMARY KEY (match_id, market_id),
  UNIQUE (match_id, display_order),
  FOREIGN KEY (match_id) REFERENCES matches(id),
  CONSTRAINT fk_match_markets_market FOREIGN KEY (market_id) REFERENCES markets(id),
  CHECK (
    (display_order IS NULL AND back_odds IS NULL AND lay_odds IS NULL)
    OR (display_order IS NOT NULL AND back_odds IS NOT NULL AND lay_odds IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE position_categories (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  family VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE positions (
  `sequence` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id VARCHAR(191) NOT NULL UNIQUE,
  bet_type ENUM('BACK','LAY') NOT NULL,
  entry_odds DOUBLE NOT NULL,
  stake DOUBLE NOT NULL,
  opened_at_label TEXT NOT NULL,
  match_id VARCHAR(80) NOT NULL,
  market_id VARCHAR(191) NOT NULL,
  category_id VARCHAR(80) NOT NULL,
  market_name_snapshot VARCHAR(80) NOT NULL,
  match_name_snapshot VARCHAR(130) NOT NULL,
  match_date_snapshot VARCHAR(30) NOT NULL,
  match_time_snapshot VARCHAR(10) NOT NULL,
  closed_at_label TEXT,
  exit_odds DOUBLE,
  final_pnl DOUBLE,
  FOREIGN KEY (match_id, market_id) REFERENCES match_markets(match_id, market_id),
  FOREIGN KEY (category_id) REFERENCES position_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE settings (
  id TINYINT PRIMARY KEY CHECK (id = 1),
  bankroll DOUBLE NOT NULL,
  elapsed_minutes DOUBLE NOT NULL,
  seconds_left INT NOT NULL,
  is_running BOOLEAN NOT NULL,
  bet_type ENUM('BACK','LAY') NOT NULL,
  entry_odds DOUBLE NOT NULL,
  stake DOUBLE NOT NULL,
  selected_match_id VARCHAR(80) NOT NULL,
  selected_market_id VARCHAR(191) NOT NULL,
  FOREIGN KEY (selected_match_id, selected_market_id) REFERENCES match_markets(match_id, market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
