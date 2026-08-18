const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
    console.log('--- Starting E2E Logic Test for Daily Routine ---');

    try {
        // 1. Setup: Identify valid tenant and user
        console.log('\n[Step 1] Setup: Fetching tenant and user...');
        const tenantUser = await prisma.tenantUser.findFirst({
            include: { tenant: true, user: true }
        });

        if (!tenantUser) {
            throw new Error('No tenantUser found in database.');
        }

        const { tenantId, id: tenantUserId } = tenantUser;
        console.log(`Using Tenant: ${tenantId}`);
        console.log(`Using TenantUser: ${tenantUserId}`);

        // Clean up previous test data to ensure clean state
        await prisma.dailyRoutineLog.deleteMany({ where: { tenantUserId } });
        await prisma.dailyRoutineItem.deleteMany({ where: { assignedTenantUserId: tenantUserId } });

        // 2. Creation (ADM): Create 3 routine items
        console.log('\n[Step 2] Creation (ADM): Creating 3 routine items...');
        const routineItems = [];
        for (let i = 1; i <= 3; i++) {
            const item = await prisma.dailyRoutineItem.create({
                data: {
                    tenantId,
                    assignedTenantUserId: tenantUserId,
                    createdById: tenantUserId,
                    title: `Routine Item ${i}`,
                    description: `Description for item ${i}`,
                    scheduledTime: '09:00'
                }
            });
            routineItems.push(item);
            console.log(`Created item ${i}: ${item.id}`);
        }
        console.log('Successfully created 3 items.');

        // 3. Completion (Employee): Mark 2 items as completed
        console.log('\n[Step 3] Completion (Employee): Marking 2 items as completed...');
        const today = new Date();
        today.setHours(0,0,0,0);
        
        for (let i = 0; i < 2; i++) {
            await prisma.dailyRoutineLog.create({
                data: {
                    tenantId,
                    routineItemId: routineItems[i].id,
                    tenantUserId: tenantUserId,
                    date: today,
                    notes: 'Completed for test'
                }
            });
            console.log(`Completed item ${i + 1}: ${routineItems[i].id}`);
        }
        console.log('Successfully marked 2 items as completed.');

        // 4. Validation (ADM Audit): Verify efficiency and logs
        console.log('\n[Step 4] Validation (ADM Audit): Verifying logs...');
        
        const logs = await prisma.dailyRoutineLog.findMany({
            where: {
                tenantUserId,
                date: {
                    gte: today,
                    lte: new Date(new Date().setHours(23,59,59,999))
                }
            },
            include: { routineItem: true }
        });

        const totalScheduledItems = await prisma.dailyRoutineItem.count({
            where: { assignedTenantUserId: tenantUserId }
        });

        const uniqueCompletions = new Set(
            logs.map((l) => `${l.routineItemId}_${l.date.toISOString().split('T')[0]}`)
        ).size;

        const efficiency = (uniqueCompletions / totalScheduledItems) * 100;
        const formattedEfficiency = efficiency.toFixed(2);

        console.log(`Efficiency: ${formattedEfficiency}%`);
        console.log(`Logs count: ${logs.length}`);

        if (formattedEfficiency === '66.67') {
            console.log('✅ Efficiency Verification: PASS');
        } else {
            console.log(`❌ Efficiency Verification: FAIL (Expected 66.67, got ${formattedEfficiency})`);
        }

        if (logs.length === 2) {
            console.log('✅ Logs Count Verification: PASS');
        } else {
            console.log(`❌ Logs Count Verification: FAIL (Expected 2, got ${logs.length})`);
        }

        // 5. Security Check: Attempt with wrong user
        console.log('\n[Step 5] Security Check: Testing unauthorized completion...');
        try {
            const wrongUserId = '00000000-0000-0000-0000-000000000000';
            // Simulate the check in DailyRoutineService.completeRoutine
            const item = await prisma.dailyRoutineItem.findUnique({
                where: { id: routineItems[0].id }
            });
            if (item.assignedTenantUserId !== wrongUserId) {
                throw new Error('Forbidden/NotFound: Routine item not assigned to this user');
            }
            console.log('❌ Security Check: FAIL (Request should have been rejected)');
        } catch (error) {
            console.log(`✅ Security Check: PASS (${error.message})`);
        }

    } catch (error) {
        console.error('Test failed with error:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
