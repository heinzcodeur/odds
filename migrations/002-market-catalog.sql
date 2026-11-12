-- Upgrade a database imported before the market catalog was introduced.
CREATE TABLE IF NOT EXISTS markets (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

INSERT INTO markets (id, name)
SELECT ranked.market_id, ranked.name
FROM (
  SELECT market_id, name, ROW_NUMBER() OVER (
    PARTITION BY market_id ORDER BY display_order IS NULL, match_id
  ) AS preference
  FROM match_markets
) AS ranked
LEFT JOIN markets m ON m.id=ranked.market_id
WHERE ranked.preference=1 AND m.id IS NULL;

ALTER TABLE match_markets
  CHANGE COLUMN name name_override VARCHAR(191) NULL,
  ADD CONSTRAINT fk_match_markets_market FOREIGN KEY (market_id) REFERENCES markets(id);

UPDATE match_markets mm JOIN markets m ON m.id=mm.market_id
SET mm.name_override=NULL
WHERE mm.name_override=m.name;
