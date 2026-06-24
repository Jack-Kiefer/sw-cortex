DRY_RUN = False
ONLY_SKU = "SA-03-027-E"

COST_SOURCE = "a_fifo"

COUNTERPART_ACCOUNT_ID = 25
JOURNAL_ID = 6
REASON = "Revalue May-2026 -A->-E migration stock to matching -A FIFO cost"
ROUND_DP = 2


def _fifo_unit_cost(prod):
    layers = env["stock.valuation.layer"].search([("product_id", "=", prod.id)])
    rq = sum(layers.mapped("remaining_qty"))
    rv = sum(layers.mapped("remaining_value"))
    unit = (rv / rq) if rq else None
    return unit, rq, rv


def _find_pairs():
    if ONLY_SKU:
        e_prods = env["product.product"].search([("default_code", "=", ONLY_SKU)])
    else:
        e_prods = env["product.product"].search(
            [("default_code", "=like", "%-E"), ("active", "=", True)]
        )

    pairs = []
    for e in e_prods:
        code = e.default_code or ""
        if not code.endswith("-E"):
            continue
        e_unit, e_qty, e_val = _fifo_unit_cost(e)
        if e_qty <= 0:
            continue

        a_code = code[:-2] + "-A"
        a = env["product.product"].search(
            [("default_code", "=", a_code), ("active", "=", True)], limit=1
        )
        a_unit = None
        if a:
            a_unit, _, _ = _fifo_unit_cost(a)

        unit = a_unit if COST_SOURCE == "a_fifo" else e.standard_price
        pairs.append({
            "e": e, "e_code": code, "e_qty": e_qty, "e_val": round(e_val, 2),
            "a_code": a_code, "a_unit": a_unit, "e_card": e.standard_price,
            "unit": unit,
            "added": round(e_qty * unit, ROUND_DP) if unit else None,
        })
    return pairs


def _print_account_candidates():
    print("\nCandidate counterpart accounts (set COUNTERPART_ACCOUNT_ID to one of these):")
    accts = env["account.account"].search(
        ["|", "|",
         ("code", "in", ["110100"]),
         ("name", "ilike", "inventory"),
         ("name", "ilike", "stock")],
        limit=15,
    )
    for a in accts:
        print(f"    id={a.id:<6} {a.code:<10} {a.name}")
    j = env["account.journal"].browse(JOURNAL_ID)
    print(f"  Journal id={JOURNAL_ID}: {j.code} - {j.name}")


def run():
    pairs = _find_pairs()

    print("\n%-16s%9s%9s  %9s  %11s  matching-A" %
          ("SKU", "on-hand", "cur$", "unit", "added $"))
    print("-" * 80)
    total = 0.0
    missing = []
    for p in sorted(pairs, key=lambda x: -(x["added"] or 0)):
        if p["added"] is None:
            missing.append(p["e_code"])
            print("%-16s%9.0f%9.2f  %9s  %11s  %s" %
                  (p["e_code"], p["e_qty"], p["e_val"], "(no -A)", "SKIP", p["a_code"]))
            continue
        total += p["added"]
        print("%-16s%9.0f%9.2f  %9.4f  %11.2f  %s" %
              (p["e_code"], p["e_qty"], p["e_val"], (p["a_unit"] or 0), p["added"], p["a_code"]))
    print("-" * 80)
    n = len(pairs) - len(missing)
    print("%-34s%11.2f   (%d SKUs%s)" %
          ("TOTAL added value", total, n,
           (", %d skipped no -A cost" % len(missing)) if missing else ""))
    if missing:
        print("  needs manual cost: " + ", ".join(missing))

    if DRY_RUN:
        _print_account_candidates()
        print("\nDRY RUN -- nothing written. Review above, set COUNTERPART_ACCOUNT_ID, "
              "set DRY_RUN=False (keep ONLY_SKU for the first real one), re-run.\n")
        return

    if COUNTERPART_ACCOUNT_ID is None:
        print("\nREFUSING TO POST: COUNTERPART_ACCOUNT_ID is None. Pick one from the list "
              "(re-run with DRY_RUN=True to see candidates), then set it.\n")
        return

    todo = [p for p in pairs if p["added"]]
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
    print("\nCommitted %d revaluation(s). Verify in Inventory > Reporting > Valuation, "
          "and check the journal entries posted to the counterpart account.\n" % posted)


run()
