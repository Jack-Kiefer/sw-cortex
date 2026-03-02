# Weekly Dev Standup

Date: 2026-01-29

Attendees: Anna Kifer, Seth Finley, Subash Chaudhary, Manish C, Bilal Ahmed, Aashish Shrestha, Munyr Ahmed

## JS Library Updates

- Discussion about updating JS libraries across the codebase
- Components can be updated independently (no need to push all at once)
- Plan: use npm/package manager to install specific JS libraries rather than updating CDN URLs in layout files
- One person should handle library updates across all layout files to avoid conflicts
- Anna: team should coordinate and put together a plan covering who works on what, what needs to go live together
- Seth: libraries should have a designated owner for technical upgrades (packages, libraries, etc.)

## Tailwind CSS Migration Analysis (Aashish)

- Aashish prepared a report on whether to implement Tailwind CSS
- Current state: ~36,000 lines of SCSS across 81 files, Bootstrap + custom design system, ~12,000 internal styles, ~7.8–8 MB of CSS
- Full Tailwind migration: very difficult given current Bootstrap-dependent setup
- Possible approach: install Tailwind for new pages/components only, run alongside Bootstrap (class conflicts are manageable if kept to separate pages/components)
- Rough timeline for incremental migration: 3–4 months with 1–2 dedicated developers
- **Decision: Not worth doing right now.** Seth and Manish agreed the monetary/efficiency gains don't justify the effort
- Seth: focus on things with real forward progress (e.g., routes-to-files, SQLite) rather than nice-to-haves
- Tailwind could be reconsidered if/when more pages move from Blade templates to React

## React Migration Candidates (Manish)

- Manish put together a list of 7 components/areas to potentially move to React (beyond the receiver flow):
  1. Buyer order flow (may skip if moving to new architecture)
  2. Wish link flow
  3. Prep flow
  4. Corporate account section
  5. Consumer account section
  6. Admin section
  7. Authentication system (sign up / sign in)
- Authentication system discussion:
  - Would support both Laravel (sessions) and React (JWT tokens)
  - Could potentially centralize auth for WishDesk, SERP, and other internal tools
  - Would use both sessions (Laravel) and JWT tokens (React components) simultaneously
  - Seth: valuable to expose auth APIs so other systems can use them
  - Next step: think through benefits for WishDesk and other tools being built
- Anna: will discuss with Kaylee (product) about the process for sharing tech recommendations and clarify direction on proposals vs buyer flow
- Wish link flow, prep flow etc. require significant product involvement before proceeding

## Gift Card Cron Optimization (Manish)

- Current setup: 10 cron jobs for sending gift card emails/SMS, partitioned by last digit of card ID
- Uses MySQL `RIGHT()` function to get last digit — this prevents index usage, making queries slower
- Two optimization alternatives identified:
  1. **Modular operator** (`card_id % 10`): 5–10x faster
  2. **Generated virtual column** with index on last digit: 100–1000x faster
- Generated column approach: virtual column (not stored), stores `card_id % 10`, can be indexed
- **Key question raised by Seth/Anna**: how is this actually presenting as a problem today?
  - Not affecting checkout — affects email/SMS send speed
  - Not currently quantified — Manish hasn't measured actual slow query times
- **Next steps for Manish**: measure actual query performance, quantify impact, then decide if optimization is worth the DB schema change
- Anna: focus optimization efforts where they make the biggest difference; also consider whether reworking the gift_cards table (too many fields) would be more impactful overall
- Database performance monitoring: currently no one is proactively monitoring slow queries, connection counts, etc. — Anna and Seth to discuss ownership in their 1-on-1

## Packaging / Custom Box Printing Initiative (Seth)

- Packaging has become unprofitable and operationally complex (6–7 occasion-specific box designs per year, high switching/stocking costs)
- **New direction**: switch to standard white boxes + on-demand custom printing (similar to mug printing)
- ~40% of corporate customers surveyed said they'd pay extra for customized boxes
- Vision: design suite in WishDesk (like mug design), allow logo/customization, then save design and print onto boxes
- Tech flow: design in WishDesk → save to S3 or system → send to printer
- Meeting tomorrow at 9 AM to discuss with product — Subash, Manish, and Anna to attend
  - Subash: worked on mug image upload side
  - Manish: worked on assigning mug image to receiver order
  - Both needed since box feature will likely touch both upload and order assignment

## Receiver Flow Retrospective (Subash)

- Receiver flow had issues: fixing one flow broke another
- Key lesson: don't solely rely on AI to understand all edge cases for complex flows
- Should talk to team members who have domain knowledge before starting complex projects
- Seth: reach out immediately when starting ownership projects — 15–30 min conversation to map out the full picture is worth it
- Anna: Claude/AI is good for simple questions but lacks depth of understanding for complex flows like receiver flow; domain knowledge from team members makes a real difference
- Seth: as issues come up with ownership projects, discuss them afterwards to help the team avoid repeating the same mistakes

## DB Control (Munyr)

- Munyr requested Anna/Seth check the DB control panel
- A change request is pending approval — once approved, it can be moved to live
- Anna confirmed low risk, approved moving to live
