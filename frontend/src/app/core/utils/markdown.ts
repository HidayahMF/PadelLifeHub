/**
 * Minimal, safe Markdown → HTML renderer for AI replies.
 *
 * Safety model: the input is HTML-escaped BEFORE any conversion, so raw HTML
 * from the model can never reach the DOM. Only a small allow-list of tags is
 * produced (h1-h3, p, ul/ol/li, strong, em, code, br). Consumers should still
 * run the result through Angular's DomSanitizer before binding to innerHTML.
 */
export function renderMarkdown(src: string): string {
  const esc = String(src ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  // Inline formatting (code first so backticks in other markup stay intact).
  const inline = esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  const out: string[] = [];
  let list: string[] | null = null;

  const flushList = () => {
    if (list) {
      out.push(`<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>`);
      list = null;
    }
  };

  for (const rawLine of inline.split('\n')) {
    const line = rawLine.trim();

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      list ??= [];
      list.push(ul[1]);
      continue;
    }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushList();
      out.push(`<ol><li>${ol[1]}</li></ol>`);
      continue;
    }

    flushList();

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${heading[2]}</h${level}>`);
      continue;
    }

    if (!line) continue;
    out.push(`<p>${line.replace(/\s+/g, ' ')}</p>`);
  }

  flushList();
  return out.join('');
}
