# Discuss Components / BOMs for SERP

Date: 2026-02-11

Invited: Anna Kifer, Jack Kiefer, Carolyn Pardee, John Lalucis, Matthew Patrick, Seth Finley

## Summary

Anna Kifer initiated a discussion with Jack Kiefer, Carolyn Pardee, and Seth Finley regarding the integration of Odo kits into Laravel, proposing that Laravel handle the SKU expansion of orders before sending the expanded order to Odo, which Carolyn Pardee supported but emphasized the need for a "cleaner way" to edit Bills of Materials (BOMs) in Laravel. Jack Kiefer proposed copying Odo's table structure for kits and other BOMs into a new Laravel table to simplify migration, a two-table approach that Anna Kifer and Carolyn Pardee supported for data import, with the existing kit implementation retaining current box components. Key data synchronization and linking points were addressed, including Jack Kiefer's need to update Laravel's linking from non-unique SKUs to buyer product IDs and Seth Finley's specification that the Sugar Wish ID should be used for matching, with Anna Kifer noting that the "500" prefix must be removed from Odo IDs for use in Laravel. Anna Kifer and Jack Kiefer discussed concerns about components like production paper, currently in BOMs but not tracked in the old system, which would require development work on the Odo side for proper ingestion and confirmed that the new BOM kits would reference the existing Laravel components table. The team confirmed that the existing `component_orders` table would be used to create component orders by pulling data from both the old `component_kits` and new BOM kits tables, and Anna Kifer concluded that buyer product information would likely no longer need to be sent to Odo.

## Details

### Integrating Odo Kits into Laravel

Anna Kifer initiated the discussion to understand the components and process for migrating Odo kits to Laravel while Odo is still in use for certain functions. Jack Kiefer suggested integrating the kits into Laravel so that Laravel expands the orders into SKUs and sends the expanded order to Odo, moving the logic from Odo to Laravel. Carolyn Pardee agreed with this approach but noted that Odo currently offers an easier way to change the logic, so a tool for editing the Bills of Materials (BOMs) in a "cleaner way" would be required in Laravel.

### Proposed Kit Integration Structure

Jack Kiefer proposed copying Odo's table structure, which stores both kits and other BOMs (labeled as "phantom bombs") in a single table, to simplify migration into a new table within Laravel. Jack Kiefer explained that merging them into the existing kit implementation in Laravel would require duplicating them for seasonal and default usage. Anna Kifer clarified that the current box components (seasonal or not) would remain in the existing kit implementation, and the new table would house all additional components, which Carolyn Pardee supported.

### Data Synchronization and Import

Anna Kifer confirmed that adopting the two-table plan would make importing data from Odo easier. Jack Kiefer noted that a change in Laravel would be necessary to handle the expansion of kits and components before sending the order to Odo. The process would involve sending the box component and other necessary components, as component orders, to Odo.

### Addressing Data Linking and ID Mapping

Jack Kiefer indicated that he would likely need to update the linking in Laravel from buyer product SKU to buyer product ID, as SKUs are not unique. Carolyn Pardee clarified that Odo's internal ID should correspond to the Sugar Wish ID. Anna Kifer explained that in the current system, the Odo ID for buyer products starts with "500," and for components it starts with "800," and that the "500" prefix would need to be removed to get the actual ID needed in Laravel. Seth Finley specified that the Sugar Wish ID should be used for matching.

### Component Data and Odo Ingestion

Anna Kifer raised concerns about components like production paper, which are currently in the BOMs but not tracked in the old system, and noted that development work on the Odo side might be needed to properly ingest this new component data. Jack Kiefer added that many Odo components referenced in the BOMs do not exist in Laravel's components table and would need to be added. Anna Kifer and Jack Kiefer confirmed that the new BOM kits would reference the existing Laravel components table.

### Order Processing and Component Quantity

Anna Kifer discussed the need for a follow-up meeting with Manish and BL to ensure preps and receiver orders pick up from the new BOM kits. The team confirmed that the existing `component_orders` table would be used to create component orders by pulling data from both the old `component_kits` table and the new BOM kits table. Anna Kifer verified with Carolyn Pardee that even items like production paper are tracked using a standard quantity in the components, simplifying the data transmission.

### Future of Buyer Product Information in Odo

The group considered whether to continue sending the buyer product information to Odo since the BOM expansion logic would move to Laravel. Anna Kifer concluded that they would not need to send it, but Jack Kiefer was tasked with asking Rick if the buyer product information is still required, as removing it would streamline the process and clean up Odo.

## Action Items

- Jack Kiefer will figure out how to parse out the 500 prefix from the ODO ID and import it into the new table.
- Jack Kiefer will ask Rick if the buyer product still needs to be sent to ODO.
- Jack Kiefer will add all components that are referenced but not in the components table to Laravel.
- Anna Kifer and Jack Kiefer will have a meeting with Manish and BL to ensure preps and receiver orders pick up from the BOM kits as well.
