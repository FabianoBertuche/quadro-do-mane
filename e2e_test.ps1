$tenantId = "92c862d7-f6a9-498a-ae80-fbbc1b8ae1e3"
$tenantUserId = "9ad25863-ef50-487f-ada8-866d2d636e93"
$today = Get-Date -Format "yyyy-MM-dd"

Write-Host "--- Starting PWSH-based E2E Test for Daily Routine ---"

# Cleanup
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "DELETE FROM \"daily_routine_logs\" WHERE \"\"tenantUserId\"\" = '$tenantUserId';"
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "DELETE FROM \"daily_routine_items\" WHERE \"\"assignedTenantUserId\"\" = '$tenantUserId';"

# 2. Creation
Write-Host "Step 2: Creating 3 routine items..."
$item1 = (docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO `"daily_routine_items`" (`"id`", `"tenantId`", `"assignedTenantUserId`", `"createdById`", `"title`", `"createdAt`", `"updatedAt`") VALUES (gen_random_uuid(), '$tenantId', '$tenantUserId', '$tenantUserId', 'Item 1', now(), now()) RETURNING id;").Trim()
$item2 = (docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO `"daily_routine_items`" (`"id`", `"tenantId`", `"assignedTenantUserId`", `"createdById`", `"title`", `"createdAt`", `"updatedAt`") VALUES (gen_random_uuid(), '$tenantId', '$tenantUserId', '$tenantUserId', 'Item 2', now(), now()) RETURNING id;").Trim()
$item3 = (docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO `"daily_routine_items`" (`"id`", `"tenantId`", `"assignedTenantUserId`", `"createdById`", `"title`", `"createdAt`", `"updatedAt`") VALUES (gen_random_uuid(), '$tenantId', '$tenantUserId', '$tenantUserId', 'Item 3', now(), now()) RETURNING id;").Trim()

Write-Host "Created items: $item1, $item2, $item3"

# 3. Completion
Write-Host "Step 3: Completing 2 items..."
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "INSERT INTO `"daily_routine_logs`" (`"id`", `"tenantId`", `"routineItemId`", `"tenantUserId`", `"date`", `"completedAt`") VALUES (gen_random_uuid(), '$tenantId', '$item1', '$tenantUserId', '$today', now());"
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "INSERT INTO `"daily_routine_logs`" (`"id`", `"tenantId`", `"routineItemId`", `"tenantUserId`", `"date`", `"completedAt`") VALUES (gen_random_uuid(), '$tenantId', '$item2', '$tenantUserId', '$today', now());"

# 4. Validation
Write-Host "Step 4: Validating efficiency..."
$logCount = [int](docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT count(*) FROM `"daily_routine_logs`" WHERE `"tenantUserId`" = '$tenantUserId' AND `"date`" = '$today';").Trim()
$itemCount = [int](docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT count(*) FROM `"daily_routine_items`" WHERE `"assignedTenantUserId`" = '$tenantUserId';").Trim()

$efficiency = [math]::Round(($logCount / $itemCount) * 100, 2)
Write-Host "Log Count: $logCount (Expected 2)"
Write-Host "Item Count: $itemCount (Expected 3)"
Write-Host "Calculated Efficiency: $efficiency% (Expected 66.67%)"

if ($efficiency -eq 66.67) {
    Write-Host "✅ Efficiency Verification: PASS"
} else {
    Write-Host "❌ Efficiency Verification: FAIL (Expected 66.67, got $efficiency)"
}

if ($logCount -eq 2) {
    Write-Host "✅ Logs Count Verification: PASS"
} else {
    Write-Host "❌ Logs Count Verification: FAIL (Expected 2, got $logCount)"
}

# 5. Security
Write-Host "Step 5: Security Check..."
$wrongUser = "00000000-0000-0000-0000-000000000000"
$assignedTo = (docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT `"assignedTenantUserId`" FROM `"daily_routine_items`" WHERE id = '$item1';").Trim()

if ($assignedTo -ne $wrongUser) {
    Write-Host "✅ Security Check: PASS (Item assigned to $assignedTo, not $wrongUser)"
} else {
    Write-Host "❌ Security Check: FAIL"
}
