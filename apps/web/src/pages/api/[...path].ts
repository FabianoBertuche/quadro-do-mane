/**
 * Catch-all API route do Next.js que faz proxy para o backend NestJS.
 *
 * Resolve o problema do `rewrites` do Next.js que NÃO preserva headers
 * Set-Cookie do backend para o browser. Esta rota repassa TUDO:
 * headers, body, query params, e especialmente Set-Cookie.
 *
 * ATENÇÃO: o backend NestJS fica em http://localhost:3001 em dev.
 * Em produção, ajustar API_BACKEND_URL para o domínio público do backend.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import http from 'node:http';

const API_BACKEND_URL = process.env.API_BACKEND_URL || 'http://localhost:3001';

function buildTargetUrl(req: NextApiRequest): string {
  return `${API_BACKEND_URL}${req.url}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const targetUrl = buildTargetUrl(req);

  // Repassa headers do cliente, removendo os hop-by-hop
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'accept-encoding'
    )
      continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  const opts: http.RequestOptions = {
    method: req.method,
    headers,
  };

  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const proxyReq = http.request(targetUrl, opts, (proxyRes) => {
      // Repassa status
      res.status(proxyRes.statusCode || 502);

      // Repassa TODOS os headers (incluindo Set-Cookie)
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value === undefined) return;
        const lower = key.toLowerCase();
        // Remove headers hop-by-hop que atrapalham o proxy
        if (
          lower === 'transfer-encoding' ||
          lower === 'connection' ||
          lower === 'content-encoding' ||
          lower === 'content-length'
        )
          return;
        // Se for set-cookie e vier como array (parse de múltiplos Set-Cookie),
        // usar appendHeader para cada item, senão setHeader normal
        if (lower === 'set-cookie') {
          const arr = Array.isArray(value) ? value : [String(value)];
          arr.forEach((c) => res.appendHeader('Set-Cookie', c));
        } else {
          res.setHeader(key, value as any);
        }
      });

      const responseChunks: Buffer[] = [];
      proxyRes.on('data', (c: Buffer) => responseChunks.push(c));
      proxyRes.on('end', () => {
        res.end(Buffer.concat(responseChunks));
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`[api-proxy] error proxying ${req.method} ${req.url}:`, err);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Backend indisponível', error: err.message });
      } else {
        res.end();
      }
    });

    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });

  req.on('error', (err) => {
    console.error(`[api-proxy] request error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erro no proxy', error: err.message });
    }
  });
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};