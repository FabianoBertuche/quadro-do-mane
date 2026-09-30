# Task 2 Fix Report

- Fixed the OAuth distributed refresh race by carrying the unique lease token through refresh execution.
- Token rotation and invalid-grant revocation now use tenant-scoped conditional updates requiring the current lease token, so an expired refresh cannot overwrite a newer refresh result.
- Added a regression test that overlaps a slow refresh with a lease-expired refresh and verifies the newer tokens remain persisted.
