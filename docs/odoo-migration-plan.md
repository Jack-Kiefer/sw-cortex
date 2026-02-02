# Odoo to SERP Migration Plan

## Complete Breakdown for All Phases

**Prepared for:** Anna Kifer, Ric Marquis, Seth Finley, Matthew Patrick
**Prepared by:** Jack Kiefer
**Date:** February 2, 2026
**Target:** SERP operational before peak season (July 2026 Odoo sunset)

---

## Executive Summary

This document provides a detailed breakdown of migrating from Odoo to SERP/Laravel across five phases:

| Phase                             | Scope                            | Level of Effort | Dependencies |
| --------------------------------- | -------------------------------- | --------------- | ------------ |
| **1. Purchase Orders**            | PO creation, approvals, arrivals | 4-6 weeks       | None         |
| **2. Vendor Bills**               | Bill creation from POs           | 6-8 weeks       | Phase 1      |
| **3. Raw Materials & Components** | Product master data              | 4-5 weeks       | Phase 1      |
| **4. Manufacturing Orders**       | BOMs and production              | 6-8 weeks       | Phase 3      |
| **5. Inventory Management**       | Stock tracking, locations        | 8-10 weeks      | Phases 3 & 4 |

**Total estimated timeline: 28-37 weeks (7-9 months)**

For July sunset: Must begin Phase 1 immediately (February) to allow buffer.

---

## Current State: Data Volumes

### Odoo Data (Production)

| Data Type            | Count  | Notes                                      |
| -------------------- | ------ | ------------------------------------------ |
| Purchase Orders      | 1,846  | 1,696 open, 65 awaiting arrival, 59 drafts |
| Suppliers            | 165    | Active vendors with supplier_rank > 0      |
| Products             | 5,809  | Active product records                     |
| Bills of Materials   | 1,242  | Active BOMs                                |
| Vendor Bills         | 1,569  | All vendor invoices                        |
| Manufacturing Orders | 26,128 | Historical; 29 currently active            |
| Stock Locations      | 1,856  | Internal warehouse locations               |
| Stock Quants         | 8,579  | Inventory records with quantity > 0        |

### SERP/Laravel Current State

- **Purchase Order System**: Exists and functional (status workflow, approvals, blanket POs)
- **Suppliers Table**: Exists, needs `odoo_partner_id` column
- **Components Table**: Exists with `odoo_id` column
- **Raw Materials Table**: Exists with `odoo_id` column
- **Odoo Integration**: Mature patterns exist (asyncpg reads, XML-RPC writes)

---

## Phase 1: Purchase Orders

### Goal

Move all purchase order creation and management to SERP. Odoo receives PO data only when goods arrive (for billing purposes).

### Data Ownership After Phase 1

| Data              | Owner    | Notes                                |
| ----------------- | -------- | ------------------------------------ |
| Purchase Orders   | **SERP** | Source of truth for all PO data      |
| PO Approvals      | **SERP** | Ops and Finance approval workflow    |
| Arrivals/Receipts | **SERP** | Arrival tracking and confirmation    |
| Suppliers         | **SERP** | Vendor master data                   |
| Inventory Counts  | Odoo     | Updated when arrival pushed          |
| Vendor Bills      | Odoo     | Created by accountants after arrival |

### Data to Migrate

| Source (Odoo)              | Target (Laravel)             | Records     | Notes                        |
| -------------------------- | ---------------------------- | ----------- | ---------------------------- |
| `res_partner` (suppliers)  | `suppliers`                  | 165         | Map `id` → `odoo_partner_id` |
| `purchase_order`           | `purchase_orders`            | 1,846       | All historical + open POs    |
| `purchase_order_line`      | `purchase_items`             | ~8,000 est. | Line items with quantities   |
| `stock_move` (arrived qty) | `purchase_items.arrived_qty` | —           | Calculate from done moves    |

### Database Schema Changes

