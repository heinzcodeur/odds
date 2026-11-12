"""Produce a MySQL 8.0 import from the OddsBoost SQLite database."""
import argparse
import json
import math
import sqlite3
from contextlib import closing
from datetime import date, time
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parent


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and math.isfinite(value):
        # Scientific notation makes MySQL parse the value as DOUBLE.
        return format(value, ".17e")
    if isinstance(value, str):
        if not value:
            return "''"
        return f"CONVERT(X'{value.encode('utf-8').hex()}' USING utf8mb4)"
    raise ValueError(f"Unsupported SQLite value: {value!r}")


def insert(table, columns, records):
    column_list = ", ".join(f"`{column}`" for column in columns.split())
    return [
        f"INSERT INTO `{table}` ({column_list}) VALUES "
        f"({', '.join(map(sql_value, record))});"
        for record in records
    ]


def market_rows(db, settings):
    catalogs = {}
    for match in db.execute("SELECT id, markets_json FROM matches"):
        catalog = json.loads(match["markets_json"])
        if not isinstance(catalog, list):
            raise ValueError(f"Invalid market catalog for {match['id']}")
        catalogs[match["id"]] = catalog

    match_id = settings["selected_match_id"]
    selected_catalog = json.loads(settings["markets_json"])
    if not isinstance(selected_catalog, list):
        raise ValueError("Invalid selected market catalog")
    if not selected_catalog:
        selected_catalog = [{
            "id": "default",
            "name": settings["market"],
            "backOdds": settings["odds"],
            "layOdds": settings["lay_odds"],
        }]
    if catalogs[match_id] and catalogs[match_id] != selected_catalog:
        raise ValueError("The selected match and settings have different market catalogs")
    catalogs[match_id] = selected_catalog
    selected_market = next(
        (market for market in selected_catalog if market["id"] == settings["selected_market_id"]),
        selected_catalog[0],
    )
    if (selected_market["name"], selected_market["backOdds"], selected_market["layOdds"]) != (
        settings["market"], settings["odds"], settings["lay_odds"]
    ):
        raise ValueError("The selected market differs from the legacy quote in settings")

    markets = {}
    for match_id, catalog in catalogs.items():
        for display_order, market in enumerate(catalog):
            key = (match_id, market["id"])
            if key in markets:
                raise ValueError(f"Duplicate market: {key!r}")
            markets[key] = (market["name"], display_order, market["backOdds"], market["layOdds"])

    for position in db.execute("SELECT match_id, market_id, market_name FROM positions ORDER BY rowid"):
        key = (position["match_id"], position["market_id"])
        markets.setdefault(key, (position["market_name"], None, None, None))

    return [(*key, *values) for key, values in markets.items()], selected_market["id"]


def export_sql(db):
    versions = [row[0] for row in db.execute("SELECT version FROM schema_meta")]
    if versions != [7]:
        raise ValueError(f"Expected SQLite schema version 7, got {versions!r}")
    settings = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    match_markets, selected_market_id = market_rows(db, settings)
    markets = {}
    # Prefer a listed market to a label recovered from position history.
    for _, market_id, name, order, _, _ in sorted(
        match_markets, key=lambda row: (row[3] is None, row[0])
    ):
        markets.setdefault(market_id, name)
    match_markets = [
        (match_id, market_id, name if name != markets[market_id] else None, order, back_odds, lay_odds)
        for match_id, market_id, name, order, back_odds, lay_odds in match_markets
    ]
    matches = [
        (
            row["id"], row["home_team_id"], row["away_team_id"],
            date.fromisoformat(row["match_date"]).isoformat() if row["match_date"] else None,
            time.fromisoformat(row["match_time"]).isoformat() if row["match_time"] else None,
            row["created_at"],
        )
        for row in db.execute("SELECT * FROM matches ORDER BY rowid")
    ]
    statements = [
        "-- OddsBoost Pro Engine | MySQL 8.0.17+ | import into an empty database",
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,NO_ENGINE_SUBSTITUTION';",
        (MIGRATIONS / "mysql-schema.sql").read_text(encoding="utf-8").strip(),
        "START TRANSACTION;",
    ]
    statements += insert("teams", "id name created_at", db.execute(
        "SELECT id, name, created_at FROM team_entities ORDER BY rowid"
    ))
    statements += insert("matches", "id home_team_id away_team_id match_date match_time created_at", matches)
    statements += insert("markets", "id name", markets.items())
    statements += insert(
        "match_markets", "match_id market_id name_override display_order back_odds lay_odds", match_markets
    )
    statements += insert("position_categories", "id name family", db.execute(
        "SELECT id, name, family FROM position_categories ORDER BY rowid"
    ))
    statements += insert(
        "positions",
        "id bet_type entry_odds stake opened_at_label match_id market_id category_id "
        "market_name_snapshot match_name_snapshot match_date_snapshot match_time_snapshot "
        "closed_at_label exit_odds final_pnl",
        db.execute(
            """SELECT id, type, entry_odds, stake, timestamp, match_id, market_id, category_id,
                      market_name, match_name_snapshot, match_date_snapshot, match_time_snapshot,
                      closed_at, exit_odds, final_pnl
               FROM positions ORDER BY rowid"""
        ),
    )
    settings_columns = (
        "id bankroll elapsed_minutes seconds_left is_running bet_type entry_odds stake selected_match_id"
    )
    statements += insert("settings", settings_columns + " selected_market_id", [
        (*[settings[column] for column in settings_columns.split()], selected_market_id)
    ])
    return "\n".join([*statements, "COMMIT;", ""])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", type=Path, default=MIGRATIONS.parent / "data" / "odds.sqlite")
    args = parser.parse_args()
    with closing(sqlite3.connect(f"{args.source.resolve().as_uri()}?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute("BEGIN")
        sql = export_sql(db)
    with args.output.open("x", encoding="utf-8") as output:
        output.write(sql)


if __name__ == "__main__":
    main()
