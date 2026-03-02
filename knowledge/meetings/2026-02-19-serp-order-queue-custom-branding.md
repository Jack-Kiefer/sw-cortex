# Discuss SERP Order Queue Implementation Along With Custom Branding Integration

Date: 2026-02-19

Invited: Anna Kifer, Jack Kiefer, Bilal Ahmed, Manish C, Seth Finley, Subash Chaudhary

## Summary

Anna Kifer, Jack Kiefer, Manish C, Seth Finley, Bilal Ahmed, Subash Chaudhary, and Rick discussed the plan to replace the ODO system with SERP before peak season, focusing on replicating ODO's functionality within SERP, building necessary APIs for order management, and implementing a SERP order queue to handle custom branding and eventually all merchandise orders. Key steps include building migration scripts to sync SERP with ODO tables, addressing data migration challenges due to Laravel developers' lack of ODO database knowledge, and incorporating a new MRP BOM table in Laravel for managing component orders, which will be critical for accurate inventory tracking. Anna Kifer scheduled a weekly meeting and noted that the assistance from Manish C saved three weeks on the project timeline, while Manish C requested the full plan document to review.

## Details

### Project Background and Objective

Anna Kifer provided a background, noting that the plan is to replace ODO this year before peak season because the current version of ODO is nearing retirement. Jack Kiefer has developed a plan for this launch and shared the full scope of what needs to happen, outlining the pieces that require Laravel developers and assistance from Manish C to expedite the process.

### Core Strategy for ODO Replacement

Jack Kiefer explained that the core idea is to build out SERP to mimic ODO as closely as possible, maintaining similar database tables, actions, and tracking mechanisms. This includes building UI in SERP that syncs to ODO for a gradual transition, and storing new custom branding options exclusively in SERP to use it as a testing environment.

### Initial Development Steps and Required APIs

Jack Kiefer's first step involves building out migrations to match ODO closely, figuring out integration with existing tables, and developing a minimal UI. They plan to build APIs for common ODO functions like reserving orders, shipping orders, and canceling orders, which will incorporate complex behind-the-scenes cost tracking.

### SERP Order Queue and Custom Branding Implementation

Jack Kiefer requires assistance implementing a SERP order queue, which will initially handle custom branding orders and later manage all orders involving merchandise selections. This queue needs to be triggered from Laravel when orders are placed, shipped, or canceled, and must be designed to eventually handle every single incoming order robustly.

### Handling Box Addbacks and Reconciliation

Jack Kiefer noted that components for custom branding orders will be finalized before shipping, which requires sending a reserve action to SERP. A challenge identified is that the regular box might be reserved from the kit via ODO and then added back, leading Jack Kiefer to propose a daily reconciliation workflow to unreserve those items in ODO.

### Addressing Box Addback Concern

Anna Kifer raised a concern about the necessity of adding back boxes and suggested that the plan should address finding the correct way to handle this before fully switching off ODO. Jack Kiefer agreed that if the kits project occurs after this implementation, the issue could be addressed as part of that project.

### Data Requirements for Tracking Reservations

To track reservations and costing within SERP, Jack Kiefer needs to add columns to EC order, pre-select orders items, or component orders tables in Laravel. These columns could store information such as a picking ID returned from the SERP APIs, or a state to ensure the sync has occurred correctly.

### Purchase Order UI and Data Migration

The next step involves Jack Kiefer building out the UI for purchase orders and migrating data from ODO to SERP/Laravel, including purchase orders, line items, back orders, suppliers, and associated bills. The plan is for editing to be done within SERP, with arrival data sent to ODO via XML RPC, and existing component IDs in Laravel mapped to ODO IDs for linking.

### Kits Project and Component Order Creation

Jack Kiefer proposed a project to move ODO kits data into a separate table in Laravel so that, upon receiving an order, this data can be used to create component order records that are then sent to ODO. This will result in two kit implementations in Laravel, allowing for the direct migration of ODO data without merging it into the existing kit table structure.

### Linking Kits to Existing Buyer Orders

