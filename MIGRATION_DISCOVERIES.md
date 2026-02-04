# Odoo Migration Plan - Research Discoveries

**Date**: 2026-02-04
**Research Focus**: Phase 3 Laravel PO → Odoo Sync Architecture
**Status**: Ready for MCP Discovery logging

## Critical Findings

### 1. Standalone PO System Architecture Analysis

**Type**: Insight | **Priority**: Critical (4)
**Source**: exploration | **Database**: odoo

Current state: SERP doesn't exist for PO management (user premise)

- Plan proposes Laravel as standalone PO system with Odoo sync only on arrival
- Billing currently happens MANUALLY in Odoo by accountants after vendor invoice received
- 99.8% of bills show payment_state='not_paid' - payment tracking is in QuickBooks, not Odoo
- **Migration Implication**: Cannot rely on Odoo payment_state for migration; must query QuickBooks for truth

**Tags**: migration, architecture, phase-3, Laravel, PO, sync

---

### 2. Current Sync Architecture (One-Way Only)

**Type**: Fact | **Priority**: Critical (4)
**Source**: exploration | **Database**: odoo

- SERP → Odoo: One-way sync via XML-RPC for inventory counts (verified counts push to stock.quant)
- No Laravel → Odoo PO sync exists
- No Odoo → Laravel receipt sync exists
- Laravel intentionally bypassed in current inventory sync to avoid timeout issues

**Tags**: sync, architecture, inventory, timeout-issues

---

### 3. Billing Workflow Discovery

**Type**: Fact | **Priority**: High (3)
**Source**: database_query | **Database**: odoo | **Table**: account_move, purchase_order

- Junction table: account_move_purchase_order_rel links bills to POs (1,578 relationships)
- Bill creation is MANUAL - triggered by accountant after receiving vendor invoice
- Bills created IN Odoo, payments tracked in QuickBooks externally
- 360 draft bills ($3.6M) waiting for approval
- 1,201 posted bills ($11.5M) in system
- **Migration Implication**: Cannot automate bill creation from PO data; must preserve existing bills and manual workflow

**Query Used**:

```sql
SELECT COUNT(*) as bill_count, SUM(amount_untaxed) as total
FROM account_move WHERE move_type='in_invoice' AND state IN ('draft', 'posted')
```

**Tags**: billing, manual-workflow, data-quality

---

### 4. Data Quality Issues - Critical for Migration

**Type**: Anomaly | **Priority**: Critical (4)
**Source**: database_query | **Database**: odoo

- 482 negative inventory quants (-37.8M units) - must resolve before stock migration
- 26,710 stuck stock moves blocking reservations - will impact receipt sync
- 20 over-received PO lines - orphaned from invoice reconciliation
- 10 cancelled POs with active stock moves - data consistency issue

**Migration Blockers**: Cannot migrate stock accurately until negative quants resolved; stuck moves must be cleared or archived.

**Tags**: data-quality, inventory, migration-blocker

---

### 5. Table Relationships for PO-to-Bill Mapping

**Type**: Relationship | **Priority**: High (3)
**Source**: database_query | **Database**: odoo | **Tables**: purchase_order, account_move, account_move_purchase_order_rel

- purchase_order.id → account_move_purchase_order_rel.purchase_order_id → account_move.id
- 1,578 bill-to-PO mappings found
- Bills can link to multiple POs (distribution scenarios)
- **For Migration**: Must preserve these relationships when moving PO data to Laravel

**Tags**: relationships, billing, PO-tracking

---

## Next Steps

1. **MCP Discovery Logging**: Use tools to log each finding with proper source attribution
2. **Data Quality Resolution**: Plan remediation for 482 negative quants and 26,710 stuck moves
3. **Manual Workflow Preservation**: Design Laravel PO system to preserve accountant-driven billing
4. **Sync Strategy**: Clarify which data should trigger Odoo syncs (receipt? approval? payment?)

## Migration Risk Assessment

🔴 **High Risk**: Negative inventory and stuck moves - must resolve before migration
🟡 **Medium Risk**: Manual billing workflow - requires careful design to avoid breaking current process
🟡 **Medium Risk**: Payment state unreliability - must pull from QuickBooks not Odoo
🟢 **Low Risk**: PO-to-bill relationships - straightforward data mapping

---

**Created by**: Claude Code
**For**: Jack's Odoo Migration Planning
**Next session**: Import these into MCP discoveries database
