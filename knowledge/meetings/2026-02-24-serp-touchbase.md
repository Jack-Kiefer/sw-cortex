# SERP Touchbase

Date: 2026-02-24

Attendees: Anna Kifer, Jack Kiefer, Bilal Ahmed, Manish C, Matthew Patrick, Seth Finley, Subash Chaudhary

## Summary

Discussed the custom sleeve process end-to-end: image approval workflow (currently in WishDesk), printing trigger (only after a buyer order exists), and the need for a dedicated print interface in SERP. Established two-production-slip flow. Also covered database structure changes, custom merchandise tracking, inventory reservation timing, and Odoo reconciliation via XML-RPC.

## Details

### Custom Sleeves: Image Approval Workflow

- Image approval currently handled in WishDesk, not SERP
- Jack: working on processing sleeve images — system needs to find images, mark as approved, and map them
- Question: should WishDesk generate the production slip after approval?
  - That would introduce a separate printing system from the existing Retool printer
  - **Decision: add the print interface to SERP** (plan is to move Retool printer there eventually anyway)
- SERP will need to receive notification from WishDesk when an image is approved

### When to Print Sleeves

- Matthew: merchandising often edits mug photos that never get ordered — how do we know what to print?
- **Decision: printing only happens after a buyer order is placed** — no printing of unordered images
- An `is_approved` column will be added to the physical branding table to store approval status

### Two-Production-Slip Flow

**Production Slip 1 (Product Production Slip):**

- Generated through Laravel (existing flow)
- Already includes indicator that a sleeve/custom merchandise is required
- Fulfillment (Ops) uses this to know they can't ship until the sleeve arrives
- Does NOT contain the image

**Production Slip 2 (Sleeve Production Slip):**

- Generated in the new SERP print interface
- Contains: order number, image, location data
- Purpose: match the printed sleeve to the specific order
- Laravel must send receiver order info to SERP so the print interface knows to pull/print a custom sleeve

### Gang Printing and Inventory Deduction

- Matthew: need to track how many sleeves printed out of a batch
- Anna: gang printing already tracks printed quantity and location — marked as "partially printed"
- Inventory deducted when the production slip for a receiver order is printed (decrements from specified location)

### Work Assignment

- Manish C: currently full
- Subash C: working on production slips and receiver flow
- **Bilal Ahmed**: likely has capacity to work on the print interface
- Subash to coordinate with Manish and Bilal on ticket creation and kickoff
- Jack to provide SERP repo access and docs to Subash, Bilal, and Manish

### Database Structure Changes

**Physical branding table:**

- Add `is_approved` column for image approval status
- Add column to track whether the physical branding production slip has been printed

**New order picking table (Anna's proposal):**

- Create a dedicated table for all order picking/inventory info instead of bloating `ec_order` and `pre_selects`
- Fields: order ID, picking ID, status
- Everything but basic order info is moving out of `ec_order`

**SERP state field:**

- Manish had questions about the "SERP state" field in the custom merchandise plan
- Jack clarified: reflects the sync status of the record to SERP

### Custom Merchandise Backend

- Jack: building SERP backend with a custom ORM to ensure consistency with Odoo's object-relational mapping
- Jack to finalize all DB migrations and SERP backend **before** Laravel devs begin — avoids constant updates
- Manish: can start on Laravel migrations and API integrations once Jack finalizes DB migrations

### Inventory Reservation Timing (Custom Merchandise)

- Manish: should inventory reservation API be called on order creation or on shipment?
- Jack (per project docs): for custom branding, merchandise selection often isn't finalized until shipment → **reserve on shipment**
- Anna's proposal: if merchandise selection IS finalized when receiver makes their choice → reserve then, deduct on shipment
- Jack to investigate: how/when is merchandise selection populated and finalized in the current data?
- Then: propose reserving inventory ahead of time (like standard inventory) and run by Ric

### Odoo Inventory Reconciliation

- Issue: when a custom box is used, need to deduct the custom box but NOT the regular box (avoid double-deduction)
- **Editing Odoo data requires XML-RPC** (not direct DB access)
- Querying Odoo data can be done directly
- Seth: Ric should be looped in on quantity reservation planning — relates to his reporting requirements

## Action Items

- **Jack**: Send SERP repo access + documentation to Subash, Bilal, and Manish
- **Jack**: Investigate how image approval will be communicated from WishDesk to SERP; share plan with team
- **Jack**: Review project docs — ask Jason why merchandise deduction happens at shipment vs. receiver choice
- **Jack**: Define all values for the "SERP state" field; send to Manish
- **Jack**: Finalize all DB migrations; add to database before Laravel devs start
- **Jack**: Build out SERP backend foundation; provide detailed instructions for the team on how each phase works
- **Jack**: Determine when merchandise selection is populated/finalized; evaluate reservation-on-order approach; run by Ric
- **Subash**: Coordinate with Manish and Bilal to create tickets and kick off work on the SERP print interface
