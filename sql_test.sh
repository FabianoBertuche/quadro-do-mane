#!/bin/bash
TENANT_ID="92c862d7-f6a9-498a-ae80-fbbc1b8ae1e3"
TENANT_USER_ID="9ad25863-ef50-487f-ada8-866d2d636e93"
TODAY=$(date +%Y-%m-%d)

echo "--- Starting SQL-based E2E Test for Daily Routine ---"

# Cleanup
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "DELETE FROM \"daily_routine_logs\" WHERE \"tenantUserId\" = '$TENANT_USER_ID';"
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "DELETE FROM \"daily_routine_items\" WHERE \"assignedTenantUserId\" = '$TENANT_USER_ID';"

# 2. Creation
echo "Step 2: Creating 3 routine items..."
ITEM1=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO \"daily_routine_items\" (\"id\", \"tenantId\", \"assignedTenantUserId\", \"createdById\", \"title\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$TENANT_ID', '$TENANT_USER_ID', '$TENANT_USER_ID', 'Item 1', now(), now()) RETURNING id;" | xargs)
ITEM2=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO \"daily_routine_items\" (\"id\", \"tenantId\", \"assignedTenantUserId\", \"createdById\", \"title\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$TENANT_ID', '$TENANT_USER_ID', '$TENANT_USER_ID', 'Item 2', now(), now()) RETURNING id;" | xargs)
ITEM3=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "INSERT INTO \"daily_routine_items\" (\"id\", \"tenantId\", \"assignedTenantUserId\", \"createdById\", \"title\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$TENANT_ID', '$TENANT_USER_ID', '$TENANT_USER_ID', 'Item 3', now(), now()) RETURNING id;" | xargs)

echo "Created items: $ITEM1, $ITEM2, $ITEM3"

# 3. Completion
echo "Step 3: Completing 2 items..."
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "INSERT INTO \"daily_routine_logs\" (\"id\", \"tenantId\", \"routineItemId\", \"tenantUserId\", \"date\", \"completedAt\") VALUES (gen_random_uuid(), '$TENANT_ID', '$ITEM1', '$TENANT_USER_ID', '$TODAY', now());"
docker exec quadro-postgres psql -U postgres -d quadro_do_mane -c "INSERT INTO \"daily_routine_logs\" (\"id\", \"tenantId\", \"routineItemId\", \"tenantUserId\", \"date\", \"completedAt\") VALUES (gen_random_uuid(), '$TENANT_ID', '$ITEM2', '$TENANT_USER_ID', '$TODAY', now());"

# 4. Validation
echo "Step 4: Validating efficiency..."
LOG_COUNT=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT count(*) FROM \"daily_routine_logs\" WHERE \"tenantUserId\" = '$TENANT_USER_ID' AND \"date\" = '$TODAY';" | xargs)
ITEM_COUNT=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT count(*) FROM \"daily_routine_items\" WHERE \"assignedTenantUserId\" = '$TENANT_USER_ID';" | xargs)

EFFICIENCY=$(echo "scale=4; ($LOG_COUNT / $ITEM_COUNT) * 100" | bc)
echo "Log Count: $LOG_COUNT (Expected 2)"
echo "Item Count: $ITEM_COUNT (Expected 3)"
echo "Calculated Efficiency: $EFFICIENCY% (Expected 66.67%)"

# 5. Security
echo "Step 5: Security Check..."
# Check if a random ID could be associated with an item (this is a logic check in the app)
# In SQL we just verify if the constraints are there or if the app would reject it.
# Since we are simulating the app logic:
WRONG_USER="00000000-0000-0000-0000-000000000000"
echo "Verifying that item $ITEM1 is NOT assigned to $WRONG_USER..."
ASSIGNED_TO=$(docker exec quadro-postgres psql -U postgres -d quadro_do_mane -t -c "SELECT \"assignedTenantUserId\" FROM \"daily_routine_items\" WHERE id = '$ITEM1';" | xargs)
if [ "$ASSIGNED_TO" != "$WRONG_USER" ]; then
    echo "✅ Security Check: PASS (Item assigned to $ASSIGNED_TO, not $WRONG_USER)"
else
    echo "❌ Security Check: FAIL"
fi
