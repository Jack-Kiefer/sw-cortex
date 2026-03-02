# Release Notes - February 9, 2026

Date: 2026-02-09

## Gift Genie / Quiz Flow

- **Guest email pre-fill** - When visitors arrive via a Genie link with an email parameter (e.g., from Klaviyo), their contact information is pre-filled automatically so they don't have to retype it.
- **Plus-sign email fix** - Emails like user+tag@gmail.com from Klaviyo links now work correctly (Klaviyo encodes the + as a space, which broke login and logo lookups).
- **Session reuse on refresh** - If a user refreshes, opens a new tab, or hits the back button mid-quiz, the system returns their existing in-progress session instead of creating a duplicate entry.
- **Cart partial timeout extended** - Users redirected from the product page to Genie now have 5 minutes (up from 30 seconds) to complete their selections before the cart data expires.
- **Occasion-based template selection** - Quiz proposals now select eCard templates based on the occasion (birthday, anniversary, appreciation, etc.) instead of picking randomly from a generic pool.
- **Mug variant logo fix** - Logos uploaded during the quiz are now correctly used when generating mug variants on proposals. Previously the system ignored quiz-uploaded logos and only checked the account logo.

## Orders & Tickets (New)

- **Email ticket dashboard** - New section at Admin > Orders & Tickets for managing order-related email tickets. Includes sortable/filterable ticket list, individual ticket detail with full conversation timeline, and unread indicators.
- **Compose & reply** - Agents can compose new outbound emails (which auto-create tickets) and reply to existing ticket threads. Internal notes are supported for team-only communication.
- **File attachments** - Drag-and-drop file upload on tickets with support for common file types (up to 10 MB).
- **AI ticket summary** - One-click AI-generated summary of a ticket conversation with a suggested next action.
- **Repeating proposals view** - Dedicated tab showing proposals with "Repeating Order" status for quick access.
- **Ticket assignment & metadata** - Assign tickets to team members, set priority, link to proposals, and tag a Gift Concierge.

## Live Chat / Agent Tools

- **Promo codes tab** - Both the agent chat and live chat side panels now show a "Promo Codes" tab listing all promo codes issued to the current user, including discount amount, expiration, status (active/expired/used), occasion, and source quiz.

## Proposals

- **"Upload A List" button** - New shortcut button next to "Add / Import Recipients" that opens the recipient manager directly to the CSV upload screen, skipping the method selection step.
- **Branding fields** - Proposals now have dedicated digital_branding, physical_branding, and merchandise JSON fields (previously everything was packed into the general details field). A new branding_records table captures branding state at add-to-cart time.

## Design Suite

- **Sleeve template type** - New "Sleeve" template format for gift box sleeve designs. Supports custom canvas dimensions (100-5000 px) with a performance warning for very large canvases. Sleeve templates appear in the admin gallery with a purple badge and are hidden from customer-facing template selectors.
- **Master/child template relationships** - Templates can now reference a "master" template via the new master_id field, enabling variant hierarchies for sleeve designs.

## Security & Infrastructure

- **S3 URL validation** - New SSRF protection on unauthenticated endpoints. Logo URLs are validated against a strict allowlist of Sugarwish S3 buckets, with private/internal IP blocking and HTTPS enforcement.
- **Rate limiting on new endpoints** - Logo upload (30/15min), logo lookup (30/5min), mug template processing (15/5min), and logo retrieval endpoints all have production rate limits.
- **Read-only database pool for reads** - Multiple endpoints switched from the write-capable mcpWritePool to the read-only sugarwishPool for SELECT queries, following the principle of least privilege.
- **Email enumeration fix removed** - Removed email-only authentication fallback that could confirm whether an email exists in the system.
- **Seed data safety** - Orders-tickets seed/demo data moved from app startup to a standalone script and gated behind NODE_ENV !== 'production' to prevent demo tickets on live.
- **JWT token authentication** - Genie links now support signed JWT tokens as the highest-priority auth method, preventing URL parameter tampering.

## Database Migrations

- **0073** - Adds master_id column to design_templates with self-referencing foreign key for sleeve template variants.
- **0074a** - Creates orders_tickets, orders_ticket_events, and orders_ticket_attachments tables with indexes.
- **0074b** - Adds digital_branding, physical_branding, merchandise columns to proposals table and creates branding_records table.

## Dependency Updates

- @modelcontextprotocol/sdk 1.24.0 -> 1.25.3
- bcrypt 5.1.1 -> 6.0.0
- fabric 6.7.1 -> 7.1.0
- react-router / react-router-dom 7.7.1 -> 7.13.0
- tar 7.4.3 -> 7.5.6
