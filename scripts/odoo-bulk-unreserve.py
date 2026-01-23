# Odoo Bulk Unreserve Script
# Run this in Odoo.sh shell: odoo-bin shell
# Then paste this entire script

# ==============================================
# STEP 1: Define target
# ==============================================

cutoff_date = '2024-01-01'

stuck_moves = env['stock.move'].search([
    ('state', 'in', ['assigned', 'confirmed', 'waiting', 'partially_available']),
    ('date', '<', cutoff_date),
    ('sale_line_id', '!=', False),
])

print(f"\nFound {len(stuck_moves)} stuck moves before {cutoff_date}")

product_ids = stuck_moves.mapped('product_id').ids
products = env['product.product'].browse(product_ids)

print(f"Affecting {len(products)} unique products\n")

# ==============================================
# STEP 2: BEFORE snapshot
# ==============================================

print("=" * 80)
print("BEFORE UNRESERVE - Top 20 affected products:")
print("=" * 80)
print(f"{'SKU':<30} {'On Hand':>12} {'Reserved':>12} {'Available':>12} {'Stuck Moves':>12}")
print("-" * 80)

before_state = {}
for prod in products[:20]:
    quants = env['stock.quant'].search([
        ('product_id', '=', prod.id),
        ('location_id.usage', '=', 'internal')
    ])
    on_hand = sum(quants.mapped('quantity'))
    reserved = sum(quants.mapped('reserved_quantity'))
    available = on_hand - reserved
    prod_stuck = len(stuck_moves.filtered(lambda m: m.product_id.id == prod.id))

    before_state[prod.id] = {
        'sku': prod.default_code,
        'on_hand': on_hand,
        'reserved': reserved,
        'available': available,
        'stuck_moves': prod_stuck
    }

    print(f"{(prod.default_code or 'N/A'):<30} {on_hand:>12.0f} {reserved:>12.0f} {available:>12.0f} {prod_stuck:>12}")

print("\n" + "=" * 80)
print("REVIEW ABOVE. To proceed with unreserve, set DO_UNRESERVE = True and re-run")
print("=" * 80)

# ==============================================
# STEP 3: UNRESERVE (set to True to execute)
# ==============================================

DO_UNRESERVE = True  # <-- Change to True after reviewing

if DO_UNRESERVE:
    print("\nUnreserving...")
    pickings = stuck_moves.mapped('picking_id')
    print(f"Processing {len(pickings)} pickings...")

    # Process in batches to avoid timeout
    batch_size = 100
    total = len(pickings)
    for i in range(0, total, batch_size):
        batch = pickings[i:i+batch_size]
        batch.do_unreserve()
        print(f"  Processed {min(i+batch_size, total)}/{total}")

    env.cr.commit()
    print("\n✓ Unreserve complete!")

    # ==============================================
    # STEP 4: AFTER snapshot
    # ==============================================

    print("\n" + "=" * 80)
    print("AFTER UNRESERVE:")
    print("=" * 80)
    print(f"{'SKU':<30} {'On Hand':>12} {'Reserved':>12} {'Available':>12} {'Delta':>12}")
    print("-" * 80)

    for prod_id, before in before_state.items():
        quants = env['stock.quant'].search([
            ('product_id', '=', prod_id),
            ('location_id.usage', '=', 'internal')
        ])
        on_hand = sum(quants.mapped('quantity'))
        reserved = sum(quants.mapped('reserved_quantity'))
        available = on_hand - reserved
        delta = available - before['available']

        print(f"{(before['sku'] or 'N/A'):<30} {on_hand:>12.0f} {reserved:>12.0f} {available:>12.0f} {delta:>+12.0f}")

    print("\n✓ Done! Available inventory increased by the delta shown.")
else:
    print("\nDO_UNRESERVE is False - no changes made.")
    print("To execute: change DO_UNRESERVE = True and paste script again.")
