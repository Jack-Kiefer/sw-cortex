# Print Manager Interface

Date: 2026-02-25

Attendees: Anna Kifer, Jack Kiefer, Bilal Ahmed, Parish Shrestha, Manish C, Matthew Patrick, Seth Finley, Subash Chaudhary

## Summary

Deep dive into the custom sleeve printing workflow for SERP. Covered preprint queue logic, gang printing vs. on-demand, sleeve sizing complexity (System A/C/B), inventory tracking for preprinted sleeves, and the two-production-slip flow. **Currently blocked** pending clarification from Jason/Olive on the JSON structure for template IDs and image dimensions — cannot finalize the image approval process or build the print interface until that's resolved.

## Details

### Preprint Queue: Determining What to Print

- No drag-and-drop interface available — printing done in Illustrator
- Interface must provide a queue with image + quantity needed
- Complexity: a single buyer order may involve multiple sleeve sizes (recipient can choose from products with different box sizes)
- Decision: **printing only happens after a buyer order is placed** — merchandising edits images that may never get ordered

### Sleeve Sizing: System A, B, C

- Initial rollout: **candy and snacks only** (current printer limitations)
- Packaging systems:
  - **System A**: cartoned (cupped items)
  - **System C**: cubed items
  - **System B**: popcorn
- System A and C split approximately 50/50
- For MVP: interface shows all potential receiver options + their corresponding sleeve size; operator decides gang print quantity
- Problem: a "mini" box could contain candy (System A) OR candles (System C) — requires different sleeve templates
- **Blocked**: need real JSON example to understand how different dimensions are captured per item category

### Image Sizing and Approval

- Images should be correctly scaled and sized before printing (ideally automated)
- If an image is used for multiple sleeve sizes → need to store multiple approved images (one per size)
- Approval fields may need to be in branding record metadata rather than the main table
- **Image approval should NOT live solely in the branding records table** — new proposals could trigger re-approval of already-approved images
- Anna: approval status should live outside Laravel, possibly in WishDesk, using a **template ID** as the identifier across sizes/products
- **Blocked**: need to know from Jason/Olive whether the JSON contains separate template IDs and dimensions for each product type within the same size category

### Two-Production-Slip Flow (Confirmed)

**Slip 1 (Product Production Slip)** — generated via Laravel:

- Indicates a sleeve/custom merchandise is required
- Ops uses this to know they can't ship until the sleeve is ready

**Slip 2 (Sleeve Production Slip)** — generated via SERP print interface:

- Generated only when a receiver order is placed
- Contains: order number, image, storage location
- If sleeve is preprinted: production slip references where to retrieve it from inventory
- If no inventory: operator traces back to branding record for on-demand print

### Preprinted Sleeve Inventory System

- New inventory table required (similar to existing item deduction system)
- **Deduct inventory** when a production slip is generated
- **Add back** if order is canceled
- Record inventory location on the production slip
- Fields for `preprints` table:
  - Branding record ID
  - Order ID
  - Total gift cards
  - Status: `not_printed` / `partial_printed` / `printed` (removed `filed` — location entered at print time)
  - Location (entered by operator at print time)
  - Quantity printed
  - Quantity consumed
  - `printed_by` (rename from `filed_by`) — uses SERP login info

### Gang Printing vs. On-Demand

- **Gang print**: increases preprint inventory (batch prep ahead of time)
- **On-demand print**: uses inventory immediately, does not affect stock count
- Gang print trigger: number of gift cards linked to a specific branding record ID + order ID exceeds threshold (e.g., >10)
- **Bypass option**: operator can remove orders from gang print queue if they decide not to preprint
- Branding records will NOT be reused — they are snapshotted per order

### Gang Print Grouping Logic

- Group by: `branding_record_id` + `order_id`
- If gift card count exceeds threshold → show in gang print interface
- Supports: preorders (no receiver orders yet) AND combining existing receiver orders with additional preprints
- Production slips generated at time of printing (resolves complexity of pre-existing receiver orders)

### Printing Interface Workflow

For a given buyer order:

1. Show how many prints needed per size (based on redeemed receiver orders)
2. Operator inputs excess quantity to preprint + storage location
3. Inventory deduction happens when production slip is created (not when receiver order comes in)
4. Interface prioritizes by oldest receiver order date

### Billing and Pricing

- Jason suggested 3 separate pricing columns on cart: digital branding, physical branding, merchandising
- Anna: simplifies things; initial build is physical branding only
- Amounts captured on buyer order billing details
- Bilal and Anna to discuss DB implications for billing separately (not blocking print interface work)

### Current Blockers

Cannot finalize or build until Jason/Olive clarify:

1. Does the JSON include separate template IDs and dimensions for products in the same size category (e.g., candy vs. candles in "small" box)?
2. Will the JSON contain a URL by size for images?
3. How does image approval link back to the preprints table?

Anna: no building yet — will follow up at weekly dev call (Feb 26) or impromptu meeting.

## Action Items

- **Jack**: Investigate storing multiple approved images per sleeve size; check if provided JSON contains URL by size
- **Anna + Jack**: Get clarification from Jason/Olive on JSON structure for minis — two different templates for candy vs. candles
- **Anna**: Talk to Bilal about billing/pricing DB implications for physical branding, digital branding, merchandise
- **Anna**: Wait for Jason/Olive response before making final decisions on print interface
- **Team**: Finalize preprinted sleeve inventory system design (quantity tracking, location, deduction workflow, cancellation rollback)
- **Team**: Rename `filed_by` → `printed_by` in preprint table
