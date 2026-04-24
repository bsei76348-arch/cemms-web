# CEMMS Project - Fix All Problems
Status: In Progress

## Steps:
- [x] 1. Create this TODO.md
- [ ] 2. Edit appdev-cs-web/appdev-cs-web/cemms-web/app/admin/combined/page.tsx:
  - Skip 'bills' collection defensively
  - Remove Type/Source from CEMMSRecord interface  
  - Remove Type column from CEMMS table thead/tbody
  - Remove type badge CSS/logic
  - Update filteredCemms: remove r.type from search
- [ ] 3. Update appdev-cs-web/cemms-web/TODO.md: mark step 2 [x]
- [ ] 4. Update nested appdev-cs-web/appdev-cs-web/cemms-web/TODO.md: complete
- [ ] 5. Test: cd appdev-cs-web/cemms-web && npm run dev
  - Verify CEMMS table: only Calculator+Web Input, no Type/Source columns
  - Search by barangay only, modals work, no console errors
- [ ] 6. Optional: cleanup duplicate cemms-web/, align reports/page.tsx
- [ ] 7. attempt_completion

