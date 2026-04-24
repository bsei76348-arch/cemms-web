# Combined Dashboard Simplification & Fixes
Status: In Progress

## Steps:
- [x] 1. Create TODO.md (done)
- [x] 2. Edit app/admin/combined/page.tsx: 
  - Remove Type/Source columns from CEMMS table
  - In fetchAllData: Skip 'bills' collection (no Bill Scan)
  - Remove type/source badge classes and display logic
  - Update search/filter to exclude type
- [x] 3. Test table shows only Calculator (mobile calc) + Web Input, no Bill Scan, no Type/Source columns
- [x] 4. Verify add/edit modal works (inserts to emissions)
- [ ] 5. Remove 'bills' references from admin/staff pages (live-map, live-stats, reports, etc.)
- [ ] 6. Final test and completion
