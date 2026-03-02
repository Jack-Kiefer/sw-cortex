# Discuss Full Updated SERP Plan

Date: 2026-02-18

Attendees: Anna Kifer, Jack Kiefer, Matthew Patrick, Seth Finley

## Summary

Pre-meeting prep for the Laravel developer kickoff call (Feb 19). Key topics: timeline pressure (Oct 4 deadline), delegation strategy (Manish on data migration scripts), kit migration complexity (differing product table structures between Odoo and SERP), and establishing weekly Tuesday 8 AM project meetings with Jack running them.

## Details

### Tomorrow's Developer Meeting

- Anna: 30 minutes may not be enough for the Laravel developer meeting tomorrow
- Seth: confirmed the conflicting meeting was already removed
- Decision: extend to 1 hour — cover the full plan, address questions, outline what's needed from developers in each phase

### Timeline Concerns

- **Hard deadline: October 4th** — Anna described it as "really, really pushing it"
- Goal: find 3–4 weeks to cut from the timeline
- Weekly updates needed to confirm if the team is on track
- Anna: clear requirements outline needed for Laravel developers before tomorrow

### Core SERP Goal

- Jack: the core goal is making SERP replicate Odoo's functionality
- All integrations should interact with SERP the same way they currently interact with Odoo
- Key behaviors to mirror:
  - Reserve inventory via APIs when orders are placed
  - Trigger actions when items are shipped or canceled
- Approach: keep implementation as simple as possible by closely mirroring Odoo's processes

### Kit Migration Complexity

- 8 weeks allocated for kits — primarily for building the **data migration script** to export BOMs and kits from Odoo → SERP
- Key complexity: **differing product table structures**
  - Odoo: single product table
  - Laravel/SERP: separate tables for receiver products and components
- Matching products across these structures is the hard part — UI for kit editing is NOT the bottleneck
- Anna: could kit editing UI be delegated to Laravel devs? Jack: yes, but data migration is the real challenge

### Delegating to Manish

- Seth suggested establishing a secondary lead
- Anna: **Manish** is the best fit — most experience with Odoo, should be looped in immediately
- Jack's proposal: Manish handles **preparing and testing data migration scripts** for each phase
- DB clarification (Seth): SERP uses the Laravel database (not a separate one) — makes sense given strong connection to orders
- Anna: Jack to analyze data migration pieces and estimate how many weeks could be saved if Manish works on them in tandem

### Order Processing and Queue Strategy

- Order processing sequence: custom branding orders first, then orders with merchandise selections
- These need to be processed correctly and sent to SERP to trigger inventory adjustments
- Jack: need a **queue system** (in SERP or elsewhere) to process orders
- Becomes more critical in the final phase when all orders move through SERP

### Weekly SERP Project Meetings

- **Schedule: Tuesdays at 8:00 AM** (recurring)
- Format: quick updates, major blockers, unresolved issues from the week — not meant to take the full 45 min
- **Jack runs the meetings** (as project manager)
- Anna to schedule recurring invite

## Action Items

- **Jack**: Analyze data migration pieces; estimate weeks saved if Manish assists; update timeline before tomorrow
- **Jack**: Extend tomorrow's developer call to 1 hour
- **Jack**: Run weekly Tuesday 8 AM SERP project meetings
- **Anna**: Schedule recurring Tuesday 8 AM SERP meeting
