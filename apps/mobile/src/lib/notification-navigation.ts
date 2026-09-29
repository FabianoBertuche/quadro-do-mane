export function resolveNotificationRoute(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {
    taskId?: string;
    projectId?: string;
    route?: string;
    payloadJson?: string;
  };

  // Priority 1: payloadJson (string JSON) parseado
  if (p.payloadJson) {
    try {
      const parsed = JSON.parse(p.payloadJson as string);
      if (parsed.taskId) return `/task/${parsed.taskId}`;
      if (parsed.projectId) return `/project/${parsed.projectId}`;
      if (parsed.route && /^\/calendar$/.test(parsed.route)) return `/calendar`;
    } catch {}
  }

  // Priority 2: campos diretos — apenas rotas permitidas
  if (p.taskId) return `/task/${p.taskId}`;
  if (p.projectId) return `/project/${p.projectId}`;
  if (p.route && (/^\/task\//.test(p.route) || /^\/project\//.test(p.route) || /^\/calendar$/.test(p.route)))
    return p.route;

  return null;
}