```sql
-- Laravel migrations required
ALTER TABLE suppliers
  ADD COLUMN odoo_partner_id INT NULL,
  ADD INDEX idx_odoo_partner_id (odoo_partner_id);

ALTER TABLE purchase_orders
  ADD COLUMN odoo_po_id INT NULL,
  ADD COLUMN odoo_pushed_at DATETIME NULL,
  ADD INDEX idx_odoo_po_id (odoo_po_id);

ALTER TABLE purchase_items
  ADD COLUMN odoo_po_line_id INT NULL,
  ADD COLUMN odoo_qty_pushed DECIMAL(10,2) DEFAULT 0,
  ADD INDEX idx_odoo_po_line_id (odoo_po_line_id);
```

### Tasks Breakdown

#### Week 1-2: Schema & Infrastructure

| Task                                        | Effort | Owner   |
| ------------------------------------------- | ------ | ------- |
| Add sync columns to Laravel tables          | 2 days | Backend |
| Create migration scripts framework          | 2 days | Backend |
| Set up Odoo staging environment for testing | 1 day  | DevOps  |
| Review SERP Odoo integration patterns       | 1 day  | Backend |
| Design arrival → Odoo push API              | 2 days | Backend |

#### Week 2-3: Data Migration

| Task                                         | Effort | Owner   |
| -------------------------------------------- | ------ | ------- |
| Export suppliers from Odoo with ID mapping   | 1 day  | Backend |
| Export all POs (historical + open)           | 2 days | Backend |
| Export PO line items with quantities         | 2 days | Backend |
| Calculate arrived quantities from stock_move | 1 day  | Backend |
| Validate migrated data against Odoo          | 2 days | QA      |
| Reconciliation report for discrepancies      | 1 day  | Backend |

#### Week 3-4: Odoo Push Integration

| Task                                            | Effort | Owner   |
| ----------------------------------------------- | ------ | ------- |
| Build XML-RPC service for PO creation           | 3 days | Backend |
| Build receipt (stock.picking) creation          | 2 days | Backend |
| Implement batch processing (50 items, 1s delay) | 1 day  | Backend |
| Build job queue for async push                  | 2 days | Backend |
| Handle partial arrivals (delta sync)            | 2 days | Backend |
| Error handling and retry logic                  | 1 day  | Backend |

#### Week 4-5: UI & Workflow

| Task                                      | Effort | Owner    |
| ----------------------------------------- | ------ | -------- |
| Add "Mark as Arrived" button to PO UI     | 1 day  | Frontend |
| Add "Push to Odoo" status indicator       | 1 day  | Frontend |
| Add sync error notifications              | 1 day  | Frontend |
| Update PO list to show sync status        | 1 day  | Frontend |
| Test approval workflow end-to-end         | 2 days | QA       |
| Document new workflow for purchasing team | 1 day  | PM       |

#### Week 5-6: Cutover & Training

| Task                                         | Effort  | Owner        |
| -------------------------------------------- | ------- | ------------ |
| Disable PO creation in Odoo (permissions)    | 1 day   | Admin        |
| Train purchasing team on SERP                | 2 days  | PM           |
| Parallel run: verify arrivals sync correctly | 5 days  | QA           |
| Monitor sync logs for failures               | Ongoing | DevOps       |
| Go-live sign-off                             | 1 day   | Stakeholders |

### Risks & Mitigations

| Risk                                   | Impact             | Mitigation                                |
| -------------------------------------- | ------------------ | ----------------------------------------- |
| Sync failure on arrival                | Bills not created  | Retry queue + alerting                    |
| Data mismatch after migration          | Accounting errors  | Reconciliation report before cutover      |
| Partial arrival complexity             | Duplicate receipts | Track `odoo_qty_pushed` per line          |
| 65 POs awaiting arrival during cutover | Dual entry needed  | Migrate these last, brief parallel period |

### Success Criteria

- [ ] All new POs created in SERP only
- [ ] All arrivals push to Odoo within 5 minutes
- [ ] Accountants can create bills from pushed POs
- [ ] Ric can see open POs for cash flow in SERP
- [ ] Zero duplicate POs between systems

---

## Phase 2: Vendor Bills

### Goal

