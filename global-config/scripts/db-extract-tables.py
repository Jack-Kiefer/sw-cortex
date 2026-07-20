#!/usr/bin/env python3
"""db-extract-tables.py — pull the real base tables out of a SQL query.

Used by db-describe-first-guard.sh (PreToolUse). Reads the SQL from the QUERY env var,
prints one normalized base-table name per line. Kept as a standalone file (not an inline
heredoc) because backtick-bearing python nested inside a bash $(...) mis-parses.

Normalization matches db-record-described.sh: lowercased, quotes/backticks stripped, schema
qualifier dropped, and a leading serp_ removed so a describe on `stock_move` satisfies a query
on `serp_stock_move`. CTE names (WITH x AS (...)) and information_schema/pg_catalog are excluded.
"""
import os
import re

sql = os.environ.get("QUERY", "")

# Strip line/block comments and string literals so keywords inside them don't match.
sql = re.sub(r"--[^\n]*", " ", sql)
sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
sql = re.sub(r"'[^']*'", " ", sql)

low = sql.lower()

# CTE names defined by `WITH x AS (` or `, x AS (` — NOT real tables; subtract them.
cte = set()
for m in re.finditer(r"(?:\bwith\b|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(", low):
    cte.add(m.group(1))


def norm(t):
    t = t.strip().strip('`"').lower()
    if "." in t:
        t = t.split(".")[-1]          # drop schema qualifier
    if t.startswith("serp_"):
        t = t[len("serp_"):]          # dual-name normalization
    return t


tables = []
# Identifier following a table-introducing keyword. We capture only the table token; a
# trailing alias is naturally excluded.
pat = re.compile(
    r"\b(?:from|join|update|into|delete\s+from)\s+([`\"]?[a-z_][a-z0-9_.]*[`\"]?)",
    re.I,
)
for m in pat.finditer(low):
    raw = m.group(1)
    base = raw.strip('`"')
    if base in cte:
        continue
    if base.startswith("information_schema") or base.startswith("pg_catalog"):
        continue
    n = norm(raw)
    if n and n not in cte and n not in tables:
        tables.append(n)

print("\n".join(tables))
