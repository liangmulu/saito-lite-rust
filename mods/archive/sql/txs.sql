CREATE TABLE IF NOT EXISTS txs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx TEXT,
  UNIQUE (tx)
);
