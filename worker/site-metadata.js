const SITE_NAMES = { ko: '꽁보다 모터스포츠', en: 'Kongboda Motorsports' };

const PAGES = {
  '/': {
    ko: ['라이브타이밍과 공식 기록 해설', 'F1·WEC 라이브타이밍과 모터스포츠 공식 기록을 AI와 함께 읽어보세요. 연결 방법, 분석 예시와 대회별 지원 범위를 안내합니다.'],
    en: ['Race timing and official records, explained', 'Explore F1 and WEC timing and official motorsport records with AI. Find setup instructions, analysis examples and supported championships.'],
  },
  '/about': {
    ko: ['꽁보다 소개', '레이스 기록을 이해하는 수고를 덜어주는 꽁보다 모터스포츠를 소개합니다. 공식 주최 기관과 구분되는 독립 분석 서비스입니다.'],
    en: ['About Kongboda', 'Meet Kongboda, an independent service that helps explain race records and makes motorsport easier to understand.'],
  },
  '/guide': {
    ko: ['이용 방법', '꽁보다를 AI에 연결하고 첫 질문을 시작하세요. MCP 연결 순서, 분석 카드 읽는 법과 연결 오류 해결 방법을 안내합니다.'],
    en: ['How to use', 'Connect Kongboda to your AI and ask your first question. Follow setup steps, learn to read analysis cards and troubleshoot connection problems.'],
  },
  '/resources': {
    ko: ['유용한 사이트', 'FIA 문서와 공식 타이밍 기록, 모터스포츠 전문 매체와 공학 자료를 찾아보세요. 공식 기록과 보도를 구분해 안내합니다.'],
    en: ['Useful websites', 'Find official FIA documents, timing records, motorsport reporting and engineering resources, with official records distinguished from reporting.'],
  },
  '/account': {
    ko: ['계정', '꽁보다 계정에 로그인하고 연결 정보를 확인하세요.'],
    en: ['Account', 'Sign in to your Kongboda account and review your connections.'],
    private: true,
  },
};

const SERIES = {
  f1: ['Formula 1', 'live'],
  wec: ['FIA WEC', 'live'],
  imsa: ['IMSA', 'post'],
  'formula-e': ['Formula E', 'post'],
  nls: ['NLS', 'post'],
  lemanscup: ['Michelin Le Mans Cup', 'post'],
  elms: ['European Le Mans Series', 'post'],
  alms: ['Asian Le Mans Series', 'post'],
  'gtwc-europe': ['GT World Challenge Europe', 'reference'],
  'gtwc-asia': ['GT World Challenge Asia', 'reference'],
  'gtwc-america': ['GT World Challenge America', 'reference'],
  'gtwc-australia': ['GT World Challenge Australia', 'reference'],
};

export const publicSitePaths = Object.freeze([
  '/', '/about', '/guide', '/resources',
  ...Object.keys(SERIES).map(slug => `/championships/${slug}`),
]);

function escapeMarkup(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function siteOrigin(origin) {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError('Site origin must use HTTP or HTTPS.');
  return url.origin;
}

function normalizePath(pathname = '/') {
  const path = new URL(pathname, 'https://site.invalid').pathname;
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

export function metadataForPath(pathname, language = 'ko') {
  const path = normalizePath(pathname);
  const lang = language === 'en' ? 'en' : 'ko';
  const page = PAGES[path];
  if (page) {
    const [title, description] = page[lang];
    return { title: `${title} · ${SITE_NAMES[lang]}`, description, indexable: !page.private, path, language: lang };
  }
  const series = SERIES[path.replace(/^\/championships\//, '')];
  if (path.startsWith('/championships/') && series) {
    const [name, mode] = series;
    const description = lang === 'en'
      ? mode === 'live'
        ? `${name} calendar, official records and analysis. Live analysis is available only when the session and current collection are verified.`
        : mode === 'post'
          ? `Explore ${name} calendars, official standings and published records. Post-race analysis is supported; live timing collection is not provided.`
          : `Find ${name} calendars, circuit information and official reference links.`
      : mode === 'live'
        ? `${name} 일정과 공식 기록을 확인하세요. 실시간 분석은 해당 세션의 연결과 최신 데이터 수신이 확인된 경우에 제공됩니다.`
        : mode === 'post'
          ? `${name} 일정, 공식 순위와 공개 기록을 확인하세요. 사후 분석을 지원하며 실시간 타이밍 수집은 제공하지 않습니다.`
          : `${name} 일정, 서킷 정보와 공식 참고 링크를 확인하세요.`;
    return { title: `${name} · ${SITE_NAMES[lang]}`, description, indexable: true, path, language: lang };
  }
  return { title: SITE_NAMES[lang], description: PAGES['/'][lang][1], indexable: false, path, language: lang };
}

/** Apply after localization so translated text cannot alter canonical URLs or meta values. */
export function applySiteMetadata(html, { origin, pathname = '/', language } = {}) {
  const lang = language || (/<html\b[^>]*\blang\s*=\s*["']en(?:-[^"']*)?["']/i.test(html) ? 'en' : 'ko');
  const metadata = metadataForPath(pathname, lang);
  const canonical = `${siteOrigin(origin)}${metadata.path}`;
  const meta = (name, value, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escapeMarkup(value)}">`;
  const tags = [
    `<title>${escapeMarkup(metadata.title)}</title>`,
    meta('description', metadata.description),
    meta('robots', metadata.indexable ? 'index,follow' : 'noindex,follow'),
    `<link rel="canonical" href="${escapeMarkup(canonical)}">`,
    meta('og:type', 'website', true),
    meta('og:site_name', SITE_NAMES[metadata.language], true),
    meta('og:title', metadata.title, true),
    meta('og:description', metadata.description, true),
    meta('og:url', canonical, true),
    meta('og:locale', metadata.language === 'en' ? 'en_US' : 'ko_KR', true),
    meta('twitter:card', 'summary'),
    meta('twitter:title', metadata.title),
    meta('twitter:description', metadata.description),
  ].join('\n');
  return String(html).replace(/<head\b([^>]*)>([\s\S]*?)<\/head\s*>/i, (_, attributes, head) => {
    const cleaned = head
      .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
      .replace(/<meta\b(?=[^>]*\b(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'])[^>]*>/gi, '')
      .replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/gi, '');
    return `<head${attributes}>${cleaned}\n${tags}\n</head>`;
  });
}

export function createRobotsTxt(origin) {
  const base = siteOrigin(origin);
  return ['User-agent: *', 'Allow: /', 'Disallow: /account', 'Disallow: /display', 'Disallow: /auth/', 'Disallow: /api/', 'Disallow: /mcp', 'Disallow: /signin-with-chatgpt', 'Disallow: /signout-with-chatgpt', 'Disallow: /callback', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
}

export function createSitemapXml(origin) {
  const base = siteOrigin(origin);
  const urls = publicSitePaths.map(path => `  <url><loc>${escapeMarkup(`${base}${path}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
