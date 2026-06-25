# Revalue the -E SKUs the FIFO script SKIP'd, sourcing cost from the matching
# -A SKU's standard_price (not FIFO remaining_value/remaining_qty).
#
# Why this variant exists:
#   odoo_revalue_e_skus_shell.py reads the -A cost as
#       SUM(remaining_value) / SUM(remaining_qty)  over stock_valuation_layer
#   which returns None whenever the -A SKU's remaining_qty nets to <= 0. Five -E
#   SKUs were SKIP'd as "(no -A)" for exactly that reason -- their matching -A has
#   net-zero/negative remaining FIFO qty but a perfectly good standard_price.
#   This script copies that standard_price instead.
#
# Run in an Odoo shell (same env as the sibling script). Defaults to DRY_RUN.

DRY_RUN = True

# The 5 -E SKUs to fix. SA-51-118-E is intentionally EXCLUDED (no -A cost
# available). Add it here later only once SA-51-118-A's cost is confirmed.
TARGET_E_SKUS = [
    "RM-03-070-E",
    "RM-03-073-E",
    "RM-20-045-E",
    "RM-20-051-E",
    "SA-19-044-E",
]

COUNTERPART_ACCOUNT_ID = 25   # Cost of Goods Sold (same as the FIFO script)
JOURNAL_ID = 6
REASON = "Revalue May-2026 -A->-E migration stock to matching -A standard_price (FIFO unavailable)"
ROUND_DP = 2


def _onhand(prod):
    # Current valued on-hand from the valuation layers (qty side only).
    env.cr.execute(
        "SELECT COALESCE(SUM(quantity), 0) FROM stock_valuation_layer "
        "WHERE product_id = %s",
        (prod.id,),
    )
    (q,) = env.cr.fetchone()
    return float(q)


def _e_valued(prod):
    # Current valued amount of the -E (should be ~0; we only top up the gap).
    env.cr.execute(
        "SELECT COALESCE(SUM(remaining_value), 0) FROM stock_valuation_layer "
        "WHERE product_id = %s",
        (prod.id,),
    )
    (v,) = env.cr.fetchone()
    return float(v)


def _find_pairs():
    pairs = []
    for e_code in TARGET_E_SKUS:
        e = env["product.product"].search(
            [("default_code", "=", e_code)], limit=1
        )
        if not e:
            pairs.append({"e_code": e_code, "skip": "no -E product found"})
            continue

        a_code = e_code[:-2] + "-A"
        a = env["product.product"].search(
            [("default_code", "=", a_code), ("active", "=", True)], limit=1
        )
        if not a:
            pairs.append({"e_code": e_code, "a_code": a_code,
                          "skip": "no -A product found"})
            continue

        a_unit = float(a.standard_price or 0.0)
        e_qty = _onhand(e)
        e_val = _e_valued(e)

        if a_unit <= 0:
            pairs.append({"e_code": e_code, "a_code": a_code,
                          "skip": "-A standard_price is 0"})
            continue
        if e_qty <= 0:
            pairs.append({"e_code": e_code, "a_code": a_code,
                          "skip": "-E on-hand <= 0"})
            continue

        # Top up to (qty * -A standard_price) minus whatever is already valued.
        target_val = round(e_qty * a_unit, ROUND_DP)
        added = round(target_val - e_val, ROUND_DP)

        pairs.append({
            "e": e, "e_code": e_code, "a_code": a_code,
            "e_qty": e_qty, "e_val": round(e_val, 2),
            "a_unit": a_unit, "target_val": target_val, "added": added,
        })
    return pairs


def run():
    pairs = _find_pairs()

    print("\n%-16s%9s%9s  %9s  %11s  matching-A" %
          ("SKU", "on-hand", "cur$", "a_std$", "added $"))
    print("-" * 80)
    total = 0.0
    skipped = []
    todo = []
    for p in pairs:
        if p.get("skip"):
            skipped.append((p["e_code"], p["skip"]))
            print("%-16s%9s%9s  %9s  %11s  %s" %
                  (p["e_code"], "-", "-", "-", "SKIP", p["skip"]))
            continue
        if p["added"] <= 0:
            skipped.append((p["e_code"], "already valued (added <= 0)"))
            print("%-16s%9.0f%9.2f  %9.4f  %11s  %s" %
                  (p["e_code"], p["e_qty"], p["e_val"], p["a_unit"],
                   "NOOP", p["a_code"]))
            continue
        total += p["added"]
        todo.append(p)
        print("%-16s%9.0f%9.2f  %9.4f  %11.2f  %s" %
              (p["e_code"], p["e_qty"], p["e_val"], p["a_unit"],
               p["added"], p["a_code"]))
    print("-" * 80)
    print("%-34s%11.2f   (%d SKU(s))" % ("TOTAL added value", total, len(todo)))
    if skipped:
        print("  skipped: " + ", ".join("%s (%s)" % s for s in skipped))

    if DRY_RUN:
        print("\nDRY RUN -- nothing written. Review above, set DRY_RUN=False, re-run.\n")
        return

    if COUNTERPART_ACCOUNT_ID is None:
        print("\nREFUSING TO POST: COUNTERPART_ACCOUNT_ID is None.\n")
        return

    print("\n>>> LIVE: revaluing %d SKU(s), total $%.2f\n" % (len(todo), total))
    Wiz = env["stock.valuation.layer.revaluation"]
    posted = 0
    for p in todo:
        try:
            wiz = Wiz.with_context(default_product_id=p["e"].id).create({
                "company_id": env.company.id,
                "product_id": p["e"].id,
                "added_value": p["added"],
                "account_id": COUNTERPART_ACCOUNT_ID,
                "account_journal_id": JOURNAL_ID,
                "reason": REASON,
            })
            wiz.action_validate_revaluation()
            posted += 1
            print("  OK  %s: +$%.2f" % (p["e_code"], p["added"]))
        except Exception as e:
            print("  ERR %s: %s" % (p["e_code"], str(e).splitlines()[-1]))

    env.cr.commit()
    print("\nCommitted %d revaluation(s). Verify in Inventory > Reporting > "
          "Valuation, and check the journal entries posted to COGS.\n" % posted)


run()