Move bill creation from Odoo to SERP. Bills link directly to SERP POs. Only send inventory quantities to Odoo (not full PO data).

### Data Ownership After Phase 2

| Data              | Owner      | Notes                      |
| ----------------- | ---------- | -------------------------- |
| Vendor Bills      | **SERP**   | Bill creation and tracking |
| Bill Line Items   | **SERP**   | Linked to PO lines         |
| Bill Approval     | **SERP**   | Finance approval workflow  |
| Payment Tracking  | QuickBooks | Unchanged                  |
| Inventory Updates | Odoo       | Receive qty only           |

### Data to Migrate

| Source (Odoo)                     | Target (Laravel)          | Records | Notes             |
| --------------------------------- | ------------------------- | ------- | ----------------- |
| `account_move` (in_invoice)       | `vendor_bills` (new)      | 1,569   | Historical bills  |
| `account_move_line`               | `vendor_bill_items` (new) | ~12,000 | Line items        |
| `account_move_purchase_order_rel` | FK on bills               | —       | Link bills to POs |

### New Database Tables

```sql
CREATE TABLE vendor_bills (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  po_id BIGINT NULL,                    -- FK to purchase_orders (nullable for multi-PO)
  supplier_id BIGINT NOT NULL,          -- FK to suppliers
  bill_number VARCHAR(100),
  bill_date DATE,
  due_date DATE,
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  status ENUM('draft', 'pending_approval', 'approved', 'paid', 'cancelled'),
  odoo_move_id INT NULL,                -- For historical migration
  quickbooks_id VARCHAR(100) NULL,      -- For payment reconciliation
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE vendor_bill_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  bill_id BIGINT NOT NULL,
  po_item_id BIGINT NULL,               -- FK to purchase_items
  description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(12,4),
  amount DECIMAL(12,2),
  odoo_move_line_id INT NULL
);

CREATE TABLE vendor_bill_po_links (
  bill_id BIGINT NOT NULL,
  po_id BIGINT NOT NULL,
  PRIMARY KEY (bill_id, po_id)          -- Multi-PO billing support
);
```

### Tasks Breakdown

#### Week 1-2: Schema & Design

| Task                               | Effort | Owner   |
| ---------------------------------- | ------ | ------- |
| Design bill tables schema          | 2 days | Backend |
| Create Laravel migrations          | 1 day  | Backend |
| Design multi-PO bill linking       | 1 day  | Backend |
| Design bill → QuickBooks sync      | 2 days | Backend |
| Review current accounting workflow | 1 day  | PM      |

#### Week 2-4: Core Implementation

| Task                                   | Effort | Owner   |
| -------------------------------------- | ------ | ------- |
| Build bill CRUD operations             | 3 days | Backend |
| Build bill approval workflow           | 2 days | Backend |
| Build "create bill from PO" feature    | 2 days | Backend |
| Build multi-PO bill consolidation      | 3 days | Backend |
| Build partial billing (qty tracking)   | 2 days | Backend |
| Implement `qty_to_invoice` calculation | 1 day  | Backend |

#### Week 4-5: Integration

| Task                                   | Effort | Owner   |
| -------------------------------------- | ------ | ------- |
| Build Odoo inventory-only push (no PO) | 3 days | Backend |
| Build QuickBooks bill sync             | 3 days | Backend |
| Handle payment status sync from QB     | 2 days | Backend |
| Update Odoo push to skip PO creation   | 1 day  | Backend |

#### Week 5-6: UI & Migration

| Task                               | Effort | Owner    |
| ---------------------------------- | ------ | -------- |
| Build bill creation UI             | 3 days | Frontend |
| Build bill list with status        | 2 days | Frontend |
| Migrate historical bills from Odoo | 2 days | Backend  |
| Validate bill totals match Odoo    | 1 day  | QA       |

#### Week 6-8: Testing & Cutover

| Task                               | Effort | Owner        |
| ---------------------------------- | ------ | ------------ |
| Test full PO → Bill → Payment flow | 5 days | QA           |
| Train accounting team              | 2 days | PM           |
| Parallel run with Odoo billing     | 5 days | QA           |
| Disable bill creation in Odoo      | 1 day  | Admin        |
| Go-live sign-off                   | 1 day  | Stakeholders |

