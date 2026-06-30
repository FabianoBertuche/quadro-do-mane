import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

/**
 * Helper para configurar cookies HttpOnly de forma centralizada.
 *
 * Em localhost dev, NÃO setamos o atributo `Domain` — a RFC 6265 rejeita
 * `Domain=localhost` por falta de ponto, e o Chrome/Edge descartam o cookie
 * silenciosamente. Sem `Domain`, o navegador vincula o cookie à origem exata
 * que o emitiu (ex.: `http://localhost:3001`), o que já é o suficiente para
 * o frontend (porta 3000) receber de volta quando a chamada passa pelo
 * proxy Next.js `/api/*` (mesma origem do browser).
 *
 * Em produção, setar `COOKIE_SECURE=true` E `COOKIE_DOMAIN=seudominio.com`
 * para que o cookie seja compartilhado entre subdomínios (api.app.com e
 * app.app.com). Sem Secure, o cookie será rejeitado em produção.
 */
@Injectable()
export class CookieService {
  private static readonly ACCESS_TOKEN = 'qd_access';
  private static readonly REFRESH_TOKEN = 'qd_refresh';
  private static readonly PRE_AUTH_TOKEN = 'qd_preauth';

  constructor(private readonly config: ConfigService) {}

  private get isSecure(): boolean {
    return this.config.get<boolean>('COOKIE_SECURE', false);
  }

  /**
   * Domain strategy:
   * - localhost/127.0.0.1 (dev): retorna `undefined` (não seta Domain).
   * - produção (COOKIE_DOMAIN=seudominio.com): usa o domínio configurado.
   * - sem COOKIE_DOMAIN: retorna `undefined` (cookie vinculado à própria origin).
   */
  private get domain(): string | undefined {
    const d = this.config.get<string>('COOKIE_DOMAIN');
    if (!d) return undefined;
    if (d === 'localhost' || d === '127.0.0.1') return undefined;
    return d;
  }

  /**
   * Constrói as opções base de cookie, omitindo `Domain` quando não houver
   * um domínio de produção válido. Express ignora atributos `undefined`,
   * então o cookie sai limpo em DEV.
   */
  private baseOpts(): Record<string, unknown> {
    const opts: Record<string, unknown> = {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'lax',
      path: '/',
    };
    const d = this.domain;
    if (d) opts.domain = d;
    return opts;
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const opts = this.baseOpts();

    res.cookie(CookieService.ACCESS_TOKEN, accessToken, {
      ...opts,
      maxAge: this.parseTtlMs(this.config.get<string>('JWT_EXPIRES_IN', '15m')),
    });

    res.cookie(CookieService.REFRESH_TOKEN, refreshToken, {
      ...opts,
      maxAge: this.parseTtlMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')),
    });
  }

  setPreAuthCookie(res: Response, preAuthToken: string) {
    const opts = this.baseOpts();
    res.cookie(CookieService.PRE_AUTH_TOKEN, preAuthToken, {
      ...opts,
      maxAge: 5 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    const clearOpts = this.baseOpts();
    res.clearCookie(CookieService.ACCESS_TOKEN, clearOpts);
    res.clearCookie(CookieService.REFRESH_TOKEN, clearOpts);
    res.clearCookie(CookieService.PRE_AUTH_TOKEN, clearOpts);
  }

  private parseTtlMs(ttl: string): number {
    const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!m) return 15 * 60 * 1000;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's': return n * 1000;
      case 'm': return n * 60 * 1000;
      case 'h': return n * 3600 * 1000;
      case 'd': return n * 86400 * 1000;
      default: return n * 1000;
    }
  }
}