import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

async function main() {
  console.log('🌱 Starting seed...');

  // ==========================================
  // PLANS
  // ==========================================
  const plans = [
    {
      name: 'Trial',
      description: 'Plano de avaliação',
      maxUsers: 10,
      maxProjects: 10,
      maxStorageMb: 1024,
      monthlyPrice: 0,
      annualPrice: 0,
    },
    {
      name: 'Starter',
      description: 'Plano inicial para pequenas equipes',
      maxUsers: 25,
      maxProjects: 50,
      maxStorageMb: 5120,
      monthlyPrice: 99.9,
      annualPrice: 999.0,
    },
    {
      name: 'Pro',
      description: 'Plano profissional para equipes em crescimento',
      maxUsers: 100,
      maxProjects: 500,
      maxStorageMb: 20480,
      monthlyPrice: 299.9,
      annualPrice: 2999.0,
    },
    {
      name: 'Enterprise',
      description: 'Plano corporativo',
      maxUsers: null,
      maxProjects: null,
      maxStorageMb: null,
      monthlyPrice: 999.9,
      annualPrice: 9999.0,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.name.toLowerCase() },
      update: plan,
      create: { id: plan.name.toLowerCase(), ...plan },
    });
  }
  console.log('✅ Plans seeded');

  // ==========================================
  // TENANT
  // ==========================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'quadro-do-mane-demo' },
    update: {},
    create: {
      name: 'Quadro do Mané Demo',
      slug: 'quadro-do-mane-demo',
      legalName: 'Quadro do Mané Demo LTDA',
      documentNumber: '00.000.000/0001-00',
      email: 'admin@quadrodomane.local',
      phone: '+55 19 99999-9999',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Tenant seeded');

  // ==========================================
  // SUBSCRIPTION
  // ==========================================
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!existingSub) {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 30);
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: 'trial',
        status: 'TRIAL',
        startedAt: new Date(),
        trialEndsAt: trialEnds,
      },
    });
  }
  console.log('✅ Subscription seeded');

  // ==========================================
  // PERMISSIONS
  // ==========================================
  const permissionsList = [
    { code: 'auth.login', name: 'Login', module: 'auth' },
    { code: 'auth.logout', name: 'Logout', module: 'auth' },
    { code: 'auth.refresh', name: 'Refresh Token', module: 'auth' },
    { code: 'dashboard.view', name: 'Ver Dashboard', module: 'dashboard' },
    { code: 'users.view', name: 'Ver Usuários', module: 'users' },
    { code: 'users.create', name: 'Criar Usuários', module: 'users' },
    { code: 'users.edit', name: 'Editar Usuários', module: 'users' },
    { code: 'users.disable', name: 'Desabilitar Usuários', module: 'users' },
    { code: 'roles.view', name: 'Ver Papéis', module: 'roles' },
    { code: 'roles.create', name: 'Criar Papéis', module: 'roles' },
    { code: 'roles.edit', name: 'Editar Papéis', module: 'roles' },
    { code: 'roles.assign', name: 'Atribuir Papéis', module: 'roles' },
    { code: 'teams.view', name: 'Ver Equipes', module: 'teams' },
    { code: 'teams.create', name: 'Criar Equipes', module: 'teams' },
    { code: 'teams.edit', name: 'Editar Equipes', module: 'teams' },
    { code: 'teams.delete', name: 'Excluir Equipes', module: 'teams' },
    { code: 'teams.manage_members', name: 'Gerenciar Membros', module: 'teams' },
    { code: 'projects.view', name: 'Ver Projetos', module: 'projects' },
    { code: 'projects.create', name: 'Criar Projetos', module: 'projects' },
    { code: 'projects.edit', name: 'Editar Projetos', module: 'projects' },
    { code: 'projects.archive', name: 'Arquivar Projetos', module: 'projects' },
    { code: 'projects.delete', name: 'Excluir Projetos', module: 'projects' },
    { code: 'projects.manage_members', name: 'Gerenciar Membros do Projeto', module: 'projects' },
    { code: 'projects.manage_views', name: 'Gerenciar Visualizações', module: 'projects' },
    { code: 'tasks.view', name: 'Ver Tarefas', module: 'tasks' },
    { code: 'tasks.create', name: 'Criar Tarefas', module: 'tasks' },
    { code: 'tasks.edit', name: 'Editar Tarefas', module: 'tasks' },
    { code: 'tasks.delete', name: 'Excluir Tarefas', module: 'tasks' },
    { code: 'tasks.move', name: 'Mover Tarefas', module: 'tasks' },
    { code: 'tasks.assign', name: 'Atribuir Tarefas', module: 'tasks' },
    { code: 'tasks.comment', name: 'Comentar Tarefas', module: 'tasks' },
    { code: 'tasks.checklist_manage', name: 'Gerenciar Checklists', module: 'tasks' },
    { code: 'tasks.attachments_manage', name: 'Gerenciar Anexos', module: 'tasks' },
    { code: 'tasks.change_status', name: 'Alterar Status', module: 'tasks' },
    { code: 'tasks.change_priority', name: 'Alterar Prioridade', module: 'tasks' },
    { code: 'calendar.view', name: 'Ver Calendário', module: 'calendar' },
    { code: 'calendar.create', name: 'Criar Eventos', module: 'calendar' },
    { code: 'calendar.edit', name: 'Editar Eventos', module: 'calendar' },
    { code: 'calendar.delete', name: 'Excluir Eventos', module: 'calendar' },
    { code: 'contacts.view', name: 'Ver Contatos', module: 'contacts' },
    { code: 'contacts.create', name: 'Criar Contatos', module: 'contacts' },
    { code: 'contacts.edit', name: 'Editar Contatos', module: 'contacts' },
    { code: 'contacts.delete', name: 'Excluir Contatos', module: 'contacts' },
    { code: 'reports.view', name: 'Ver Relatórios', module: 'reports' },
    { code: 'reports.export', name: 'Exportar Relatórios', module: 'reports' },
    { code: 'notifications.view', name: 'Ver Notificações', module: 'notifications' },
    { code: 'notifications.manage', name: 'Gerenciar Notificações', module: 'notifications' },
    { code: 'automations.view', name: 'Ver Automações', module: 'automations' },
    { code: 'automations.create', name: 'Criar Automações', module: 'automations' },
    { code: 'automations.edit', name: 'Editar Automações', module: 'automations' },
    { code: 'automations.delete', name: 'Excluir Automações', module: 'automations' },
    { code: 'billing.view', name: 'Ver Faturamento', module: 'billing' },
    { code: 'billing.manage', name: 'Gerenciar Faturamento', module: 'billing' },
    { code: 'settings.view', name: 'Ver Configurações', module: 'settings' },
    { code: 'settings.edit', name: 'Editar Configurações', module: 'settings' },
    { code: 'audit.view', name: 'Ver Auditoria', module: 'audit' },
    { code: 'email.view', name: 'Usar E-mail', module: 'email' },
    { code: 'email.admin', name: 'Configurar Servidor de E-mail', module: 'email' },
  ];

  for (const perm of permissionsList) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }
  console.log('✅ Permissions seeded');

  // ==========================================
  // ROLES
  // ==========================================
  const rolesData = [
    { id: 'admin', name: 'admin', description: 'Controle total do tenant.', isSystemRole: true },
    { id: 'gestor', name: 'gestor', description: 'Gerencia projetos, equipes e tarefas.', isSystemRole: true },
    { id: 'colaborador', name: 'colaborador', description: 'Executa tarefas, comenta, atualiza status.', isSystemRole: true },
    { id: 'convidado', name: 'convidado', description: 'Acesso restrito de leitura.', isSystemRole: true },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log('✅ Roles seeded');

  // ==========================================
  // ROLE -> PERMISSION MAPPING
  // ==========================================
  const allPermissions = await prisma.permission.findMany();
  const allPermissionIds = allPermissions.map((p) => p.id);

  const gestorPermCodes = [
    'dashboard.view', 'users.view',
    'teams.view', 'teams.create', 'teams.edit', 'teams.manage_members',
    'projects.view', 'projects.create', 'projects.edit', 'projects.archive',
    'projects.manage_members', 'projects.manage_views',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.move', 'tasks.assign',
    'tasks.comment', 'tasks.checklist_manage', 'tasks.attachments_manage',
    'tasks.change_status', 'tasks.change_priority',
    'calendar.view', 'calendar.create', 'calendar.edit',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'reports.view', 'reports.export', 'notifications.view',
  ];

  const colaboradorPermCodes = [
    'dashboard.view', 'projects.view',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.move',
    'tasks.comment', 'tasks.checklist_manage', 'tasks.attachments_manage',
    'tasks.change_status',
    'calendar.view', 'contacts.view', 'notifications.view',
  ];

  const convidadoPermCodes = [
    'dashboard.view', 'projects.view', 'tasks.view', 'calendar.view', 'contacts.view',
  ];

  // Clear existing role_permissions
  await prisma.rolePermission.deleteMany({});

  // Admin gets all
  for (const permId of allPermissionIds) {
    await prisma.rolePermission.create({
      data: { roleId: 'admin', permissionId: permId },
    });
  }

  // Gestor
  for (const code of gestorPermCodes) {
    const perm = allPermissions.find((p) => p.code === code);
    if (perm) {
      await prisma.rolePermission.create({
        data: { roleId: 'gestor', permissionId: perm.id },
      });
    }
  }

  // Colaborador
  for (const code of colaboradorPermCodes) {
    const perm = allPermissions.find((p) => p.code === code);
    if (perm) {
      await prisma.rolePermission.create({
        data: { roleId: 'colaborador', permissionId: perm.id },
      });
    }
  }

  // Convidado
  for (const code of convidadoPermCodes) {
    const perm = allPermissions.find((p) => p.code === code);
    if (perm) {
      await prisma.rolePermission.create({
        data: { roleId: 'convidado', permissionId: perm.id },
      });
    }
  }
  console.log('✅ Role-Permission mapping seeded');

  // ==========================================
  // ADMIN USER
  // ==========================================
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@quadrodomane.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AlterarNoPrimeiroLogin123!';
  const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash: hashedPassword,
      isActive: true,
    },
  });

  const existingTenantUser = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: adminUser.id } },
  });
  if (!existingTenantUser) {
    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        roleId: 'admin',
        jobTitle: 'Administrador do Sistema',
        department: 'TI',
        isActive: true,
      },
    });
  }
  console.log('✅ Admin user seeded');

  // ==========================================
  // TASK STATUSES
  // ==========================================
  const statuses = [
    { name: 'Backlog', slug: 'backlog', color: '#64748B', position: 1, category: 'pending', isDefault: false },
    { name: 'A Fazer', slug: 'a_fazer', color: '#3B82F6', position: 2, category: 'pending', isDefault: true },
    { name: 'Em Execução', slug: 'em_execucao', color: '#F59E0B', position: 3, category: 'active', isDefault: false },
    { name: 'Revisão', slug: 'revisao', color: '#8B5CF6', position: 4, category: 'active', isDefault: false },
    { name: 'Concluído', slug: 'concluido', color: '#22C55E', position: 5, category: 'done', isDefault: false },
  ];

  for (const status of statuses) {
    await prisma.taskStatus.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: status.slug } },
      update: status,
      create: { tenantId: tenant.id, ...status },
    });
  }
  console.log('✅ Task statuses seeded');

  // ==========================================
  // TASK PRIORITIES
  // ==========================================
  const priorities = [
    { name: 'Baixa', level: 1, color: '#94A3B8' },
    { name: 'Normal', level: 2, color: '#3B82F6' },
    { name: 'Alta', level: 3, color: '#F59E0B' },
    { name: 'Urgente', level: 4, color: '#EF4444' },
  ];

  const existingPriorities = await prisma.taskPriority.findMany({
    where: { tenantId: tenant.id },
  });
  if (existingPriorities.length === 0) {
    for (const priority of priorities) {
      await prisma.taskPriority.create({
        data: { tenantId: tenant.id, ...priority },
      });
    }
  }
  console.log('✅ Task priorities seeded');

  // ==========================================
  // DEMO DATA
  // ==========================================
  const adminTenantUser = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: adminUser.id } },
  });

  if (adminTenantUser) {
    // Demo team
    const existingTeam = await prisma.team.findFirst({
      where: { tenantId: tenant.id, name: 'Operações' },
    });
    if (!existingTeam) {
      await prisma.team.create({
        data: {
          tenantId: tenant.id,
          name: 'Operações',
          description: 'Equipe de operações',
          color: '#5B5FEF',
          managerTenantUserId: adminTenantUser.id,
        },
      });
    }

    // Demo project
    const existingProject = await prisma.project.findFirst({
      where: { tenantId: tenant.id, code: 'IMPL-001' },
    });
    if (!existingProject) {
      const defaultStatus = await prisma.taskStatus.findFirst({
        where: { tenantId: tenant.id, isDefault: true },
      });
      const normalPriority = await prisma.taskPriority.findFirst({
        where: { tenantId: tenant.id, name: 'Normal' },
      });

      const project = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          name: 'Implantação Inicial',
          code: 'IMPL-001',
          description: 'Projeto de implantação inicial do sistema',
          status: 'ACTIVE',
          priority: 'HIGH',
          ownerTenantUserId: adminTenantUser.id,
          progressPercent: 0,
        },
      });

      // Demo tasks
      const taskTitles = [
        'Configurar VPS',
        'Criar identidade visual',
        'Definir fluxo de kanban',
        'Homologar autenticação',
        'Publicar versão alfa',
      ];

      for (let i = 0; i < taskTitles.length; i++) {
        await prisma.task.create({
          data: {
            tenantId: tenant.id,
            projectId: project.id,
            title: taskTitles[i],
            statusId: defaultStatus?.id,
            priorityId: normalPriority?.id,
            assigneeTenantUserId: adminTenantUser.id,
            reporterTenantUserId: adminTenantUser.id,
            kanbanPosition: i * 1000,
            sortOrder: i,
          },
        });
      }
    }
  }
  console.log('✅ Demo data seeded');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
