# Odoo to SERP Migration Analysis - Key Discoveries

**Analysis Date**: 2026-02-04
**Status**: Ready for MCP Discovery Logging
**Critical Findings**: 6 | High Priority: 2

---

## Summary

Analysis of the Odoo→SERP 4-phase migration plan (Feb-Sep 2026) has identified 8 critical discoveries covering architecture, data quality issues, workflows, and technical patterns that must be documented in the knowledge base.

---

## Discovery 1: Migration Plan Architecture

**Priority**: CRITICAL (4)
**Type**: Pattern
**Database**: odoo

4-phase migration strategy spanning Feb-Sep 2026:

- **Phase 1** (10 weeks): Purchase Orders + Bills - PO creation, arrivals, manual bill workflow via 3-way matching
- **Phase 2** (14 weeks): Manufacturing Orders + BOMs + Products - Dual-write with Odoo sync queue
- **Phase 3** (14 weeks): Kits - Parallel track with ADDITIVE logic (union of Laravel + Odoo phantom BOMs)
- **Phase 4** (10 weeks): Inventory Management - Full cutover after data cleanup

**Total Duration**: 33 weeks

**Key Detail**: Phases 1-3 involve dual-write to both systems during overlap period; Phase 2 includes Odoo sync queue with retry/dead-letter-queue/circuit-breaker.

---

## Discovery 2: Odoo Inventory Data Quality Crisis

**Priority**: CRITICAL (4)
**Type**: Anomaly
**Database**: odoo
**Table**: stock_quant, stock_move

**Negative Inventory**:

- 482 stock_quant records with -37.8M units negative inventory
- Mostly in "Vendors" location (indicates unresolved received items)
- Will corrupt SERP inventory if migrated as-is

**Stuck Stock Moves**:

- 48,909 stock_move records stuck in "assigned" or "confirmed" states
- Blocking inventory cutover (Phase 4)
- These must be resolved before cutover

**Impact**: Data cleanup required before Phase 4 or risk corrupting SERP inventory system.

---

## Discovery 3: PO Receipt Issues - Over-receipts & Orphaned Stock

**Priority**: High (3)
**Type**: Anomaly
**Database**: odoo
**Table**: purchase_order_line, stock_move

**Over-receipts**:

- 20 PO lines with received_qty > ordered_qty
- Creates inventory variance

**Orphaned Stock Moves**:

- 10 cancelled POs with orphaned stock_move records (never cleaned up)
- Cannot be matched back to purchase orders

**Impact**: Must clean up before inventory cutover; affects variance calculations during Phase 4.

---

## Discovery 4: Payment Tracking is Unreliable

**Priority**: High (3)
**Type**: Insight
**Database**: odoo
**Table**: account_move

**Critical Finding**:

- 99.8% of invoices in Odoo show state='not_paid'
- Actual payment status in QuickBooks shows they're paid
- Root cause: Invoices not properly linked to payments in Odoo

**Migration Decision**:

- Payment reconciliation CANNOT be migrated from Odoo
- Must use QuickBooks as source of truth for financial data
- Odoo payment records are corrupted/unreliable

---

## Discovery 5: Phase 3 Kit Migration - ADDITIVE (Union) Pattern

**Priority**: CRITICAL (4)
**Type**: Insight
**Database**: odoo
**Tags**: Architecture Decision

**Architecture Decision**:

- Kit migration is NOT a replacement pattern
- Uses ADDITIVE logic: both existing Laravel kits AND Odoo phantom BOMs active together
- Kit components from both systems used simultaneously (union)

**Implications**:

- Affects deduplication logic (some SKUs in both systems)
- Component sourcing must support dual sources
- Pricing rules must handle both sources
- This is the opposite of "replace old with new" - it's "merge both"

**Critical for Implementation**: This architectural choice must be understood by engineering team.

---

## Discovery 6: Odoo Sync Queue Pattern Required

**Priority**: CRITICAL (4)
**Type**: Pattern
**Tags**: Architecture, Technical Requirement

**Non-negotiable Requirements**:

- Async message queue for Odoo XML-RPC sync
- Retry logic with exponential backoff
- Dead-letter queue (DLQ) for failed syncs
- Circuit breaker pattern for reliability

**Why Critical**:

- Phases 1-3 require dual-write consistency (same data in both SERP and Odoo)
- Without reliable sync, data divergence occurs
- Circuit breaker prevents cascading failures to Odoo

**Status**: This is NOT a nice-to-have optimization - it's an architectural requirement.

---

## Discovery 7: PO Date Field Semantics - Use effective_date

**Priority**: High (3)
**Type**: Fact
**Database**: odoo
**Table**: purchase_order
**Columns**: date_order, date_planned, effective_date

**Three Critical Dates**:

- `date_order`: When PO was created in Odoo (2020s for many records)
- `date_planned`: Expected delivery date
- `effective_date`: ACTUAL arrival date (2024-2025 for recent stock receipts)

**Critical Rule**:

- For inventory variance filtering and stock_move timing analysis
- MUST use `effective_date` NOT `date_order`
- Many POs show old creation dates but recent actual arrivals

**Example**: PO created 2020-03-15, but effective_date 2025-01-20 (old order, recent arrival/return)

---

## Discovery 8: Bill Creation is 100% Manual

**Priority**: High (3)
**Type**: Insight
**Database**: odoo
**Table**: account_move

**Workflow** (Not Automated):

1. Vendor ships goods → PO marked received in Odoo
2. Accountant receives physical vendor invoice (email/paper)
3. Accountant manually creates bill record in Odoo
4. Bill matched to QuickBooks payment records

**No Auto-Generation**:

- Bills are NOT auto-created from POs
- No invoice scanning/OCR
- No automatic vendor invoice import

**Migration Implication**:

- Bills cannot be "auto-migrated" from Odoo
- SERP must implement same manual workflow
- Accountant will continue manual bill entry in SERP
- This is a business process, not a technical system

---

## Implementation Status

All 8 discoveries should be logged to the MCP discovery system via `mcp__discoveries__add_discovery()` calls with:

- Appropriate priority levels (3-4)
- Type classifications (pattern, fact, anomaly, insight)
- Source database references
- Tags for categorization
- Detailed descriptions

**Note**: These discoveries are critical for future phases of the migration and should be available to all team members through the discovery search system.

---

## Files Referenced

- `/home/jackk/sw-cortex/scripts/config/phases.json` - Migration phase definitions
- `/home/jackk/sw-cortex/scripts/config/tasks-phase-1.json` - Phase 1 task breakdown
- `/home/jackk/sw-cortex/scripts/config/tasks-phase-4.json` - Phase 4 task breakdown
- Odoo PostgreSQL database - source of analysis data
