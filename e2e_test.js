const { spawn, execSync } = require('child_process');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';

async function runTest() {
    console.log('--- Starting E2E Test for Daily Routine ---');

    try {
        // 1. Setup: Identify valid tenant and user
        console.log('\n[Step 1] Setup: Fetching tenant and user...');
        const tenantUser = await prisma.tenantUser.findFirst({
            include: { tenant: true, user: true }
        });

        if (!tenantUser) {
            throw new Error('No tenantUser found in database. Please seed the DB first.');
        }

        const { tenantId, id: tenantUserId } = tenantUser;
        const { id: userId } = tenantUser.user;

        console.log(`Using Tenant: ${tenantId}`);
        console.log(`Using TenantUser: ${tenantUserId}`);

        // 2. Creation (ADM): Create 3 routine items
        console.log('\n[Step 2] Creation (ADM): Creating 3 routine items...');
        const routineItems = [];
        for (let i = 1; i <= 3; i++) {
            const res = await axios.post(`${API_URL}/daily-routine/items`, {
                tenantId,
                assignedTenantUserId: tenantUserId,
                createdById: tenantUserId, // Simulating admin as the same user for simplicity or another valid admin
                title: `Routine Item ${i}`,
                description: `Description for item ${i}`,
                scheduledTime: '09:00'
            });
            routineItems.push(res.data);
            console.log(`Created item ${i}: ${res.data.id}`);
        }
        console.log('Successfully created 3 items.');

        // 3. Completion (Employee): Mark 2 items as completed
        console.log('\n[Step 3] Completion (Employee): Marking 2 items as completed...');
        const today = new Date().toISOString().split('T')[0];
        for (let i = 0; i < 2; i++) {
            const res = await axios.post(`${API_URL}/daily-routine/complete`, {
                routineItemId: routineItems[i].id,
                tenantUserId: tenantUserId,
                date: today,
                notes: 'Completed for test'
            });
            console.log(`Completed item ${i + 1}: ${res.status} ${JSON.stringify(res.data)}`);
        }
        console.log('Successfully marked 2 items as completed.');

        // 4. Validation (ADM Audit): Verify efficiency and logs
        console.log('\n[Step 4] Validation (ADM Audit): Verifying logs...');
        const auditRes = await axios.get(`${API_URL}/daily-routine/admin/logs`, {
            params: {
                tenantUserId: tenantUserId,
                startDate: today,
                endDate: today
            }
        });

        const { efficiency, logs } = auditRes.data;
        console.log(`Efficiency: ${efficiency}%`);
        console.log(`Logs count: ${logs.length}`);

        if (efficiency === '66.67%') {
            console.log('✅ Efficiency Verification: PASS');
        } else {
            console.log(`❌ Efficiency Verification: FAIL (Expected 66.67%, got ${efficiency})`);
        }

        if (logs.length === 2) {
            console.log('✅ Logs Count Verification: PASS');
        } else {
            console.log(`❌ Logs Count Verification: FAIL (Expected 2, got ${logs.length})`);
        }

        // 5. Security Check: Attempt with wrong tenant user
        console.log('\n[Step 5] Security Check: Testing unauthorized completion...');
        try {
            const wrongUserId = '00000000-0000-0000-0000-000000000000';
            await axios.post(`${API_URL}/daily-routine/complete`, {
                routineItemId: routineItems[0].id,
                tenantUserId: wrongUserId,
                date: today,
                notes: 'Should fail'
            });
            console.log('❌ Security Check: FAIL (Request should have been rejected)');
        } catch (error) {
            const status = error.response ? error.response.status : 'Unknown';
            if (status === 403 || status === 404) {
                console.log(`✅ Security Check: PASS (Returned ${status})`);
            } else {
                console.log(`❌ Security Check: FAIL (Returned ${status}, expected 403 or 404)`);
            }
        }

    } catch (error) {
        console.error('Test failed with error:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(error);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