### Dependencies

- **Requires Phase 1 complete**: Bills link to SERP POs
- **QuickBooks integration**: Payment tracking unchanged

### Risks & Mitigations

| Risk                           | Impact                          | Mitigation                             |
| ------------------------------ | ------------------------------- | -------------------------------------- |
| Multi-PO billing complexity    | 192 existing consolidated bills | Junction table design supports this    |
| QuickBooks sync failures       | Payment status unknown          | Retry queue + manual reconciliation UI |
| Accounting workflow disruption | Slow bill processing            | Extensive training + parallel run      |

---

## Phase 3: Raw Materials & Components

### Goal

Move product master data ownership to SERP. Inventory counts remain in Odoo until Phase 5.

### Data Ownership After Phase 3

| Data                      | Owner    | Notes                        |
| ------------------------- | -------- | ---------------------------- |
| Raw Materials (master)    | **SERP** | Product definitions          |
| Components (master)       | **SERP** | Product definitions          |
| Supplier-Product Mappings | **SERP** | Which supplier provides what |
| Product Categories        | **SERP** | Organization hierarchy       |
| Inventory Counts          | Odoo     | Until Phase 5                |
| Shelf Locations           | Odoo     | Until Phase 5                |

### Data to Migrate

| Source (Odoo)          | Target (Laravel)               | Records   | Notes                     |
| ---------------------- | ------------------------------ | --------- | ------------------------- |
| `product_product`      | `components` / `raw_materials` | 5,809     | Product master data       |
| `product_template`     | Attributes on products         | —         | Shared product attributes |
| `product_category`     | `product_categories` (new)     | ~50 est.  | Category hierarchy        |
| `product_supplierinfo` | `supplier_products`            | ~500 est. | Supplier-product links    |

### Database Schema Changes

```sql
-- Extend existing tables
ALTER TABLE components
  ADD COLUMN category_id BIGINT NULL,
  ADD COLUMN default_supplier_id BIGINT NULL,
  ADD COLUMN lead_time_days INT DEFAULT 0,
  ADD COLUMN min_order_qty DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN uom VARCHAR(20) DEFAULT 'unit';

ALTER TABLE raw_materials
  ADD COLUMN category_id BIGINT NULL,
  ADD COLUMN default_supplier_id BIGINT NULL,
  ADD COLUMN lead_time_days INT DEFAULT 0,
  ADD COLUMN min_order_qty DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN uom VARCHAR(20) DEFAULT 'unit';

-- New tables
CREATE TABLE product_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  parent_id BIGINT NULL,
  odoo_category_id INT NULL
);

CREATE TABLE supplier_products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  supplier_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  supplier_sku VARCHAR(100),
  supplier_price DECIMAL(12,4),
  min_qty DECIMAL(10,2) DEFAULT 1,
  lead_time_days INT DEFAULT 0,
  is_preferred BOOLEAN DEFAULT FALSE,
  odoo_supplierinfo_id INT NULL
);
```

### Tasks Breakdown

#### Week 1-2: Schema & Analysis

| Task                                    | Effort | Owner   |
| --------------------------------------- | ------ | ------- |
| Analyze Odoo product structure          | 2 days | Backend |
| Design extended component/RM schema     | 2 days | Backend |
| Create Laravel migrations               | 1 day  | Backend |
| Map Odoo product types to SERP          | 1 day  | Backend |
| Identify products with BOM dependencies | 1 day  | Backend |

#### Week 2-3: Migration

| Task                                | Effort | Owner   |
| ----------------------------------- | ------ | ------- |
| Export product categories from Odoo | 1 day  | Backend |
| Export all products with attributes | 2 days | Backend |
| Export supplier-product mappings    | 1 day  | Backend |
| Validate odoo_id mappings exist     | 1 day  | QA      |
| Create reconciliation report        | 1 day  | Backend |

