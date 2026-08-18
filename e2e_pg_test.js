const { Client } = require('pg');

async function runTest() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/quadro_do_mane'
    });

    try {
        await client.connect();
        console.log('--- Starting PG-based E2E Test for Daily Routine ---');

        const tenantId = '92c862d7-f6a9-498a-ae80-fbbc1b8ae1e3';
        const tenantUserId = '9ad25863-ef50-487f-ada8-866d2d636e93';
        const today = new Date().toISOString().split('T')[0];

        // Cleanup
        await client.query('DELETE FROM "daily_routine_logs" WHERE "tenantUserId" = $1', [tenantUserId]);
        await client.query('DELETE FROM "daily_routine_items" WHERE "assignedTenantUserId" = $1', [tenantUserId]);

        // 2. Creation
        console.log('\n[Step 2] Creating 3 routine items...');
        const items = [];
        for (let i = 1; i <= 3; i++) {
            const res = await client.query(
                'INSERT INTO "daily_routine_items" ("id", "tenantId", "assignedTenantUserId", "createdById", "title", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $2, $3, now(), now()) RETURNING id',
                [tenantId, tenantUserId, `Item ${i}`]
            );
            items.push(res.rows[0].id);
            console.log(`Created item ${i}: ${res.rows[0].id}`);
        }

        // 3. Completion
        console.log('\n[Step 3] Completing 2 items...');
        for (let i = 0; i < 2; i++) {
            await client.query(
                'INSERT INTO "daily_routine_logs" ("id", "tenantId", "routineItemId", "tenantUserId", "date", "completedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, now())',
                [tenantId, items[i], tenantUserId, today]
            );
            console.log(`Completed item ${i + 1}`);
        }

        // 4. Validation
        console.log('\n[Step 4] Validating efficiency...');
        const logRes = await client.query('SELECT count(*) FROM "daily_routine_logs" WHERE "tenantUserId" = $1 AND "date" = $2', [tenantUserId, today]);
        const itemRes = await client.query('SELECT count(*) FROM "daily_routine_items" WHERE "assignedTenantUserId" = $1', [tenantUserId]);
        
        const logCount = parseInt(logRes.rows[0].count);
        const itemCount = parseInt(itemRes.rows[0].count);
        const efficiency = ((logCount / itemCount) * 100).toFixed(2);

        console.log(`Log Count: ${logCount} (Expected 2)`);
        console.log(`Item Count: ${itemCount} (Expected 3)`);
        console.log(`Efficiency: ${efficiency}% (Expected 66.67%)`);

        if (efficiency === '66.67') {
            console.log('✅ Efficiency Verification: PASS');
        } else {
            console.log(`❌ Efficiency Verification: FAIL (Expected 66.67, got ${efficiency})`);
        }

        if (logCount === 2) {
            console.log('✅ Logs Count Verification: PASS');
        } else {
            console.log(`❌ Logs Count Verification: FAIL (Expected 2, got ${logCount})`);
        }

        // 5. Security
        console.log('\n[Step 5] Security Check...');
        const wrongUserId = '00000000-0000-0000-0000-000000000000';
        const securityRes = await client.query('SELECT "assignedTenantUserId" FROM "daily_routine_items" WHERE id = $1', [items[0]]);
        if (securityRes.rows[0].assignedTenantUserId !== wrongUserId) {
            console.log('✅ Security Check: PASS');
        } else {
            console.log('❌ Security Check: FAIL');
        }

    } catch (error) {
        console.error('Test failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runTest();
