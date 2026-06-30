import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML de e-mail antes de renderizar com dangerouslySetInnerHTML.
 *
 * Estratégia:
 *  - Remove tags <script>, <style>, <iframe>, <object>, <embed>, <form>.
 *  - Bloqueia atributos on* (onclick, onerror, etc.).
 *  - Bloqueia javascript: em href/src.
 *  - Permite imagens http/https (decisão de bloquear imagens fica no caller).
 */
const PURIFIER_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
    'dd', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2',
    'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark',
    'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'class', 'colspan', 'rowspan',
    'align', 'target', 'rel', 'width', 'height',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit'],
  ALLOW_DATA_ATTR: false,
} as const;

/**
 * Sanitiza HTML para renderização segura. Retorna string vazia se entrada
 * for nula ou vazia.
 */
export function sanitizeEmailHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  // DOMPurify espera um objeto Config; o `as any` evita friction com o tipo Config.
  return (DOMPurify as any).sanitize(raw, PURIFIER_CONFIG);
}