#### Week 3-4: CRUD & UI

| Task                           | Effort | Owner    |
| ------------------------------ | ------ | -------- |
| Build product CRUD operations  | 2 days | Backend  |
| Build category management      | 1 day  | Backend  |
| Build supplier-product linking | 2 days | Backend  |
| Build product search/filter UI | 2 days | Frontend |
| Build product edit forms       | 2 days | Frontend |

#### Week 4-5: Integration & Cutover

| Task                                    | Effort | Owner   |
| --------------------------------------- | ------ | ------- |
| Update PO creation to use SERP products | 2 days | Backend |
| Test product → PO → arrival flow        | 2 days | QA      |
| Disable product creation in Odoo        | 1 day  | Admin   |
| Train ops team on product management    | 1 day  | PM      |

### Dependencies

- **Requires Phase 1 complete**: POs reference SERP products
- **Does NOT require Phase 2**: Bills can still use Odoo product refs

### Risks & Mitigations

| Risk                       | Impact                  | Mitigation                                   |
| -------------------------- | ----------------------- | -------------------------------------------- |
| Product data inconsistency | PO line items break     | Validate all odoo_id mappings before cutover |
| BOM dependencies           | MOs can't find products | Phase 4 handles BOMs; keep Odoo product refs |
| Inventory still in Odoo    | Dual lookup needed      | Accept until Phase 5                         |

---

## Phase 4: Manufacturing Orders

### Goal

Move Bill of Materials (BOM) ownership and manufacturing order creation to SERP. Production pushes to Odoo for inventory updates.

### Data Ownership After Phase 4

| Data                     | Owner    | Notes                       |
| ------------------------ | -------- | --------------------------- |
| Bills of Materials       | **SERP** | BOM definitions             |
| Manufacturing Orders     | **SERP** | MO creation and tracking    |
| Production Schedule      | **SERP** | Planning and scheduling     |
| Work Orders              | **SERP** | Individual production steps |
| Inventory Consumption    | Odoo     | Updated when MO completes   |
| Finished Goods Inventory | Odoo     | Updated when MO completes   |

### Data to Migrate

| Source (Odoo)         | Target (Laravel)             | Records       | Notes             |
| --------------------- | ---------------------------- | ------------- | ----------------- |
| `mrp_bom`             | `boms` (new)                 | 1,242         | Bill of materials |
| `mrp_bom_line`        | `bom_lines` (new)            | ~6,000 est.   | BOM components    |
| `mrp_production`      | `manufacturing_orders` (new) | 26,128        | Historical MOs    |
| `mrp_production_line` | `mo_lines` (new)             | ~100,000 est. | MO line items     |

### New Database Tables

```sql
CREATE TABLE boms (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  uom VARCHAR(20) DEFAULT 'unit',
  is_active BOOLEAN DEFAULT TRUE,
  odoo_bom_id INT NULL,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE bom_lines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  bom_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL,
  uom VARCHAR(20) DEFAULT 'unit',
  sequence INT DEFAULT 0,
  odoo_bom_line_id INT NULL
);

CREATE TABLE manufacturing_orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mo_number VARCHAR(50) NOT NULL,
  bom_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity_planned DECIMAL(10,2) NOT NULL,
  quantity_produced DECIMAL(10,2) DEFAULT 0,
  status ENUM('draft', 'confirmed', 'in_progress', 'done', 'cancelled'),
  scheduled_date DATE,
  completed_date DATE NULL,
  odoo_production_id INT NULL,
  odoo_pushed_at DATETIME NULL,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE mo_consumptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mo_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity_planned DECIMAL(10,4) NOT NULL,
  quantity_consumed DECIMAL(10,4) DEFAULT 0
);
```

### Tasks Breakdown

#### Week 1-2: Schema & Analysis

| Task                             | Effort | Owner   |
| -------------------------------- | ------ | ------- |
| Analyze Odoo BOM structure       | 2 days | Backend |
| Design BOM and MO schema         | 2 days | Backend |
| Create Laravel migrations        | 1 day  | Backend |
| Map BOM hierarchy (multi-level)  | 2 days | Backend |
| Analyze active vs historical MOs | 1 day  | Backend |

