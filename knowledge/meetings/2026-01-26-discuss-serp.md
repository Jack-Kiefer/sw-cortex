# Discuss SERP

Date: 2026-01-26

Invited: Anna Kifer, Jack Kiefer, Seth Finley

## Summary

Anna Kifer and Jack Kiefer discussed SER implementation concerns and ODO platform issues, with Jack Kiefer noting that SER requires a large-scale coordination effort to implement and Anna Kifer highlighting the necessary upgrade to the current ODO version before October. The participants explored alternative SER rollout strategies and challenges, acknowledging the difficulty of incremental transitions due to shared raw materials and the complexity of component tracking across SER and ODO. Jack Kiefer estimated SER to be only 25% to 50% complete and emphasized the need for project management support, integration testing, and a method for capturing a "snapshot in time" of inventory, a concept Seth Finley also inquired about. Jack Kiefer agreed to prepare a detailed incremental rollout plan, including handling data synchronization with ODO, for review in a follow-up meeting with Anna Kifer.

## Details

### Personal Updates

Seth Finley and Jack Kiefer discussed the weather, noting the large amount of snow on the East Coast. Anna Kifer shared that their birthday weekend was good and that they attended a paranormal event.

### SER Implementation Concerns and ODO Platform Issues

Anna Kifer initiated the discussion to address Jack Kiefer's uncertainty about moving forward with SER. Jack Kiefer expressed concern about the scale of implementing SER, stating it requires a "very large scale coordination effort" and must happen all at once, making it difficult to start with individual pieces. Anna Kifer also highlighted that in addition to the cost of the ODO platform, they would need to upgrade the entire ODO version before October as the current version is being retired.

### Incremental SER Rollout Challenges

Jack Kiefer explained the difficulty of transitioning products to SER one at a time due to concerns about the complexity of tracking inventory across both SER and ODO. They mentioned that many products use the same packaging, making separation difficult without duplicating and splitting inventory. Anna Kifer suggested dividing the transition by product size, but Jack Kiefer noted that raw materials would still overlap across everything.

### Alternative SER Rollout Strategies

Anna Kifer and Seth Finley explored rolling out SER in smaller phases, such as sending inventory or orders from SER. Jack Kiefer suggested potentially having ODO track inventory while SER handles the bill of materials, or moving over "kits" entirely to Laravel. However, Jack Kiefer noted that migrating kits involves complexities because component inventory is not currently fully built out or tracked correctly in Laravel.

### Component Tracking and Dual-Function Products

Jack Kiefer clarified that the goal would be to move kits to Laravel to centralize inventory calculation for them. Anna Kifer inquired about the complexity of components being considered both components and raw materials, to which Jack Kiefer cited the example of the bamboo soap dish. Anna Kifer acknowledged the difficulty of determining a phased rollout without seeing the full functionality of SER.

### Support Needed for SER Implementation

Jack Kiefer estimated they would need help with "splitting up responsibilities" and project management to ensure individual pieces of SER are working. They expressed concern about the integration with Laravel, especially regarding the synchronization of orders and inventory decrementing, and the necessary complexity of moving existing syncs from ODO to SER. Anna Kifer suggested that receiver product inventory is the only part of Laravel significantly affected by SER, although components would require more work to ensure correct syncing.

### Worst-Case Scenario and Inventory Management Backstops

Seth Finley asked about the worst-case scenario if the inventory transition went wrong, which Jack Kiefer identified as incorrect inventory data. Anna Kifer stressed the need for a "snapshot in time" of the inventory to effectively calculate and verify correctness, noting that they currently lack this mechanism. Jack Kiefer confirmed that while inventory changes are logged, the log does not capture the inventory state at a specific moment for order deductions. Anna Kifer suggested researching industry best practices for inventory management backstops and reiterated the need for project management and testing support, including getting help from others like JP.

### Current Status of SER Development

When asked about alternatives to SER, Jack Kiefer acknowledged the difficulty of maintaining an extra database with ODO but noted that building out SER requires significant overhead to replicate ODO's existing functionality. Jack Kiefer estimated that SER is only between 25% and 50% complete, largely due to the many intricate details required for processes like purchase order receiving and storage. Jack Kiefer confirmed that a lack of focused resources makes further development difficult.

### Developing an Incremental Rollout Plan

Seth Finley suggested breaking up the SER implementation into smaller, sequential steps, such as focusing on purchase orders first. Anna Kifer highlighted that starting with purchase orders means the inventory would go into SER, requiring a sync back to ODO if ODO remains the main inventory system. Jack Kiefer agreed that an incremental approach is ideal and described their current inventory count system as a foundational piece that could be adapted to sync with SER later. Anna Kifer proposed that Jack Kiefer outline a detailed incremental rollout plan, including the "lowest hanging fruit" and how to handle data synchronization with ODO for each stage, such as updating ODO only upon product receipt.

### Next Steps and Follow-up Meeting

Jack Kiefer agreed to put together a detailed plan of the SER pieces and ideas for an incremental rollout. Anna Kifer scheduled a follow-up call for Thursday at 11 to review Jack Kiefer's proposed plan, noting that they needed that time to prepare.

## Action Items

- Jack Kiefer will think through all the pieces of SER to determine how to implement it incrementally, including (1) breaking down the pieces into stages, and (2) identifying the lowest hanging fruit by Wednesday or Thursday.
- Anna Kifer will do project management for the SER rollout.
- Anna Kifer, Jack Kiefer, and Seth Finley will meet again on Thursday at 11 to review the breakdown and ideas for SER implementation.