When Manish C inquired how the kits would be connected to the existing site, Jack Kiefer explained that the kits would use the same buyer order ID that ODO currently uses. The migration will send this buyer product ID to the new MRP BOM table, enabling matching when an order comes in.

### SERP Interfaces for ODO Actions and Data Sync

The following phase focuses on building interfaces within SERP for performing actions that are then sent to ODO via XML RPC, gradually shifting more actions to SERP. This includes adding products from ODO to the components table, making Laravel the source of truth for products, and then building out inventory adjustments and bill of materials editing in SERP.

### Transitioning ODO to Inventory-Only Use

The ultimate goal is to limit ODO's role to just providing an inventory number, with all actions done through the SERP interface. This strategy aims to simplify the final switch-over from ODO inventory to Laravel inventory, making the change seamless for the team.

### Data Migration Assistance and Full Order Queue Implementation

Jack Kiefer will need help exporting data from ODO into SERP at each phase and correctly setting up mappings to ODO or existing tables. For the final launch, the full, robust implementation of the SERP order queue must be complete to handle all orders and track cost of goods sold records.

### Final Inventory Switch Over and Reporting

The final stage requires moving all inventory data to the SERP stock quant table, which holds inventory by physical shelf location. Inventory quantity will be calculated when accessed using multiple views, requiring all access points (Laravel, Retool, Wishdesk) to join the relevant inventory views, and all financial reports needed by Rick will be built.

### Establishing Communication and Review

Anna Kifer scheduled a weekly meeting every Tuesday to provide updates and resolve issues that cannot be handled via Slack. Manish C requested the full plan document to review before committing to questions and the next steps.

### Tracking Ship Status and Required Event Triggers

Manish C and Anna Kifer discussed how orders are marked as shipped, which Seth Finley clarified comes from Shiplink when a label is scanned. Jack Kiefer confirmed they need the reserve action to be immediate to accurately track inventory (on hand minus reserved), while the shipped action (which unreserves and deducts inventory) could potentially be scheduled.

### Addressing Data Migration Expertise

Manish C noted that the Laravel developers lack knowledge on the structure of the ODO database, suggesting the data migration part requires further discussion. Jack Kiefer acknowledged this and stated they are finalizing the database structure to provide an exact plan for what data needs to be migrated and how, including special circumstances. Anna Kifer confirmed that Manish C would likely handle most of the migration work.

### Rationale for Separate Kits/BOM Tables

Anna Kifer explained the background for the separate kit implementation, clarifying that ODO currently uses a Bill of Materials (BOM) to determine component deductions beyond the boxes. The new MRP BOM table in Laravel will house this system separately from the current component kits, which are used to differentiate seasonal versus non-seasonal boxes, thereby avoiding the duplication of kits.

### Order Processing with New Kits/BOM

Anna Kifer clarified that the BOM records will be set up ahead of time, similar to normal kits. When a receiver order is placed, component orders will be created for both the normal component order process and the correct BOM kit, along with any component orders needed for custom branding.

### Assignment of Laravel Tasks

Anna Kifer indicated that Bilal Ahmed's part of the implementation would focus on pre-selects, while Manish C and Subash Chaudhary would handle receiver flow work, with Manish C also managing the additional tasks. Jack Kiefer has started building the backend services in SERP that mimic ODO to finalize the database migration.

### Timeline Significance

Anna Kifer concluded by informing Manish C that their assistance with the migration work helped carve out three weeks from the project timeline, which was critical to prevent running too close to the peak season.

## Action Items

- Jack Kiefer will add the discussion about the box reservation/deduction process to the plan to ensure it's addressed before fully switching off of ODO.
- Jack Kiefer will build out a more exact plan detailing which data needs to be moved over from ODO into SERP and at which time, as well as all the special circumstances for migration, and send the full plan document to the group so they can look over it.
- Manish C will go through the plan document once, and after reviewing, will put forth some questions.
- Anna Kifer will ask Matt if the 'shipped' event needs to be immediate or if it could be scheduled every 30 minutes or every hour.
- The group will review the plan before the call next Tuesday and come with any additional questions.