#### Week 2-4: Migration & Core

| Task                       | Effort | Owner   |
| -------------------------- | ------ | ------- |
| Export all BOMs with lines | 2 days | Backend |
| Export historical MOs      | 2 days | Backend |
| Build BOM CRUD operations  | 3 days | Backend |
| Build BOM line management  | 2 days | Backend |
| Build MO creation from BOM | 2 days | Backend |
| Build MO status workflow   | 2 days | Backend |

#### Week 4-5: Production Features

| Task                                    | Effort | Owner   |
| --------------------------------------- | ------ | ------- |
| Build consumption tracking              | 2 days | Backend |
| Build production completion             | 2 days | Backend |
| Build MO → Odoo push (inventory update) | 3 days | Backend |
| Handle multi-level BOM explosion        | 2 days | Backend |

#### Week 5-6: UI

| Task                           | Effort | Owner    |
| ------------------------------ | ------ | -------- |
| Build BOM editor UI            | 3 days | Frontend |
| Build MO creation wizard       | 2 days | Frontend |
| Build production tracking UI   | 2 days | Frontend |
| Build production schedule view | 2 days | Frontend |

#### Week 6-8: Testing & Cutover

| Task                              | Effort | Owner |
| --------------------------------- | ------ | ----- |
| Test BOM → MO → inventory flow    | 5 days | QA    |
| Validate consumption calculations | 2 days | QA    |
| Train production team             | 2 days | PM    |
| Parallel run with Odoo MOs        | 5 days | QA    |
| Disable MO creation in Odoo       | 1 day  | Admin |

### Dependencies

- **Requires Phase 3 complete**: BOMs reference SERP products
- **Inventory updates still go to Odoo**: Until Phase 5

### Risks & Mitigations

| Risk                         | Impact                | Mitigation                        |
| ---------------------------- | --------------------- | --------------------------------- |
| Multi-level BOM complexity   | Incorrect consumption | Thorough testing of BOM explosion |
| 29 active MOs during cutover | Production disruption | Complete active MOs in Odoo first |
| Inventory sync timing        | Stock mismatch        | Immediate push on MO completion   |

---

## Phase 5: Inventory Management

### Goal

Move all inventory tracking to SERP. Odoo becomes optional/deprecated.

### Data Ownership After Phase 5

| Data                  | Owner          | Notes                       |
| --------------------- | -------------- | --------------------------- |
| Stock Quantities      | **SERP**       | All inventory counts        |
| Stock Locations       | **SERP**       | Warehouse/shelf structure   |
| Stock Moves           | **SERP**       | All inventory movements     |
| Reservations          | **SERP**       | Sales order reservations    |
| Inventory Adjustments | **SERP**       | Cycle counts, corrections   |
| Odoo                  | **Deprecated** | Optional for reporting only |

### Data to Migrate

| Source (Odoo)    | Target (Laravel)         | Records | Notes               |
| ---------------- | ------------------------ | ------- | ------------------- |
| `stock_location` | `stock_locations` (new)  | 1,856   | Warehouse structure |
| `stock_quant`    | `stock_quantities` (new) | 8,579   | Current inventory   |
| `stock_move`     | `stock_moves` (new)      | 48,909+ | Movement history    |

### New Database Tables

```sql
CREATE TABLE stock_locations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  parent_id BIGINT NULL,
  location_type ENUM('warehouse', 'zone', 'shelf', 'bin') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  odoo_location_id INT NULL
);

CREATE TABLE stock_quantities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  location_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  reserved_quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  available_quantity DECIMAL(12,4) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_count_date DATE NULL,
  UNIQUE KEY (location_id, product_type, product_id)
);

CREATE TABLE stock_moves (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  move_type ENUM('receipt', 'delivery', 'internal', 'adjustment', 'production') NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  from_location_id BIGINT NULL,
  to_location_id BIGINT NULL,
  reference_type VARCHAR(50),           -- 'purchase_order', 'sales_order', 'mo', 'adjustment'
  reference_id BIGINT,
  status ENUM('draft', 'confirmed', 'done', 'cancelled'),
  moved_at DATETIME,
  created_at DATETIME
);

CREATE TABLE stock_reservations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  location_id BIGINT NOT NULL,
  product_type ENUM('component', 'raw_material') NOT NULL,
  product_id BIGINT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,  -- 'sales_order', 'mo'
  reference_id BIGINT NOT NULL,
  reserved_at DATETIME,
  expires_at DATETIME NULL
);
```

