import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySiteMetadata, createRobotsTxt, createSitemapXml, metadataForPath, publicSitePaths } from '../worker/site-metadata.js';

const origin = 'https://preview.example';

test('public pages have distinct localized metadata and describe supported analysis accurately', () => {
  for (const language of ['ko', 'en']) {
    const pages = publicSitePaths.map(path => metadataForPath(path, language));
    assert.equal(new Set(pages.map(page => page.title)).size, pages.length);
    assert.ok(pages.every(page => page.indexable && page.description.length > 20));
  }
  assert.match(metadataForPath('/championships/imsa', 'en').description, /live timing collection is not provided/);
  assert.match(metadataForPath('/championships/f1', 'en').description, /only when the session and current collection are verified/);
  assert.match(metadataForPath('/championships/gtwc-europe', 'en').description, /official reference links/);
});

test('metadata replacement removes obsolete head tags while preserving unrelated markup', () => {
  const original = '<html lang="en"><head><meta charset="utf-8"><title>Old</title><meta content="old" name="description"><meta property="og:title" content="old"><link href="https://old.example/" rel="canonical"><style>p{color:red}</style></head><body><h1>Untouched</h1></body></html>';
  const html = applySiteMetadata(original, { origin, pathname: '/guide?view=mobile#start' });
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(html, /How to use/);
  assert.match(html, /rel="canonical" href="https:\/\/preview.example\/guide"/);
  assert.match(html, /<style>p\{color:red\}<\/style>/);
  assert.match(html, /<body><h1>Untouched<\/h1><\/body>/);
  assert.doesNotMatch(html, /old\.example/);
});

test('language comes from the root html element rather than an English CSS selector', () => {
  const koreanHtml = '<html lang="ko"><head><style>html[lang="en"]{color:white}</style></head></html>';
  assert.match(applySiteMetadata(koreanHtml, { origin, pathname: '/guide' }), /<title>이용 방법/);
  assert.match(applySiteMetadata(koreanHtml, { origin, pathname: '/guide', language: 'en' }), /<title>How to use/);
});

test('account, display and unknown routes are not indexed', () => {
  for (const pathname of ['/account', '/display', '/missing', '/championships/unlisted']) {
    assert.equal(metadataForPath(pathname).indexable, false);
    const html = applySiteMetadata('<html><head></head></html>', { origin, pathname });
    assert.match(html, /name="robots" content="noindex,follow"/);
  }
  assert.equal(metadataForPath('/guide/').path, '/guide');
});

test('sitemap contains each supported public route once and excludes account pages', () => {
  const xml = createSitemapXml(origin);
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(locations.length, publicSitePaths.length);
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(publicSitePaths.every(path => locations.includes(`${origin}${path}`)));
  assert.doesNotMatch(xml, /\/account|\/display/);
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
});

test('robots points to the deployment sitemap and rejects non-web origins', () => {
  const robots = createRobotsTxt(origin);
  assert.match(robots, /Disallow: \/account/);
  assert.match(robots, /Sitemap: https:\/\/preview.example\/sitemap.xml/);
  assert.throws(() => createSitemapXml('file:///tmp/site'));
});
