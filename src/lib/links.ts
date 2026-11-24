// 메모 글에서 링크(주소)를 찾는다.

export interface FoundLink {
  /** 실제로 열 주소 (www.로 시작하면 https://를 붙인다) */
  href: string;
  /** 짧게 보여줄 글자: 'naver.com/…' */
  label: string;
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
// 문장 끝에 붙은 문장부호는 주소가 아니다
const TRAILING = /[.,;:!?。、)\]}>'"’”]+$/;

function trimTrailing(raw: string): string {
  let url = raw.replace(TRAILING, '');
  // 'https://a.com/b_(c)' 처럼 괄호가 짝이 맞으면 닫는 괄호는 주소의 일부
  const opens = (raw.match(/\(/g) ?? []).length;
  const closes = (url.match(/\)/g) ?? []).length;
  if (raw.length > url.length && raw[url.length] === ')' && opens > closes) url += ')';
  return url;
}

function shortLabel(href: string): string {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    const rest = (u.pathname + u.search).replace(/\/$/, '');
    if (!rest) return host;
    return rest.length > 24 ? `${host}${rest.slice(0, 24)}…` : `${host}${rest}`;
  } catch {
    return href;
  }
}

export function extractLinks(text: string): FoundLink[] {
  const seen = new Set<string>();
  const out: FoundLink[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const raw = trimTrailing(m[0]);
    const href = raw.toLowerCase().startsWith('www.') ? `https://${raw}` : raw;
    // 주소처럼 보이지만 실제로는 못 여는 것('https://' 만 있는 등)은 버린다
    try {
      if (!new URL(href).hostname.includes('.')) continue;
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ href, label: shortLabel(href) });
  }
  return out;
}
