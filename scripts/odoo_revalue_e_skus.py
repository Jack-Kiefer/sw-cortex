#!/usr/bin/env python3
"""
Revalue $0-valued -E SKUs in Odoo via the standard Product Revaluation wizard
(model: stock.valuation.layer.revaluation), over XML-RPC.

WHY THIS SCRIPT EXISTS
----------------------
The -E SKUs (branded Englewood variants) were created in May 2026 via inventory-
adjustment INCREASES while the -E product had no cost basis, so FIFO stamped every
inbound stock_valuation_layer at value=0. Editing the product Cost card afterward
does NOT revalue layers already on the books -- the Stock Valuation report sums
stock_valuation_layer.remaining_value, not standard_price. The ONLY supported lever
that both moves the Valuation report AND posts the offsetting journal entry is the
Product Revaluation wizard. This script drives that wizard, one product at a time.

It calls the EXACT same wizard the UI calls (Inventory > Reporting > Valuation >
expand product > teal "+"). Field names verified against live Odoo:
  product_id (req), added_value (req, monetary), account_id (Counterpart Account),
  account_journal_id (Journal), reason, date (Accounting Date).
Validate method: action_validate_revaluation.

The wizard, on validate:
  - creates a value-only stock_valuation_layer {quantity:0, value:added_value}
  - distributes added_value across the product's OPEN FIFO layers (remaining_value)
  - updates standard_price for the FIFO product
  - because category 74 is FIFO + real_time, posts an account_move:
        DEBIT  Stock Valuation (acct 110100, id 3)
        CREDIT account_id (the counterpart you choose)  via journal account_journal_id
  - raises UserError if any layer's remaining_value would go negative (safe guardrail)

USAGE
-----
  # 1. Dry run -- prints what WOULD happen, writes nothing:
  python3 odoo_revalue_e_skus.py --dry-run

  # 2. Test on ONE sku for real (recommended first live step):
  python3 odoo_revalue_e_skus.py --only SA-03-027-E

  # 3. After the single test verifies, run the whole batch:
  python3 odoo_revalue_e_skus.py --all

Set ODOO_URL / ODOO_DB / ODOO_USER / ODOO_PASSWORD in the env (or edit CONFIG).
NOTHING is written without --only or --all; --dry-run is implied otherwise.
"""

import argparse
import os
import sys
import xmlrpc.client

# --------------------------------------------------------------------------- #
# CONFIG -- fill these in (or export as env vars). Point at STAGING first.
# --------------------------------------------------------------------------- #
ODOO_URL = os.environ.get("ODOO_URL", "https://YOUR-ODOO-HOST")        # e.g. https://odoo.sugarwish.com
ODOO_DB = os.environ.get("ODOO_DB", "YOUR_DB_NAME")
ODOO_USER = os.environ.get("ODOO_USER", "your.user@sugarwish.com")
ODOO_PASSWORD = os.environ.get("ODOO_PASSWORD", "")                    # API key or password

# Accounting decision -- MUST be set by Carolyn / accounting before a live run.
# These are the offsetting (credit) side of the revaluation journal entry.
# Leave as None to force you to set them; the script refuses to post without them.
COUNTERPART_ACCOUNT_ID = None        # account.account id (the credit side). e.g. an inventory-adjustment / equity account
JOURNAL_ID = 6                       # account.journal id. 6 = STJ "Inventory Valuation" (Odoo default for stock)
REASON = "Revalue May-2026 -A->-E migration stock to matching -A FIFO cost"

# Cost source: how to price each -E unit.
#   "a_fifo"  -> use the matching -A SKU's current FIFO unit cost (remaining_value/remaining_qty)
#   "card"    -> use the -E product's own standard_price (the Cost card, e.g. $1.77 Erly set)
COST_SOURCE = "a_fifo"

ROUND_DP = 2                         # round added_value to N decimals for the monetary field


# --------------------------------------------------------------------------- #
def connect():
    """Authenticate and return (uid, models proxy)."""
    if "YOUR-ODOO-HOST" in ODOO_URL or not ODOO_PASSWORD:
        sys.exit("ERROR: set ODOO_URL / ODOO_DB / ODOO_USER / ODOO_PASSWORD (env or CONFIG). "
                 "Point at STAGING for the first test.")
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})
    if not uid:
        sys.exit("ERROR: authentication failed -- check ODOO_USER / ODOO_PASSWORD / ODOO_DB.")
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    return uid, models


def call(models, uid, model, method, *args, **kw):
    return models.execute_kw(ODOO_DB, uid, ODOO_PASSWORD, model, method, list(args), kw)


def fifo_unit_cost(models, uid, product_id):
    """Current FIFO unit cost from a product's OPEN inbound layers: rem_value / rem_qty."""
    layers = call(
        models, uid, "stock.valuation.layer", "read_group",
        [["product_id", "=", product_id]],
        ["remaining_qty:sum", "remaining_value:sum"],
        [],
    )
    if not layers:
        return None, 0.0, 0.0
    rq = layers[0].get("remaining_qty") or 0.0
    rv = layers[0].get("remaining_value") or 0.0
    if rq <= 0:
        return None, rq, rv
    return rv / rq, rq, rv


