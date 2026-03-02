# SERP Update

Date: 2026-01-29

Attendees: Anna Kifer, Jack Kiefer, Seth Finley, Ric Marquis, Matthew Patrick

## Summary

Ric Marquis shared details about their office relocation and the necessity of migrating open purchase order information for cash flow monitoring to the Laravel data. Jack Kiefer proposed an incremental system replacement strategy starting with a standalone purchase order (PO) system in SERP, with the goal of incrementally shifting data ownership from Odoo to the Laravel database, which will involve migrating all existing POs to ensure Laravel is the single source of truth for purchase order data. Anna Kifer tasked Jack Kiefer with creating a detailed breakdown for all phases of the migration, including data migration needs, specific tasks, and estimated timelines to ensure SERP is operational before peak season.

## Details

### Office Relocation

Ric Marquis discussed their recent move from the suburbs to a more rural area (~30 minutes from previous suburb). New office has a pop-out with five windows including a view down a valley to Castle Pines. Brief chat about cold weather — Philly vs Colorado dryness.

### Incremental System Replacement Strategy

- Ric self-invited due to reliance on Odoo information and the discussion of phasing in a replacement
- Jack proposed starting with a standalone purchase order (PO) system — most separate from other Odoo components
- Goal: incrementally shift data ownership to Laravel, beginning with purchase orders

### Proposed Purchase Order System Functionality

- Draft PO creation, ordering, and supplier communications all managed within SERP using Laravel as primary data source
- When goods arrive: PO exported to Odoo to maintain accurate arrival quantities for billing
- Subsequent arrivals update the existing PO in Odoo
- Ric confirmed: open PO information for cash flow monitoring needs to be migrated to Laravel data

### Data Migration and Scope of Phase One

- Anna questioned why Laravel wouldn't manage the entire receipt/billing/vendor payment process
- Jack: keeping initial scope narrow — focus only on PO creation first
- All existing POs will be migrated from Odoo to Laravel (Laravel = single source of truth for PO data)
- Phase 1 requires adding Odoo ID references in Laravel for items still owned by Odoo (raw materials, components) — those items themselves remain in Odoo initially

### Future Phases and Implementation Status

- Future additions: move all bills to SERP after POs, then migrate raw materials and components
- Enhanced features not in Odoo: building POs from supplier forecasts, blanket purchase orders
- Some initial implementation work is already done, but DB structure changes needed (over-complicated)

### Phased Approach Outline

Anna proposed a 4–5 phase migration:

1. **Purchase Orders** — create/manage POs in SERP, migrate existing POs from Odoo
2. **Create Bills** — move billing to SERP
3. **Raw Materials & Components** — migrate product data into SERP
4. **Manufacturing Orders** — likely includes inventory adjustments
5. **Inventory Management**

### Timeline Discussion

- Ric asked if an Odoo sunset date in July is reasonable
- Anna: timeline depends on Jack's detailed breakdown
- Jack: will provide detailed breakdown and timeline by Monday
- Goal: get SERP operational before peak season

### Avalara Shipping Amounts (Ric's Request)

- Anna confirmed standard shipping amounts in Avalara can be updated via mass upload of a CSV file containing buyer product ID and new values

## Action Items

- **Jack**: Create breakdown of all steps to move off Odoo by Monday — covering each phase (Purchase Orders, Create Bills, Raw Materials/Components, Manufacturing Orders, Inventory Management), data to be transferred, necessary actions, and granular timeline (level of effort in weeks)
- **Anna**: Schedule time Monday to discuss the breakdown and Odoo migration timeline
- **Anna**: Perform mass update in database for new standard shipping amounts in Avalara (CSV with buyer product IDs)
