# Fix Staff Pages Refresh Redirect Issue

## Problem
Staff records and settings pages redirect to login on refresh because they don't check localStorage for mock/demo users.

## Root Cause
- Demo login stores user in `localStorage` as `cemms_user`
- `auth.onAuthStateChanged` returns `null` on refresh for mock users
- Pages without localStorage fallback immediately redirect to `/login`

## Files Fixed
- [x] `app/staff/records/page.tsx` — Added localStorage mock user fallback
- [x] `app/staff/settings/page.tsx` — Added localStorage mock user fallback

## Changes Made

### `app/staff/records/page.tsx`
- Added `checkAuth()` function that:
  1. Checks `auth.currentUser` first (real Firebase user)
  2. Falls back to `localStorage.getItem('cemms_user')` for mock/demo users
  3. Parses mock user JSON and sets user state
  4. Loads data before removing loading spinner
  5. Only redirects to `/login` if both Firebase AND localStorage have no user
- Updated `onAuthStateChanged` listener to check localStorage before redirecting

### `app/staff/settings/page.tsx`
- Same `checkAuth()` pattern added
- For mock users: sets basic staff details without Firestore lookup (since mock users don't exist in Firestore)
- Updated `onAuthStateChanged` listener to check localStorage before redirecting

## Testing Steps
1. Login with demo staff credentials (`staff@cemms.com` / `staff123`)
2. Navigate to `/staff/records`
3. Refresh the page — should stay on the records page instead of redirecting to login
4. Navigate to `/staff/settings`
5. Refresh the page — should stay on the settings page instead of redirecting to login

