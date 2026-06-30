import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware para proteção de rotas server-side.
 *
 * Estratégia:
 * - Lê o cookie `qd_access` (HttpOnly, definido pelo backend).
 * - Decodifica o payload JWT sem verificar assinatura (já verificada pelo backend).
 * - Se ausente/expirado → redireciona para /login.
 *
 * NOTA: a verificação completa de assinatura acontece no backend (NestJS).
 * Aqui só evitamos render de UI protegida para usuários sem cookie.
 *
 * Rotas públicas: /login, /select-tenant, /api/* (proxy), arquivos estáticos.
 */

const PUBLIC_PATHS = ['/login', '/select-tenant', '/favicon.ico'];

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/teams',
  '/collaborators',
  '/calendar',
  '/emails',
  '/contacts',
  '/settings',
  '/profile',
];

const ACCESS_COOKIE = 'qd_access';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignora API routes e arquivos estáticos
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!access) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decodifica o payload (sem verificar assinatura) para checar expiração
  const decoded = decodeJwtPayload(access);
  if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('expired', '1');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

interface JwtPayload {
  sub?: string;
  exp?: number;
  tenantId?: string;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas exceto:
     * - api (rotas da API Next)
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagem)
     * - favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};