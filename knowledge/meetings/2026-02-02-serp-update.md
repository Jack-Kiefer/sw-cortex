# SERP Update

Date: 2026-02-02

Attendees: Anna Kifer, Jack Kiefer, Seth Finley, Ric Marquis, Matthew Patrick, John Lalucis

## Summary

The meeting focused on the phased Odoo to SERP transition plan, which Jack outlined in four phases starting with Purchase Orders. Matthew confirmed Jack now views this incremental approach as viable. Seth stressed modular system design to minimize risk. Anna voiced concern over the October 11th end date and proposed prioritizing system stability by moving non-essential "nice-to-have" features to post-launch and aiming for an early August launch. The group discussed starting the Kits and Inventory phase earlier, with Seth suggesting assigning a developer to help accelerate the timeline. Ric emphasized the critical need to incorporate financial reporting (FIFO costing, inventory valuation) into the SERP transition.

## Details

### Meeting Kick-off and Project Context

- John Lalucis and Matthew Patrick attended; John noted they were feeling ill
- Jack presented a proposed calendar and timeline for the Odoo → SERP transition (four phases)
- Matthew raised concern about prior discussions where Jack had expressed that a full SERP implementation was too complex

### SERP Implementation Approach and Viability

- Jack explained that the new incremental approach (granular steps with Odoo integration) gave more confidence than an all-at-once cutover
- Matthew confirmed Jack now considers the incremental phased approach viable, regardless of platform, as long as the system works
- **Seth: build the system as modular as possible** to ensure separation and minimize risk if one part fails

### Four Phases of Odoo to SERP Transition

1. **Purchase Orders (PO)** — move PO ownership to Laravel, sync arrivals back to Odoo to keep inventory quantities updated, add two-stage arrival process
2. **Bills** — move billing to SERP after POs are stable
3. **Raw Materials & Components / Kits** — migrate product data and BOMs into Laravel
4. **Manufacturing Orders & Inventory Management** — includes inventory adjustments

Goal: incrementally shift data ownership to Laravel, Odoo as fallback until each phase is stable.

### Timeline Concerns and Proposed Adjustments

- Anna: October 11th end date is too close to Halloween — high risk of delays bleeding into peak season
- **Proposed target: launch by early August** to allow time for stabilization before peak season
- Anna: move "nice-to-haves" to a post-launch improvement phase:
  - PO approval process
  - Blanket purchase orders (not currently in Odoo)

### Integrating Kits and Inventory Work Early

- Anna recommended starting Kits and Inventory discussions/planning immediately (before the planned July start) to surface complexities early and potentially compress the timeline
- Jack agreed: kits component is sufficiently separate to work on concurrently
- Seth: modular design enables this concurrent development

### Developer Support and Risk Mitigation

- Seth suggested assigning one developer specifically to the Kits and Inventory phase to reduce Jack's workload
- Jack supported this: Kits and Inventory is the best area for outside help (integrates with Laravel, team needs more knowledge there)
- Ric: if the team can't fully move Kits and Inventory away from Odoo, they need to resolve any associated problems before cutover to prevent future issues

### Component Management: Laravel vs. Odoo BOMs

- Matthew confirmed: no technical reason components can't be fully managed in Laravel (they ended up in Odoo due to earlier limitations)
- Most time-consuming part: transferring all components to Laravel and building related processes
- Caroline is reluctant to move kits before SERP is fully implemented — follow-up call scheduled for Wednesday to discuss kits and BOMs

### Costing and Financial Reporting in SERP

- **Ric: financial reporting is a hard requirement** — FIFO costing and inventory valuation are currently sourced from Odoo
- Jack: not included in current plan but could be added as an additional step (mostly a reporting function, may require DB additions)
- Ric: willing to spend time early to define the requirements, but this must be resolved before Odoo is phased out
- Jack and Ric to meet separately to define where costing requirements fit into the SERP plan

### Next Steps and Timeline Review

- Jack to update the plan by Wednesday or Thursday:
  - Remove nice-to-haves, move to post-launch improvement phase
  - Formally move Kits and Inventory to early/concurrent development
  - Review Feb 2025 requirements document to ensure nothing is missing
  - Share revised timeline
- Anna to schedule call with Caroline (next Wednesday) re: kits and BOMs
- Anna to create a new dedicated Slack channel for SERP planning

## Action Items

- **Jack**: Remove nice-to-haves from plan, put them at end as improvement phase; share adjusted timeline by Wed/Thu
- **Jack**: Re-review prior requirements document, incorporate missing items, adjust timeline accordingly
- **Jack**: Make DB design changes — add Odoo ID references in Laravel to track Odoo item IDs
- **Jack**: Build PO → Odoo sync; confirm with purchasing team that existing POs show correct data in SERP
- **Jack + Ric**: Meet separately to incorporate Odoo costing/financial reporting requirements into the SERP plan
- **Anna**: Schedule call with Caroline re: kits and BOMs (next Wednesday)
- **Anna**: Create new Slack channel for SERP planning and share meeting summary
