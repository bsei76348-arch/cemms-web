# Data Sync Fix TODO

## Status: IN PROGRESS

### Critical Admin Fixes
- [ ] 1. `app/admin/live-stats/page.tsx` — Fix `calculations` to use `mobileDb` instead of `webCemmsDb`
- [ ] 2. `app/admin/reports/page.tsx` — Rewrite to use `mobileDb` + `webCemmsDb`, `AdminSidebar`, add `onSnapshot` listeners, fix Admin branding

### Staff Page Fixes (for consistency)
- [ ] 3. `app/staff/page.tsx` — Replace `db` with explicit `mobileDb` + `webCemmsDb`, add `onSnapshot`
- [ ] 4. `app/staff/live-stats/page.tsx` — Replace `db` with explicit `mobileDb` + `webCemmsDb`
- [ ] 5. `app/staff/live-map/page.tsx` — Replace `db` with explicit `mobileDb` + `webCemmsDb`
- [ ] 6. `app/staff/reports/page.tsx` — Replace `db` with explicit `mobileDb` + `webCemmsDb`, add `onSnapshot`

### Testing
- [ ] 7. Run dev server and verify real-time sync across all pages

