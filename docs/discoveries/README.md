# Discovery Documentation Index

This directory contains documentation of research sessions and database discoveries saved to the knowledge base.

## Saved Sessions

### kit-migration-session-jan2026.md

**Date**: January 28, 2026
**Topic**: Odoo to Laravel Kit Migration Research
**Status**: 5 critical discoveries saved to knowledge base

**Key Findings**:

1. component_orders table missing odoo_sync field (CRITICAL BLOCKER)
2. Items vs component_orders serve different purposes
3. Laravel kits are for accessories, not BOMs
4. Odoo has 1,244 active BOMs (977 normal + 267 phantom)
5. Proposed strategy: Move BOM logic from Odoo to Laravel/SERP

**Files**:

- `/home/jackk/sw-cortex/scripts/save-kit-migration-discoveries.ts` - Import script
- `/tmp/save_discoveries.json` - Ready-to-import JSON payload
- `/tmp/discoveries_summary.txt` - Quick reference summary

**Search Queries**:

- "component_orders odoo_sync"
- "BOM migration Laravel"
- "phantom BOM"
- "items vs component_orders"
- "kits accessories"

---

## How to Use This Directory

1. **Find Existing Discoveries**: Search queries listed in each session
2. **Review Findings**: Read the markdown file for full context
3. **Implement Discoveries**: Use the scripts or JSON payload to import
4. **Track Progress**: Update this README as new sessions are completed

## Related Documentation

- **Database Rules**: `/.claude/rules/databases.md`
- **Discovery Guidelines**: `/.claude/rules/db-discoveries.md`
- **Main README**: `/CLAUDE.md`

---

_Updated: Jan 28, 2026_
