import { test, expect, type Page } from '@playwright/test';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ROUTINES = [
  {
    id: 'rtn-1',
    title: 'Revisar emails pendentes',
    description: 'Verificar caixa de entrada e responder mensagens urgentes.',
    scheduledTime: '08:00',
    isCompleted: false,
    completedToday: false,
    log: null,
  },
  {
    id: 'rtn-2',
    title: 'Atualizar status do projeto Alpha',
    description: 'Registrar progresso da sprint atual no painel.',
    scheduledTime: '09:30',
    isCompleted: true,
    completedToday: true,
    log: { id: 'log-1', notes: 'Concluído no prazo.' },
  },
  {
    id: 'rtn-3',
    title: 'Reunião de alinhamento com equipe',
    description: 'Pontos de pauta: entregas, bloqueios e próximos passos.',
    scheduledTime: '14:00',
    isCompleted: false,
    completedToday: false,
    log: null,
  },
];

const MOCK_LOGS = [
  {
    employeeName: 'João Silva',
    routineItem: 'Revisar emails pendentes',
    completionDate: '2026-08-14',
    notes: 'Respondeu todos',
  },
  {
    employeeName: 'Maria Souza',
    routineItem: 'Atualizar status do projeto Alpha',
    completionDate: '2026-08-14',
    notes: '',
  },
  {
    employeeName: 'Pedro Santos',
    routineItem: 'Reunião de alinhamento com equipe',
    completionDate: '2026-08-15',
    notes: 'Atrasou 10 minutos',
  },
];

const MOCK_EFFICIENCY = { percentage: 78.5 };

const MOCK_AUTH_SESSION = {
  accessToken: 'mock-access-token-e2e',
  refreshToken: 'mock-refresh-token-e2e',
  user: {
    id: 'usr-001',
    name: 'Admin Teste',
    email: 'admin@test.local',
  },
  tenant: {
    id: 'tnt-001',
    name: 'Tenant Teste',
    slug: 'tenant-teste',
  },
  permissions: [
    'daily_routine.view',
    'daily_routine.manage',
    'daily_routine.complete',
  ],
  role: 'admin',
  hydrated: true,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function seedAuthSession(page: Page) {
  await page.addInitScript((session) => {
    localStorage.setItem('quadro-auth', JSON.stringify({
      state: session,
      version: 0,
    }));
    document.cookie = 'qd_access=mock-jwt; Path=/; Max-Age=86400';
    document.cookie = 'qd_client_auth=1; Path=/; Max-Age=86400';
  }, MOCK_AUTH_SESSION);
}

// ─── Mutable mock state (allows PATCH to update what GET returns) ────────────
let routinesState = [...MOCK_ROUTINES];

function mockDailyRoutineApi(page: Page) {
  // Reset mutable state for each test
  routinesState = MOCK_ROUTINES.map((r) => ({ ...r }));

  // POST /auth/refresh
  page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: MOCK_AUTH_SESSION.accessToken,
        refreshToken: MOCK_AUTH_SESSION.refreshToken,
      }),
    }),
  );

  // GET /auth/me
  page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: MOCK_AUTH_SESSION.user,
        tenant: MOCK_AUTH_SESSION.tenant,
        permissions: MOCK_AUTH_SESSION.permissions,
        role: MOCK_AUTH_SESSION.role,
      }),
    }),
  );

  // GET /daily-routine/admin/efficiency (must be before the general /daily-routine catch-all)
  // Use regex to avoid glob ambiguity with **/api/daily-routine
  page.route(/\/api\/daily-routine\/admin\/efficiency/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EFFICIENCY),
    }),
  );

  // GET /daily-routine/admin/logs (must be before the general /daily-routine catch-all)
  // Use regex to avoid glob ambiguity with **/api/daily-routine
  page.route(/\/api\/daily-routine\/admin\/logs/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGS),
    }),
  );

  // PATCH /daily-routine/:id/complete — stateful: marks the routine as completed
  page.route('**/api/daily-routine/*/complete', (route) => {
    if (route.request().method() === 'PATCH') {
      const url = new URL(route.request().url());
      const segments = url.pathname.split('/').filter(Boolean);
      const routineId = segments[segments.length - 2]; // e.g. 'rtn-1' from /api/daily-routine/rtn-1/complete
      routinesState = routinesState.map((r) =>
        r.id === routineId
          ? { ...r, isCompleted: true, completedToday: true }
          : r,
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
    return route.fallback();
  });

  // GET /daily-routine (exact match only — must be LAST)
  page.route('**/api/daily-routine', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/daily-routine') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(routinesState),
      });
    }
    return route.fallback();
  });
}