def find_pairs(models, uid, only=None):
    """Find active -E products with on-hand qty>0 valued at $0, plus their matching -A cost."""
    domain = [["default_code", "like", "%-E"], ["active", "=", True]]
    if only:
        domain = [["default_code", "=", only]]
    e_prods = call(models, uid, "product.product", "search_read", domain,
                   ["id", "default_code", "standard_price"])

    pairs = []
    for e in e_prods:
        code = e["default_code"]
        if not code or not code.endswith("-E"):
            continue
        # current -E on-hand
        e_cost, e_qty, e_val = fifo_unit_cost(models, uid, e["id"])
        if e_qty <= 0:
            continue  # nothing on hand to value

        # matching -A
        a_code = code[:-2] + "-A"
        a_prods = call(models, uid, "product.product", "search_read",
                       [["default_code", "=", a_code], ["active", "=", True]],
                       ["id", "standard_price"])
        a_unit = None
        a_pid = None
        if a_prods:
            a_pid = a_prods[0]["id"]
            a_unit, _, _ = fifo_unit_cost(models, uid, a_pid)

        # choose unit cost
        if COST_SOURCE == "a_fifo":
            unit = a_unit
        else:  # "card"
            unit = e["standard_price"]

        pairs.append({
            "e_code": code, "e_pid": e["id"], "e_onhand_qty": e_qty,
            "e_onhand_value": round(e_val, 2),
            "a_code": a_code, "a_pid": a_pid, "a_fifo_unit": a_unit,
            "e_card_cost": e["standard_price"],
            "unit_used": unit,
            "added_value": round(e_qty * unit, ROUND_DP) if unit else None,
        })
    return pairs


def revalue_one(models, uid, p):
    """Create + validate the revaluation wizard for one product. Returns layer id created."""
    vals = {
        "product_id": p["e_pid"],
        "added_value": p["added_value"],
        "account_journal_id": JOURNAL_ID,
        "reason": REASON,
    }
    if COUNTERPART_ACCOUNT_ID:
        vals["account_id"] = COUNTERPART_ACCOUNT_ID
    wiz_id = call(models, uid, "stock.valuation.layer.revaluation", "create", vals)
    call(models, uid, "stock.valuation.layer.revaluation", "action_validate_revaluation", [wiz_id])
    return wiz_id


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="print plan, write nothing (default)")
    g.add_argument("--only", metavar="SKU", help="revalue exactly one -E SKU, e.g. SA-03-027-E")
    g.add_argument("--all", action="store_true", help="revalue ALL on-hand $0 -E SKUs")
    args = ap.parse_args()

    live = bool(args.only or args.all)
    uid, models = connect()
    pairs = find_pairs(models, uid, only=args.only)

    # report
    print(f"\n{'SKU':<16}{'on-hand':>9}{'cur$':>8}  {'-A cost':>9}  {'added $':>10}  matching-A")
    print("-" * 78)
    total = 0.0
    missing = []
    for p in sorted(pairs, key=lambda x: -(x["added_value"] or 0)):
        if p["added_value"] is None:
            missing.append(p["e_code"])
            print(f"{p['e_code']:<16}{p['e_onhand_qty']:>9.0f}{p['e_onhand_value']:>8.2f}  "
                  f"{'(no -A)':>9}  {'SKIP':>10}  {p['a_code']}")
            continue
        total += p["added_value"]
        print(f"{p['e_code']:<16}{p['e_onhand_qty']:>9.0f}{p['e_onhand_value']:>8.2f}  "
              f"{(p['a_fifo_unit'] or 0):>9.4f}  {p['added_value']:>10.2f}  {p['a_code']}")
    print("-" * 78)
    print(f"{'TOTAL added value':<35}{total:>10.2f}   ({len(pairs)-len(missing)} SKUs"
          f"{', %d skipped (no -A cost)' % len(missing) if missing else ''})")
    if missing:
        print(f"  SKUs needing a manual cost: {', '.join(missing)}")

    if not live:
        print("\nDRY RUN -- nothing written. Re-run with --only SA-03-027-E to test one for real, "
              "then --all.\n")
        return

    if COUNTERPART_ACCOUNT_ID is None:
        sys.exit("\nREFUSING TO POST: COUNTERPART_ACCOUNT_ID is not set. "
                 "Get the counterpart (credit) account from accounting and set it in CONFIG.\n")

    todo = [p for p in pairs if p["added_value"]]
    if args.only:
        print(f"\n>>> LIVE: revaluing {args.only} ...")
    else:
        print(f"\n>>> LIVE: revaluing {len(todo)} SKUs, total ${total:.2f} ...")

    for p in todo:
        try:
            wid = revalue_one(models, uid, p)
            print(f"  OK  {p['e_code']}: +${p['added_value']:.2f}  (wizard id {wid})")
        except xmlrpc.client.Fault as e:
            print(f"  ERR {p['e_code']}: {e.faultString.strip().splitlines()[-1]}")
    print("\nDone. Verify in Inventory > Reporting > Valuation that each -E now shows value, "
          "and that the journal entries posted to the chosen counterpart account.\n")


if __name__ == "__main__":
    main()
