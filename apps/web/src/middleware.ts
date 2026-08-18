import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — NUCLEAR MODE.
 *
 * NUNCA redireciona para /login. Todas as requisições passam livremente.
 * A autenticação é tratada 100% no client-side pelo useSession hook.
 */

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

  // Nuclear mode: NEVER redirect to /login. Let all pages render.
  // Auth is handled client-side by useSession hook.
  return NextResponse.next();
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