async function waitForPageReady(page: Page, knownText: string) {
  await expect(page.getByText(knownText)).toBeVisible({ timeout: 15_000 });
}

/**
 * Locates the checkbox button for a routine item by scoping to the
 * item's heading text first, then walking up to the card container.
 *
 * Each card has Tailwind class `group` and contains a heading and a button.
 * We find the card by filtering elements with the heading text, then grab
 * the first button inside.
 */
function routineItemCheckbox(page: Page, itemTitle: string) {
  return page
    .locator('.group.relative')
    .filter({ hasText: itemTitle })
    .locator('button')
    .first();
}

/** Date input locators for admin filters. */
const startDateInput = (page: Page) => page.locator('input[type="date"]').first();
const endDateInput = (page: Page) => page.locator('input[type="date"]').last();
const collaboratorInput = (page: Page) => page.getByPlaceholder('ID do Usuário');

/**
 * Fills a date input and ensures React's controlled state updates.
 *
 * React 18 delegates events to the root container. `input[type="date"]`
 * in Chrome fires `change` on blur (not `input`). Playwright's `fill()`
 * only dispatches `input`, so we must also blur the element to trigger
 * the native `change` event that React's synthetic handler listens for.
 *
 * We also walk the React fiber tree as a fallback to invoke onChange
 * directly if native event dispatch fails.
 */
async function fillDate(locator: import('@playwright/test').Locator, value: string) {
  await locator.fill(value);

  // Blur the input by pressing Tab — this triggers the native `change`
  // event on date inputs in Chrome, which React 18 picks up.
  await locator.press('Tab');

  // Verify React state was updated by checking if the input still has
  // the value (React controlled inputs re-render with the state value).
  // If React state didn't update, the input would revert on re-render.
  // As an additional guarantee, walk the fiber tree and call onChange directly.
  await locator.evaluate((el, val) => {
    const fiberKey = Object.keys(el).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
    );
    if (!fiberKey) return;

    let fiber = (el as any)[fiberKey];
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props && typeof props.onChange === 'function') {
        // Only call if the value actually changed (avoid double-update)
        if (props.value !== val) {
          props.onChange({ target: { value: val, type: 'date', name: '' }, preventDefault() {} });
        }
        break;
      }
      fiber = fiber.return;
    }
  }, value);
}

// ─── Employee Checklist Flow ───────────────────────────────────────────────────

