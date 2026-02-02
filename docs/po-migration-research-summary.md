# PO System Standalone Migration - Research Summary

## Date

February 2, 2026

## Overview

Comprehensive research completed on the standalone PO system migration from Odoo to Laravel. Key findings confirm the migration is architecturally sound, but requires careful implementation of data ownership boundaries and sync mechanisms.

## Critical Findings

### 1. Data Ownership Model (AUTHORITY: `/docs/po-system-spec.html`)

**What stays in Odoo:**

- Raw materials, components, shelves/locations
- Inventory management
- Vendor bills (account.move) - CRITICAL: payments tracked in QuickBooks
- Bill payment reconciliation

**What moves to Laravel:**

- Purchase orders (creation, approvals, workflow)
- Supplier management
- PO approvals (ops, finance tiers)
- Arrival tracking and receipt confirmation
- Supplier-product mappings

**Data flow:** Laravel → Odoo (one-way push, only on arrival)

### 2. Migration Data Schema Changes Required

Add to Laravel tables:

- `suppliers.odoo_partner_id` - sync vendor identity
- `purchase_orders.odoo_po_id` - tracks corresponding Odoo PO
- `purchase_orders.odoo_pushed_at` - timestamps sync
- `purchase_items.odoo_po_line_id` - links to Odoo line items
- `purchase_items.odoo_qty_pushed` - qty synced for reconciliation

### 3. SERP Integration as Reference Architecture

SERP has proven, production-tested Odoo integration patterns:

- **Reads:** Direct asyncpg PostgreSQL (fast, efficient)
- **Writes:** XML-RPC API with batch processing
  - Max 50 items per batch
  - 1-second delays between batches to prevent timeouts
- **Job Queue:** Prevents timeouts, enables async processing
- **Dual Environment:** Supports staging and production

**Recommendation:** Reuse SERP's architecture rather than building custom integration.

### 4. Billing Architecture - CONSTRAINT

**1,566 of 1,569 bills show payment_state='not_paid'** because:

- Payment tracking happens in QuickBooks, not Odoo
- Accountants manually create bills AFTER receiving goods
- Multi-PO billing consolidation exists (192 bills link multiple POs)
- This is the business process

**Critical Implication:** Billing MUST stay in Odoo. Laravel PO system cannot manage bills. Instead, when goods arrive in Laravel and confirmed, system should trigger Odoo to create bills or mark ready for billing.

### 5. Odoo qty_received Synchronization Challenge

**Problem:** `purchase_order_line.qty_received` is auto-calculated from `stock_move` table

- When goods are received in Odoo (stock_picking validated), qty_received updates automatically
- Laravel won't see these updates without explicit sync

**Solution Required:** Implement sync job to read qty_received from Odoo after receipt validation and update Laravel purchase_items quantities for status tracking.

### 6. Odoo Stock Move Crisis - DATA QUALITY RISK

**48,909 stock moves in stuck/problematic states** indicates reservation crisis

**Risk:** Raw SQL queries on stock_move will return misleading totals
**Mitigation:** Must use Odoo ORM methods (not raw SQL) for accurate quantity calculations during sync

### 7. Effective Date Field - Billing Critical Path

`purchase_order.effective_date` (NOT date_order) is:

- When goods actually arrived
- Determines when PO is "to invoice" ready
- When accountants create bills
- Key field to set when syncing receipt data to Odoo

## Implementation Recommendations

### Phase 1: Schema & Foundation

1. Add sync fields to Laravel tables (odoo_po_id, odoo_pushed_at, etc.)
2. Create Odoo partner mapping (suppliers → odoo_partner_id)
3. Audit existing Laravel PO table for completeness

### Phase 2: Integration Framework

1. Study SERP's Odoo integration code
2. Implement asyncpg PostgreSQL read layer (copy SERP pattern)
3. Implement XML-RPC write layer with batch processing (copy SERP pattern)
4. Create job queue for async Odoo operations

### Phase 3: Sync Mechanisms

1. **PO Creation Sync:** Laravel PO → Odoo PO (via XML-RPC)
2. **Qty Received Sync:** Odoo → Laravel (read via asyncpg after pickings validated)
3. **Receipt Confirmation:** Laravel arrives_at triggers Odoo effective_date update
4. **Error Handling:** Reconciliation queries for data consistency

### Phase 4: Billing Integration (Careful!)

1. Don't move bills to Laravel
2. Create mechanism to mark POs "ready for billing" in Odoo
3. Monitor accountant workflow in Odoo for disruptions
4. Quarterly audit of multi-PO bill consolidations

## Data Integrity Safeguards

1. **Read Odoo quantities via ORM, not SQL** - handles reserved/stuck moves correctly
2. **Idempotent syncs** - must handle retries and duplicates
3. **Dual-write avoidance** - Laravel is source of truth for POs/approvals
4. **Audit trail** - log all sync operations for troubleshooting
5. **Staging testing** - fully test in Odoo staging before production

## Key Files & References

- **Spec Document:** `/docs/po-system-spec.html`
- **SERP Integration Code:** SERP GitHub repo (for patterns)
- **Laravel Schema:** `laravel_staging.purchase_orders`, `purchase_items`, `suppliers`
- **Odoo Schema:** `purchase_order`, `purchase_order_line`, `stock_move`, `stock_picking`, `account.move`

## Next Steps

1. Review this summary with stakeholders
2. Audit Laravel PO tables for completeness
3. Study SERP integration code in detail
4. Design sync job architecture
5. Create detailed implementation spec with error handling
