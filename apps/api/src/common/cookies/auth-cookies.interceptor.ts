import { Response } from 'express';

/**
 * Helper puro: recebe um body e response, seta cookies se houver tokens,
 * e devolve o body sem remover os tokens.
 *
 * Importante: em DEV (cookies cross-port são bloqueados por alguns browsers
 * em determinados cenários), o frontend precisa receber os tokens no body
 * para conseguir autenticar as próximas requisições. Por isso NÃO removemos
 * `accessToken`/`refreshToken` do body — apenas garantimos que os cookies
 * também sejam setados (defense in depth).
 *
 * Os tokens no body são inofensivos em produção porque:
 *  - O cookie HttpOnly já garante a autenticação primária.
 *  - O frontend sabe ignorar tokens do body quando há cookie (ver `useSession`).
 *
 * Em produção HTTPS, recomenda-se que o cliente NÃO dependa do body e use
 * apenas os cookies (mitigação XSS). Mas manter o body garante paridade DEV/PROD.
 */
export function applyAuthCookies(
  res: Response,
  body: any,
  cookieHelper: {
    setAuthCookies: (res: Response, access: string, refresh: string) => void;
    setPreAuthCookie: (res: Response, token: string) => void;
    clearAuthCookies: (res: Response) => void;
  },
): any {
  if (!body || typeof body !== 'object') return body;

  // Se o body tem accessToken + refreshToken, seta cookies (mas mantém no body)
  if (body.accessToken && body.refreshToken) {
    try {
      cookieHelper.setAuthCookies(res, body.accessToken, body.refreshToken);
    } catch {
      // não derruba a resposta se o cookie falhar (ex.: header já enviado)
    }
    return body; // mantém tokens no body para compat DEV
  }

  // Se tem preAuthToken (multi-tenant), seta preauth cookie (mas mantém no body)
  if (body.preAuthToken) {
    try {
      cookieHelper.setPreAuthCookie(res, body.preAuthToken);
    } catch {
      // ignore
    }
    return body;
  }

  return body;
}