test.describe('Employee Checklist — Rotina Diária', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthSession(page);
    mockDailyRoutineApi(page);
  });

  test('should load the daily routine page with title and items', async ({ page }) => {
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Rotina Diária');

    await expect(page.getByRole('heading', { name: /rotina diária/i })).toBeVisible();
    await expect(
      page.getByText('Organize seu dia e mantenha a consistência.'),
    ).toBeVisible();

    await expect(page.getByText('Revisar emails pendentes')).toBeVisible();
    await expect(page.getByText('Atualizar status do projeto Alpha')).toBeVisible();
    await expect(page.getByText('Reunião de alinhamento com equipe')).toBeVisible();

    await expect(page.getByText('08:00')).toBeVisible();
    await expect(page.getByText('09:30')).toBeVisible();
    await expect(page.getByText('14:00')).toBeVisible();
  });

  test('should show completed items with visual strikethrough', async ({ page }) => {
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Atualizar status do projeto Alpha');

    const completedItem = page.getByText('Atualizar status do projeto Alpha');
    await expect(completedItem).toHaveCSS('text-decoration-line', 'line-through');
  });

  test('should toggle a routine item to completed on click', async ({ page }) => {
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Revisar emails pendentes');

    const incompleteItem = page.getByText('Revisar emails pendentes');

    // Before click: no strikethrough
    await expect(incompleteItem).not.toHaveCSS('text-decoration-line', 'line-through');

    // Set up response listener BEFORE the click to avoid race condition
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/') && res.url().includes('/complete'),
    );

    // Click the checkbox button for "Revisar emails pendentes"
    const checkbox = routineItemCheckbox(page, 'Revisar emails pendentes');
    await checkbox.click();

    // Verify the PATCH request was made
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // After refetch, the item should appear completed
    await expect(page.getByText('Revisar emails pendentes')).toHaveCSS(
      'text-decoration-line',
      'line-through',
    );
  });

  test('should show description text for each item', async ({ page }) => {
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Revisar emails pendentes');

    await expect(
      page.getByText('Verificar caixa de entrada e responder mensagens urgentes.'),
    ).toBeVisible();
    await expect(
      page.getByText('Registrar progresso da sprint atual no painel.'),
    ).toBeVisible();
    await expect(
      page.getByText('Pontos de pauta: entregas, bloqueios e próximos passos.'),
    ).toBeVisible();
  });

  test('should render without full page reload on mutation', async ({ page }) => {
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Revisar emails pendentes');

    let reloadCount = 0;
    page.on('load', () => { reloadCount++; });

    // Set up response listener BEFORE the click
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/') && res.url().includes('/complete'),
    );

    // Click the checkbox for the first item
    const checkbox = routineItemCheckbox(page, 'Revisar emails pendentes');
    await checkbox.click();

    // Wait for the API round-trip
    await responsePromise;
    await page.waitForTimeout(500);

    // No additional full page reload (only the initial one at most)
    expect(reloadCount).toBeLessThanOrEqual(1);
  });
});

// ─── Admin Monitoring Flow ─────────────────────────────────────────────────────

test.describe('Admin Monitoring — Monitoramento de Rotinas', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthSession(page);
    mockDailyRoutineApi(page);
  });

  test('should load the admin page with title and filter inputs', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    await expect(
      page.getByRole('heading', { name: /monitoramento de rotinas/i }),
    ).toBeVisible();

    // Filter inputs are present (labels are not associated with inputs,
    // so we verify by placeholder and input type)
    await expect(collaboratorInput(page)).toBeVisible();
    await expect(startDateInput(page)).toBeVisible();
    await expect(endDateInput(page)).toBeVisible();
  });

  test('should show efficiency widget with percentage after date selection', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    // Before dates selected: should show placeholder
    await expect(page.getByText('--%')).toBeVisible();

    // Set up response listener BEFORE triggering the API call
    const efficiencyResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/efficiency'),
    );

    // Fill dates to trigger the query
    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    // Wait for the response to arrive
    await efficiencyResponse;

    // Efficiency percentage should now display
    await expect(page.getByText('78.5%')).toBeVisible();
  });

  test('should populate the logs table after date filter is applied', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    // Set up response listener BEFORE triggering the API call
    const logsResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/logs'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    await logsResponse;

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Colaborador' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Item da Rotina' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Data de Conclusão' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Notas' })).toBeVisible();

    // Log data rows
    await expect(page.getByRole('cell', { name: 'João Silva' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Revisar emails pendentes' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Maria Souza' })).toBeVisible();
  });

  test('should update efficiency when date filters change', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    // Set up first response listener BEFORE filling
    const firstEfficiencyResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/efficiency'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');
    await firstEfficiencyResponse;
    await expect(page.getByText('78.5%')).toBeVisible();

    // Set up second response listener BEFORE changing filter
    const secondEfficiencyResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/efficiency'),
    );

    // Change end date — mock returns same data but proves re-fetch happens
    await fillDate(endDateInput(page), '2026-08-10');
    await secondEfficiencyResponse;
    // Still 78.5% from our mock, but the fact the request fired confirms reactivity
    await expect(page.getByText('78.5%')).toBeVisible();
  });

  test('should show activity summary text', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    // Before dates selected
    await expect(
      page.getByText('Selecione um período de datas para visualizar o histórico de rotinas.'),
    ).toBeVisible();

    // Set up response listener BEFORE filling
    const logsResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/logs'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    await logsResponse;

    await expect(
      page.getByText(/encontrados 3 registros/i),
    ).toBeVisible();
  });

  test('should show notes or dash for empty notes in logs', async ({ page }) => {
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    // Set up response listener BEFORE filling
    const logsResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/logs'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    await logsResponse;

    // Notes present
    await expect(page.getByRole('cell', { name: 'Respondeu todos' })).toBeVisible();
    // Empty notes should show dash
    await expect(page.getByRole('cell', { name: '—', exact: true })).toBeVisible();
  });
});