### Tasks Breakdown

#### Week 1-2: Schema & Analysis

| Task                            | Effort | Owner   |
| ------------------------------- | ------ | ------- |
| Analyze Odoo stock structure    | 2 days | Backend |
| Design location hierarchy       | 2 days | Backend |
| Design reservation system       | 2 days | Backend |
| Create Laravel migrations       | 1 day  | Backend |
| Plan 48,909 stuck moves cleanup | 2 days | Backend |

#### Week 2-4: Core Implementation

| Task                               | Effort | Owner   |
| ---------------------------------- | ------ | ------- |
| Build location CRUD                | 2 days | Backend |
| Build stock quantity tracking      | 3 days | Backend |
| Build stock move recording         | 3 days | Backend |
| Build reservation system           | 3 days | Backend |
| Build inventory adjustment feature | 2 days | Backend |

#### Week 4-6: Integration

| Task                                          | Effort | Owner   |
| --------------------------------------------- | ------ | ------- |
| Update PO arrival to update SERP inventory    | 2 days | Backend |
| Update MO completion to update SERP inventory | 2 days | Backend |
| Build sales order reservation integration     | 3 days | Backend |
| Remove Odoo inventory pushes                  | 2 days | Backend |
| Build inventory sync verification             | 2 days | Backend |

#### Week 6-8: Migration

| Task                                    | Effort | Owner   |
| --------------------------------------- | ------ | ------- |
| Export location hierarchy from Odoo     | 1 day  | Backend |
| Export current stock quantities         | 1 day  | Backend |
| Validate quantities match Odoo          | 2 days | QA      |
| Plan cutover during low-activity period | 1 day  | PM      |
| Execute inventory cutover               | 1 day  | Backend |

#### Week 8-10: UI & Testing

| Task                      | Effort | Owner    |
| ------------------------- | ------ | -------- |
| Build inventory dashboard | 3 days | Frontend |
| Build location browser    | 2 days | Frontend |
| Build stock move history  | 2 days | Frontend |
| Build cycle count feature | 2 days | Frontend |
| Full system testing       | 5 days | QA       |
| Train warehouse team      | 2 days | PM       |

### Dependencies

- **Requires Phases 3 & 4 complete**: Products and MOs in SERP
- **High risk phase**: Inventory is critical path

### Risks & Mitigations

| Risk                          | Impact                   | Mitigation                                        |
| ----------------------------- | ------------------------ | ------------------------------------------------- |
| 48,909 stuck stock moves      | Data quality issues      | Clean up in Odoo BEFORE migration                 |
| Reservation system complexity | Overselling              | Extensive testing; start with manual reservations |
| Cutover timing                | Business disruption      | Execute during low-activity weekend               |
| Quantity mismatches           | Accounting discrepancies | Reconciliation before and after                   |

---

## Timeline Summary

```
Feb 2026  |████████████████████████████████| Phase 1: Purchase Orders (6 weeks)
          Week 1-2: Schema/Infra | Week 3-4: Migration/Integration | Week 5-6: Cutover

Mar-Apr   |████████████████████████████████████████| Phase 2: Vendor Bills (8 weeks)
          Week 1-2: Schema | Week 3-5: Implementation | Week 6-8: Testing/Cutover

Apr-May   |████████████████████████| Phase 3: Raw Materials/Components (5 weeks)
          Week 1-2: Schema/Migration | Week 3-4: CRUD/UI | Week 5: Cutover

May-Jul   |████████████████████████████████████████| Phase 4: Manufacturing Orders (8 weeks)
          Week 1-2: Schema | Week 3-5: Core/Production | Week 6-8: UI/Cutover

Jul-Sep   |████████████████████████████████████████████████| Phase 5: Inventory (10 weeks)
          Week 1-4: Core | Week 5-6: Integration | Week 7-8: Migration | Week 9-10: Testing
```