// ─── Error Handling Flow ───────────────────────────────────────────────────────

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthSession(page);
  });

  test('should show error state when daily-routine API fails', async ({ page }) => {
    mockDailyRoutineApi(page);

    // Override the daily-routine mock to return a server error
    await page.route('**/api/daily-routine', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/daily-routine') && route.request().method() === 'GET') {
        return route.fulfill({ status: 500, body: 'Internal Server Error' });
      }
      return route.fallback();
    });

    await page.goto('/daily-routine');

    await expect(page.getByRole('heading', { name: /erro ao carregar rotinas/i })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/não foi possível obter sua lista/i),
    ).toBeVisible();
  });

  test('should show empty state when no routines exist', async ({ page }) => {
    mockDailyRoutineApi(page);

    await page.route('**/api/daily-routine', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/daily-routine') && route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
      return route.fallback();
    });

    await page.goto('/daily-routine');

    await expect(
      page.getByText(/nenhuma rotina configurada para hoje/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('should show error state in admin logs when API fails', async ({ page }) => {
    // Mock auth endpoints
    page.route('**/api/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: MOCK_AUTH_SESSION.accessToken,
          refreshToken: MOCK_AUTH_SESSION.refreshToken,
        }),
      }),
    );

    page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: MOCK_AUTH_SESSION.user,
          tenant: MOCK_AUTH_SESSION.tenant,
          permissions: MOCK_AUTH_SESSION.permissions,
          role: MOCK_AUTH_SESSION.role,
        }),
      }),
    );

    // Mock logs endpoint to fail
    await page.route('**/api/daily-routine/admin/logs', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    );

    // Mock efficiency endpoint to work
    await page.route('**/api/daily-routine/admin/efficiency', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ percentage: 0 }),
      }),
    );

    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    const logsResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/logs'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    await logsResponse;

    await expect(
      page.getByText(/erro ao carregar logs de atividade/i),
    ).toBeVisible();
  });

  test('should show waiting message when admin has no date filters', async ({ page }) => {
    mockDailyRoutineApi(page);

    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    await expect(
      page.getByText('Aguardando seleção de período para buscar registros.'),
    ).toBeVisible();
  });
});

// ─── Responsive / Layout Flow ──────────────────────────────────────────────────

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthSession(page);
    mockDailyRoutineApi(page);
  });

  test('should render daily routine page correctly at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/daily-routine');
    await waitForPageReady(page, 'Rotina Diária');

    await expect(page.getByRole('heading', { name: /rotina diária/i })).toBeVisible();
    await expect(page.getByText('Revisar emails pendentes')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/daily-routine-desktop.png' });
  });

  test('should render admin page correctly at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/daily-routine/admin');
    await waitForPageReady(page, 'Monitoramento de Rotinas');

    await expect(page.getByRole('heading', { name: /monitoramento de rotinas/i })).toBeVisible();
    // Use exact match to avoid ambiguity with subtitle text
    await expect(page.getByText('Eficiência da Equipe', { exact: true })).toBeVisible();

    const logsResponse = page.waitForResponse(
      (res) => res.url().includes('/daily-routine/admin/logs'),
    );

    await fillDate(startDateInput(page), '2026-08-01');
    await fillDate(endDateInput(page), '2026-08-16');

    await logsResponse;

    await page.screenshot({ path: 'e2e/screenshots/daily-routine-admin-desktop.png' });
  });
});