### Critical Path for July Sunset

To sunset Odoo by July:

- **Phase 1 must complete by mid-March** (POs)
- **Phase 2 can run parallel with Phase 3** (Bills + Products)
- **Phase 4 must start by May** (Manufacturing)
- **Phase 5 likely extends past July** — may need to keep Odoo for inventory only

### Realistic July Target

| Phase                    | Can Complete by July? | Notes                       |
| ------------------------ | --------------------- | --------------------------- |
| Phase 1: Purchase Orders | Yes                   | Start immediately           |
| Phase 2: Vendor Bills    | Yes                   | Parallel with Phase 3       |
| Phase 3: Raw Materials   | Yes                   | Parallel with Phase 2       |
| Phase 4: Manufacturing   | Maybe                 | Depends on complexity       |
| Phase 5: Inventory       | No                    | High risk; target September |

**Recommendation:** Target July sunset for Phases 1-4. Keep Odoo running for inventory only until September.

---

## Resource Requirements

### Development Team

| Role               | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
| ------------------ | ------- | ------- | ------- | ------- | ------- |
| Backend Developer  | 1 FT    | 1 FT    | 0.5 FT  | 1 FT    | 1 FT    |
| Frontend Developer | 0.5 FT  | 0.5 FT  | 0.5 FT  | 1 FT    | 1 FT    |
| QA Engineer        | 0.5 FT  | 0.5 FT  | 0.25 FT | 0.5 FT  | 1 FT    |
| PM/Training        | 0.25 FT | 0.25 FT | 0.25 FT | 0.25 FT | 0.5 FT  |

### External Dependencies

| Dependency                   | Phases  | Notes                |
| ---------------------------- | ------- | -------------------- |
| Odoo staging environment     | All     | For testing pushes   |
| QuickBooks API access        | Phase 2 | Payment sync         |
| Warehouse access for testing | Phase 5 | Inventory validation |

---

## Questions to Resolve

1. **July deadline flexibility**: Can inventory (Phase 5) extend to September?

2. **Parallel vs sequential**: Can Phases 2 & 3 run fully parallel (doubles resource need)?

3. **QuickBooks integration**: Is existing QB integration sufficient for Phase 2, or new work needed?

4. **Active MOs**: Should the 29 active manufacturing orders complete in Odoo before Phase 4 cutover?

5. **Stuck stock moves**: Should the 48,909 stuck moves be cleaned up before Phase 5, or ignore them?

6. **Training approach**: Phased training per cutover, or comprehensive training at end?

---

## Appendix: Risk Register

| ID  | Risk                              | Phase | Probability | Impact   | Mitigation                                   | Owner   |
| --- | --------------------------------- | ----- | ----------- | -------- | -------------------------------------------- | ------- |
| R1  | Sync failure causes missing bills | 1, 2  | Medium      | High     | Retry queue, alerting                        | Backend |
| R2  | Data migration errors             | All   | Medium      | High     | Reconciliation reports, rollback plan        | Backend |
| R3  | User adoption resistance          | All   | Low         | Medium   | Early involvement, training                  | PM      |
| R4  | Timeline slippage                 | All   | Medium      | Medium   | Buffer built in, scope flexibility           | PM      |
| R5  | Inventory mismatch                | 5     | High        | Critical | Extensive testing, cutover during low period | QA      |
| R6  | Multi-level BOM errors            | 4     | Medium      | High     | Thorough BOM testing                         | QA      |
| R7  | Peak season pressure              | 4, 5  | Medium      | High     | Prioritize Phases 1-3 before peak            | PM      |

---

_Document Version: 1.0_
_Last Updated: February 2, 2026_
_Next Review: Monday meeting with Anna_
