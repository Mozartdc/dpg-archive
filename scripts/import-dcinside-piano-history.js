#!/usr/bin/env node
/**
 * DCInside 「A history of Piano music (피아노 음악사)」 → Notion 일괄 가져오기
 *
 *   node scripts/import-dcinside-piano-history.js            전체 실행
 *   node scripts/import-dcinside-piano-history.js --limit=1  1개만 시험 실행
 *   node scripts/import-dcinside-piano-history.js --verify    검증만
 *   node scripts/import-dcinside-piano-history.js --recrawl   크롤 캐시 무시
 *   node scripts/import-dcinside-piano-history.js --crawl-only  수집 목록만 확인
 *   node scripts/import-dcinside-piano-history.js --export-md --recrawl  Markdown+이미지 내보내기
 *
 * 재실행하면 체크포인트의 complete 항목은 건너뛰고 pending/failed만 이어서 처리한다.
 * 의존성 없음(Node 18+ 내장 fetch/FormData/Blob 사용).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ═══════════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════════

const API_KEY = process.env.NOTION_API_KEY;
// File Upload API와 data source API를 함께 지원하는 현재 버전.
const NOTION_VERSION = '2026-03-11';

const DATA_SOURCE_ID = '2f726dfb-cd79-80e8-bf74-000b28a8aaa6';
const DATABASE_ID = '2f726dfb-cd79-80e1-a9e4-c8872b0524f3';

const SYNCED_TOP_ID = '3b726dfb-cd79-808f-8ad4-d57f791ebb17';
const SYNCED_BOTTOM_ID = '2f126dfb-cd79-80c9-b783-d7e85011a79e';

const GALLERY = 'digitalpiano';
const INDEX_NO = 1911;

const CATEGORY_BY_SERIES_INDEX = ['바로크·고전', '낭만·그 이후', '작곡가 이야기'];

const EXPECTED = {
  total: 125,
  '바로크·고전': 40,
  '낭만·그 이후': 61,
  '작곡가 이야기': 24,
};

const CHECKPOINT_PATH = path.join(__dirname, '..', 'tmp', 'dcinside-piano-history.checkpoint.json');
const CRAWL_CACHE_PATH = path.join(__dirname, '..', 'tmp', 'dcinside-piano-history.crawl.json');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const IMAGE_CONCURRENCY = 2;
const MAX_IMAGE_RETRY = 3;

const argOf = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const LIMIT = argOf('limit') ? Number(argOf('limit')) : null;
const VERIFY_ONLY = process.argv.includes('--verify');
const RECRAWL = process.argv.includes('--recrawl');
const CRAWL_ONLY = process.argv.includes('--crawl-only');
const EXPORT_MD = process.argv.includes('--export-md');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 아주 작은 HTML 파서 (의존성 없이 필요한 만큼만)
// ═══════════════════════════════════════════════════════════════

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'noscript', 'textarea']);

function decodeEntities(s) {
  return s
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos|nbsp|middot|hellip|mdash|ndash|lsquo|rsquo|ldquo|rdquo));/g,
      (m, dec, hex, name) => {
        if (dec) return String.fromCodePoint(Number(dec));
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        return {
          amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
          middot: '·', hellip: '…', mdash: '—', ndash: '–',
          lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
        }[name];
      });
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** HTML 문자열 → 아주 단순한 노드 트리 */
function parseHTML(html) {
  const root = { type: 'root', tag: null, attrs: {}, children: [], parent: null };
  let cur = root;
  const tagRe = /<(\/?)([a-zA-Z][-a-zA-Z0-9:]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  let last = 0;
  let m;

  const pushText = (text) => {
    if (!text) return;
    cur.children.push({ type: 'text', value: decodeEntities(text), parent: cur });
  };

  while ((m = tagRe.exec(html))) {
    pushText(html.slice(last, m.index));
    last = tagRe.lastIndex;

    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClose = m[4] === '/' || VOID_TAGS.has(tag);

    if (closing) {
      let node = cur;
      while (node && node.tag !== tag) node = node.parent;
      if (node && node.parent) cur = node.parent;
      continue;
    }

    const el = { type: 'element', tag, attrs: parseAttrs(m[3]), children: [], parent: cur };
    cur.children.push(el);

    if (RAW_TEXT_TAGS.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i');
      const rest = html.slice(last);
      const cm = closeRe.exec(rest);
      const end = cm ? last + cm.index + cm[0].length : html.length;
      tagRe.lastIndex = end;
      last = end;
      continue;
    }
    if (!selfClose) cur = el;
  }
  pushText(html.slice(last));
  return root;
}

function classListOf(node) {
  return (node.attrs?.class || '').split(/\s+/).filter(Boolean);
}
function hasClass(node, cls) {
  return classListOf(node).includes(cls);
}
function walk(node, fn) {
  fn(node);
  for (const c of node.children || []) if (c.type === 'element') walk(c, fn);
}
function findByClass(root, cls) {
  let found = null;
  walk(root, (n) => {
    if (!found && n.type === 'element' && hasClass(n, cls)) found = n;
  });
  return found;
}
function findAllByClass(root, cls) {
  const out = [];
  walk(root, (n) => {
    if (n.type === 'element' && hasClass(n, cls)) out.push(n);
  });
  return out;
}
function findAllByTag(root, tag) {
  const out = [];
  walk(root, (n) => {
    if (n.type === 'element' && n.tag === tag) out.push(n);
  });
  return out;
}
function textOf(node) {
  let s = '';
  const rec = (n) => {
    if (n.type === 'text') s += n.value;
    else for (const c of n.children || []) rec(c);
  };
  rec(node);
  return s;
}
function isInsideClass(node, cls) {
  let p = node.parent;
  while (p) {
    if (p.type === 'element' && hasClass(p, cls)) return true;
    p = p.parent;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// DCInside 수집
// ═══════════════════════════════════════════════════════════════

const mobileUrl = (no) => `https://m.dcinside.com/board/${GALLERY}/${no}`;
const pcUrl = (no) => `https://gall.dcinside.com/mgallery/board/view/?id=${GALLERY}&no=${no}`;

async function httpGet(url, { referer, binary = false, tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': binary
            ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          ...(referer ? { Referer: referer } : {}),
        },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (binary) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, contentType: res.headers.get('content-type') || '', status: res.status };
      }
      return { html: await res.text(), status: res.status };
    } catch (e) {
      lastErr = e;
      await sleep(500 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

function getPostNoFromHref(href) {
  if (!href) return null;
  let m = /\/board\/[^/]+\/(\d+)/.exec(href);
  if (m) return Number(m[1]);
  // PC 갤러리의 짧은 주소: https://gall.dcinside.com/digitalpiano/1909
  m = /\/digitalpiano\/(\d+)(?:[?#/]|$)/.exec(href);
  if (m) return Number(m[1]);
  m = /[?&]no=(\d+)/.exec(href);
  if (m && /digitalpiano/.test(href)) return Number(m[1]);
  return null;
}

/** 본문 컨테이너 찾기 (모바일/PC 모두 대응) */
function findWriteDiv(doc) {
  return (
    findByClass(doc, 'write_div') ||
    findByClass(doc, 'thum-txtin') ||
    findByClass(doc, 'writing_view_box')
  );
}

function findTitle(doc) {
  const el =
    findByClass(doc, 'title_subject') ||
    findByClass(doc, 'tit-txt') ||
    findByClass(doc, 'gallview-tit-box');
  return el ? textOf(el).trim().replace(/\s+/g, ' ') : '';
}

/** .dc_series 안의 a.lnk 링크에서 하위 글 번호를 순서대로 수집 */
function seriesLinks(writeDiv) {
  const blocks = findAllByClass(writeDiv, 'dc_series');
  const groups = [];
  for (const b of blocks) {
    const links = [];
    for (const a of findAllByTag(b, 'a')) {
      if (!hasClass(a, 'lnk')) continue;
      const no = getPostNoFromHref(a.attrs.href);
      if (no && !links.some((link) => link.no === no)) {
        links.push({ no, title: textOf(a).trim().replace(/^·\s*/, '').replace(/\s+/g, ' ') });
      }
    }
    if (links.length) groups.push(links);
  }
  return groups;
}

async function fetchPost(no) {
  let doc, html;
  try {
    ({ html } = await httpGet(mobileUrl(no)));
    doc = parseHTML(html);
    if (!findWriteDiv(doc) || !findTitle(doc)) throw new Error('mobile parse miss');
  } catch {
    ({ html } = await httpGet(pcUrl(no)));
    doc = parseHTML(html);
  }
  const writeDiv = findWriteDiv(doc);
  if (!writeDiv) throw new Error(`본문(.write_div)을 찾지 못함: ${no}`);
  return { no, title: findTitle(doc), writeDiv, url: mobileUrl(no) };
}

/**
 * 1911에서 시작해 .dc_series a.lnk를 재귀적으로 따라가며
 * 카테고리 상속 + 깊이 우선 순서로 대상 목록을 만든다.
 */
async function crawl() {
  if (!RECRAWL && fs.existsSync(CRAWL_CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(CRAWL_CACHE_PATH, 'utf8'));
    console.log(`📂 크롤 캐시 사용: ${cached.length}개`);
    return cached;
  }

  const index = await fetchPost(INDEX_NO);
  const groups = seriesLinks(index.writeDiv);
  console.log(`🔎 인덱스 ${INDEX_NO}: 시리즈 블록 ${groups.length}개, 1차 링크 ${groups.flat().length}개`);

  const visited = new Set([INDEX_NO]);
  const result = [];

  async function dfs(no, category, depth, linkedTitle = '', parentPostNo = INDEX_NO) {
    if (visited.has(no)) return;
    visited.add(no);
    let post;
    try {
      post = await fetchPost(no);
    } catch (error) {
      result.push({
        no,
        url: mobileUrl(no),
        title: linkedTitle,
        category,
        depth,
        parentPostNo,
        crawlStatus: 'failed',
        httpStatus: /HTTP (\d+)/.exec(String(error.message || error))?.[1] || null,
        error: String(error.message || error),
      });
      console.warn(`   ${'  '.repeat(depth)}× ${no} ${linkedTitle} (${error.message})`);
      return;
    }
    await sleep(150);
    result.push({ no, url: post.url, title: post.title, category, depth, parentPostNo, crawlStatus: 'ok' });
    console.log(`   ${'  '.repeat(depth)}· ${no} ${post.title}`);
    const childGroups = seriesLinks(post.writeDiv);
    for (const links of childGroups) {
      for (const child of links) await dfs(child.no, category, depth + 1, child.title, no);
    }
  }

  for (let i = 0; i < groups.length; i++) {
    const category = CATEGORY_BY_SERIES_INDEX[i];
    if (!category) {
      console.warn(`⚠️  시리즈 블록 ${i + 1}에 대응하는 카테고리가 없음 — 건너뜀`);
      continue;
    }
    for (const link of groups[i]) await dfs(link.no, category, 0, link.title, INDEX_NO);
  }

  // 카테고리별 깊이 우선 순회 순서대로 1부터 번호 부여
  const counter = {};
  for (const item of result) {
    counter[item.category] = (counter[item.category] || 0) + 1;
    item.order = counter[item.category];
  }

  fs.mkdirSync(path.dirname(CRAWL_CACHE_PATH), { recursive: true });
  fs.writeFileSync(CRAWL_CACHE_PATH, JSON.stringify(result, null, 1));
  console.log(`💾 크롤 결과 저장: ${result.length}개 → ${CRAWL_CACHE_PATH}`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 본문 → Notion 블록
// ═══════════════════════════════════════════════════════════════

const IMG_ATTRS = ['src', 'data-original', 'data-src', 'data-img', 'data-lazy', 'data-original-src'];

function imageUrlOf(img) {
  for (const a of IMG_ATTRS) {
    const v = img.attrs[a];
    if (v && !/^data:/.test(v) && /^https?:\/\//.test(v)) return v;
  }
  const v = img.attrs.src;
  if (v && /^\/\//.test(v)) return 'https:' + v;
  return null;
}

/** rich_text 조각 만들기 (굵게/링크 보존, 2000자 분할) */
function richText(runs) {
  const out = [];
  for (const run of runs) {
    let text = run.text;
    if (!text) continue;
    while (text.length > 0) {
      const chunk = text.slice(0, 2000);
      text = text.slice(2000);
      out.push({
        type: 'text',
        text: { content: chunk, link: run.link ? { url: run.link } : null },
        annotations: {
          bold: !!run.bold, italic: !!run.italic, strikethrough: false,
          underline: !!run.underline, code: false, color: 'default',
        },
      });
      if (out.length >= 100) return out;
    }
  }
  return out;
}

/**
 * .write_div → Notion 블록 배열.
 * .dc_series(시리즈 자동 목록)는 본문에서 제외한다.
 * 이미지는 { __image: url } 자리표시자로 넣고 나중에 업로드 결과로 교체한다.
 */
function bodyToBlocks(writeDiv) {
  const blocks = [];
  let runs = [];

  const flush = () => {
    const text = runs.map((r) => r.text).join('');
    if (text.trim()) {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: richText(runs) },
      });
    }
    runs = [];
  };

  const rec = (node, style) => {
    for (const n of node.children || []) {
      if (n.type === 'text') {
        const t = n.value.replace(/​/g, '');
        if (t) runs.push({ ...style, text: t });
        continue;
      }
      if (n.type !== 'element') continue;

      const tag = n.tag;
      if (hasClass(n, 'dc_series')) continue;              // 시리즈 자동 목록 제외
      if (RAW_TEXT_TAGS.has(tag)) continue;
      if (tag === 'br') { runs.push({ ...style, text: '\n' }); continue; }

      if (tag === 'img') {
        const url = imageUrlOf(n);
        flush();
        if (url) blocks.push({ __image: url });
        continue;
      }

      if (tag === 'iframe') {
        const src = n.attrs.src || '';
        if (/^https?:\/\//.test(src) || /^\/\//.test(src)) {
          flush();
          blocks.push({
            object: 'block', type: 'embed',
            embed: { url: src.startsWith('//') ? 'https:' + src : src },
          });
        }
        continue;
      }

      const next = { ...style };
      if (tag === 'b' || tag === 'strong') next.bold = true;
      if (tag === 'i' || tag === 'em') next.italic = true;
      if (tag === 'u' || tag === 'ins') next.underline = true;
      if (tag === 'a' && n.attrs.href && /^https?:\/\//.test(n.attrs.href)) next.link = n.attrs.href;

      const isBlock = /^(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote|section|ul|ol|table|hr)$/.test(tag);
      if (isBlock) flush();
      if (tag === 'hr') { blocks.push({ object: 'block', type: 'divider', divider: {} }); continue; }
      rec(n, next);
      if (isBlock) flush();
    }
  };

  rec(writeDiv, {});
  flush();

  // 문단 안의 줄바꿈 정리 + 빈 문단 제거
  return blocks.filter((b) => {
    if (b.__image || b.type !== 'paragraph') return true;
    return b.paragraph.rich_text.some((r) => r.text.content.trim());
  });
}

function syncedRef(blockId) {
  return {
    object: 'block',
    type: 'synced_block',
    synced_block: { synced_from: { block_id: blockId } },
  };
}

// ═══════════════════════════════════════════════════════════════
// Notion API
// ═══════════════════════════════════════════════════════════════

async function notion(endpoint, method = 'GET', body = null) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Notion ${res.status} ${endpoint}: ${JSON.stringify(json).slice(0, 400)}`);
    await sleep(120);
    return json;
  }
  throw new Error(`Notion 재시도 초과: ${endpoint}`);
}

/** DCInside 이미지 → Notion File Upload */
async function uploadImage(url, referer) {
  const { buf, contentType } = await httpGet(url, { referer, binary: true, tries: 1 });
  if (!buf?.length) throw new Error('빈 응답');
  if (!/^image\//.test(contentType)) throw new Error(`이미지가 아님(content-type=${contentType})`);
  if (buf.length < 512) throw new Error(`파일이 너무 작음(${buf.length}B)`);

  const ext = /jpeg|jpg/.test(contentType) ? 'jpg'
    : /png/.test(contentType) ? 'png'
    : /gif/.test(contentType) ? 'gif'
    : /webp/.test(contentType) ? 'webp' : 'jpg';
  const filename = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const created = await notion('/file_uploads', 'POST', {
    mode: 'single_part',
    filename,
    content_type: contentType.split(';')[0],
  });

  const form = new FormData();
  form.append('file', new Blob([buf], { type: contentType.split(';')[0] }), filename);
  const up = await fetch(created.upload_url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Notion-Version': NOTION_VERSION },
    body: form,
  });
  if (!up.ok) throw new Error(`업로드 실패 ${up.status}: ${(await up.text()).slice(0, 200)}`);

  return created.id;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

async function resolveImages(blocks, referer, report) {
  const targets = blocks.map((b, i) => (b.__image ? { i, url: b.__image } : null)).filter(Boolean);
  report.imagesFound += targets.length;

  await mapLimit(targets, IMAGE_CONCURRENCY, async (t) => {
    for (let attempt = 0; attempt < MAX_IMAGE_RETRY; attempt++) {
      try {
        const fileId = await uploadImage(t.url, referer);
        blocks[t.i] = {
          object: 'block', type: 'image',
          image: { type: 'file_upload', file_upload: { id: fileId } },
        };
        report.imagesUploaded += 1;
        return;
      } catch (e) {
        if (attempt === MAX_IMAGE_RETRY - 1) {
          report.imageFailures.push({ url: t.url, error: String(e.message || e) });
          blocks[t.i] = null;      // 실패한 이미지는 DCInside URL을 남기지 않고 제거
        } else {
          await sleep(800 * Math.pow(2, attempt));
        }
      }
    }
  });

  return blocks.filter(Boolean);
}

async function findExistingPage(title, category) {
  const res = await notion(`/data_sources/${DATA_SOURCE_ID}/query`, 'POST', {
    filter: {
      and: [
        { property: '제목', title: { equals: title } },
        { property: '카테고리', select: { equals: category } },
      ],
    },
    page_size: 5,
  });
  if ((res.results?.length || 0) > 1) {
    throw new Error(`동일한 제목·카테고리 페이지가 ${res.results.length}개라 자동 갱신을 중단함: ${category} / ${title}`);
  }
  return res.results?.[0] || null;
}

async function listAllChildren(blockId) {
  const all = [];
  let cursor;
  do {
    const res = await notion(`/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    all.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return all;
}

function isRecognizableImportPage(blocks) {
  if (blocks.length === 0) return true;
  const expected = new Set([SYNCED_TOP_ID, SYNCED_BOTTOM_ID].map((id) => id.replace(/-/g, '')));
  return blocks.some((b) => {
    const sourceId = b.type === 'synced_block' && b.synced_block?.synced_from?.block_id;
    return sourceId && expected.has(sourceId.replace(/-/g, ''));
  });
}

async function replacePageContent(pageId, blocks, { trustedCheckpoint = false } = {}) {
  const oldBlocks = await listAllChildren(pageId);
  if (!trustedCheckpoint && !isRecognizableImportPage(oldBlocks)) {
    throw new Error(`기존 페이지에 가져오기 표식이 없어 본문 삭제를 중단함: ${pageId}`);
  }

  // 먼저 전체 ID를 수집해야 삭제 도중 페이지네이션 커서가 흔들리지 않는다.
  for (const b of oldBlocks) {
    await notion(`/blocks/${b.id}`, 'DELETE');
  }

  for (let i = 0; i < blocks.length; i += 100) {
    await notion(`/blocks/${pageId}/children`, 'PATCH', { children: blocks.slice(i, i + 100) });
  }
}

// ═══════════════════════════════════════════════════════════════
// 로컬 Markdown 내보내기
// ═══════════════════════════════════════════════════════════════

const MARKDOWN_ROOT = path.join(__dirname, '..', 'content', 'dcinside-piano-history');

function safeFilename(value) {
  return value
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 150);
}

function markdownText(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([\[\]*_])/g, '\\$1');
}

function richTextToMarkdown(items) {
  return (items || []).map((item) => {
    const raw = item.text?.content || '';
    let rendered = markdownText(raw);
    const annotations = item.annotations || {};
    if (annotations.bold && rendered.trim()) rendered = `**${rendered}**`;
    if (annotations.italic && rendered.trim()) rendered = `*${rendered}*`;
    if (annotations.underline && rendered.trim()) rendered = `<u>${rendered}</u>`;
    const link = item.text?.link?.url;
    if (link && rendered.trim()) rendered = `[${rendered}](${link})`;
    return rendered;
  }).join('');
}

function imageExtension(contentType, url, buf) {
  if (buf?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (buf?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf?.subarray(0, 6).toString('ascii') === 'GIF87a' || buf?.subarray(0, 6).toString('ascii') === 'GIF89a') return 'gif';
  if (buf?.subarray(0, 4).toString('ascii') === 'RIFF' && buf?.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (/jpeg|jpg/i.test(contentType)) return 'jpg';
  if (/png/i.test(contentType)) return 'png';
  if (/gif/i.test(contentType)) return 'gif';
  if (/webp/i.test(contentType)) return 'webp';
  if (/svg/i.test(contentType)) return 'svg';
  const hit = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(url);
  const ext = hit?.[1]?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff'].includes(ext) ? ext : null;
}

async function exportPostMarkdown(target) {
  const post = await fetchPost(target.no);
  const blocks = bodyToBlocks(post.writeDiv);
  const imageDir = path.join(MARKDOWN_ROOT, 'assets', String(target.no));
  const imageTargets = blocks.map((block, position) => block.__image ? { block, position } : null).filter(Boolean);
  const imageResults = [];

  if (imageTargets.length) fs.mkdirSync(imageDir, { recursive: true });
  await mapLimit(imageTargets, IMAGE_CONCURRENCY, async ({ block, position }, imageIndex) => {
    try {
      const downloaded = await httpGet(block.__image, { referer: pcUrl(target.no), binary: true, tries: MAX_IMAGE_RETRY });
      const ext = imageExtension(downloaded.contentType, block.__image, downloaded.buf);
      if (!downloaded.buf?.length || downloaded.buf.length < 512 || !ext) {
        throw new Error(`이미지 응답이 아님: ${downloaded.contentType || 'unknown'}`);
      }
      const name = `${String(imageIndex + 1).padStart(3, '0')}.${ext}`;
      fs.writeFileSync(path.join(imageDir, name), downloaded.buf);
      imageResults.push({ index: imageIndex + 1, position, url: block.__image, file: `assets/${target.no}/${name}`, bytes: downloaded.buf.length, status: 'ok' });
    } catch (error) {
      imageResults.push({ index: imageIndex + 1, position, url: block.__image, status: 'failed', error: String(error.message || error) });
    }
  });

  imageResults.sort((a, b) => a.position - b.position);
  const imageByPosition = new Map(imageResults.map((result) => [result.position, result]));
  const body = [];
  for (const [position, block] of blocks.entries()) {
    if (block.__image) {
      const image = imageByPosition.get(position);
      if (image?.status === 'ok') body.push(`![${post.title} 이미지 ${image.index}](../${image.file})`);
      else body.push(`<!-- IMAGE_DOWNLOAD_FAILED: ${block.__image} -->`);
    } else if (block.type === 'paragraph') {
      body.push(richTextToMarkdown(block.paragraph.rich_text));
    } else if (block.type === 'divider') {
      body.push('---');
    } else if (block.type === 'embed') {
      body.push(block.embed.url);
    }
  }

  const markdown = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `category: ${JSON.stringify(target.category)}`,
    `order: ${target.order}`,
    `source_url: ${JSON.stringify(target.url)}`,
    `source_post_no: ${target.no}`,
    `images_expected: ${imageTargets.length}`,
    `images_downloaded: ${imageResults.filter((image) => image.status === 'ok').length}`,
    `status: ${JSON.stringify(imageResults.some((image) => image.status === 'failed') ? 'partial' : 'complete')}`,
    '---',
    '',
    '<!-- NOTION_SYNCED_TOP: 3b726dfb-cd79-808f-8ad4-d57f791ebb17 -->',
    '',
    ...body,
    '',
    '<!-- NOTION_SYNCED_BOTTOM: 2f126dfb-cd79-80c9-b783-d7e85011a79e -->',
    '',
  ].join('\n\n');

  const categoryDir = path.join(MARKDOWN_ROOT, target.category);
  fs.mkdirSync(categoryDir, { recursive: true });
  const filename = `${String(target.order).padStart(3, '0')}-${safeFilename(post.title)}.md`;
  fs.writeFileSync(path.join(categoryDir, filename), markdown);

  return {
    ...target,
    title: post.title,
    markdown: `${target.category}/${filename}`,
    imagesExpected: imageTargets.length,
    imagesDownloaded: imageResults.filter((image) => image.status === 'ok').length,
    imageFailures: imageResults.filter((image) => image.status === 'failed'),
    status: imageResults.some((image) => image.status === 'failed') ? 'partial' : 'complete',
  };
}

async function exportMarkdown(targets) {
  fs.mkdirSync(MARKDOWN_ROOT, { recursive: true });
  const manifest = [];
  const failures = targets.filter((target) => target.crawlStatus === 'failed').map((target) => ({
    post_no: target.no,
    title: target.title,
    category: target.category,
    order: target.order,
    parent_post_no: target.parentPostNo,
    http_status: Number(target.httpStatus) || null,
    source_url: target.url,
    crawl_status: 'failed',
    error: target.error,
  }));
  const available = targets.filter((target) => target.crawlStatus !== 'failed');

  console.log(`\n📦 Markdown 내보내기: 정상 ${available.length}개 / 접근 실패 ${failures.length}개`);
  for (const [index, target] of available.entries()) {
    try {
      const record = await exportPostMarkdown(target);
      manifest.push(record);
      failures.push(...record.imageFailures.map((failure) => ({
        post_no: target.no,
        title: target.title,
        category: target.category,
        type: 'image',
        ...failure,
      })));
      console.log(`  [${index + 1}/${available.length}] ${record.status === 'complete' ? '✅' : '⚠️ '} ${target.no} ${record.title} (이미지 ${record.imagesDownloaded}/${record.imagesExpected})`);
    } catch (error) {
      failures.push({ post_no: target.no, title: target.title, category: target.category, order: target.order, source_url: target.url, crawl_status: 'failed', error: String(error.message || error) });
      console.error(`  [${index + 1}/${available.length}] ❌ ${target.no} ${target.title}: ${error.message}`);
    }
  }

  const totals = {
    expected: targets.length,
    posts: manifest.length,
    failedPosts: failures.filter((failure) => failure.crawl_status === 'failed').length,
    imagesExpected: manifest.reduce((sum, item) => sum + item.imagesExpected, 0),
    imagesDownloaded: manifest.reduce((sum, item) => sum + item.imagesDownloaded, 0),
    byCategory: Object.fromEntries(CATEGORY_BY_SERIES_INDEX.map((category) => [category, manifest.filter((item) => item.category === category).length])),
  };
  fs.writeFileSync(path.join(MARKDOWN_ROOT, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), totals, posts: manifest }, null, 2));
  fs.writeFileSync(path.join(MARKDOWN_ROOT, 'failures.json'), JSON.stringify(failures, null, 2));
  fs.writeFileSync(path.join(MARKDOWN_ROOT, 'README.md'), [
    '# DCInside 피아노 음악사 로컬 보관본',
    '',
    `- 전체 링크: ${totals.expected}개`,
    `- Markdown 생성: ${totals.posts}개`,
    `- 접근 실패 글: ${totals.failedPosts}개`,
    `- 이미지: ${totals.imagesDownloaded}/${totals.imagesExpected}개`,
    `- 바로크·고전: ${totals.byCategory['바로크·고전']}개`,
    `- 낭만·그 이후: ${totals.byCategory['낭만·그 이후']}개`,
    `- 작곡가 이야기: ${totals.byCategory['작곡가 이야기']}개`,
    '',
    '세부 실패 내역은 `failures.json`에 기록함.',
    '',
  ].join('\n'));
  console.log(`\n💾 ${MARKDOWN_ROOT}`);
  console.log(JSON.stringify(totals, null, 2));
  return { manifest, failures, totals };
}

// ═══════════════════════════════════════════════════════════════
// 체크포인트
// ═══════════════════════════════════════════════════════════════

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { items: {}, conflicts: [] };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
}
function saveCheckpoint(cp) {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 1));
}

// ═══════════════════════════════════════════════════════════════
// 한 글 처리
// ═══════════════════════════════════════════════════════════════

async function importOne(target, cp) {
  const key = String(target.no);
  const report = { imagesFound: 0, imagesUploaded: 0, imageFailures: [] };

  const post = await fetchPost(target.no);
  const title = post.title || target.title;

  let body = bodyToBlocks(post.writeDiv);
  body = await resolveImages(body, pcUrl(target.no), report);

  const children = [syncedRef(SYNCED_TOP_ID), ...body, syncedRef(SYNCED_BOTTOM_ID)];

  const existing = cp.items[key]?.pageId
    ? { id: cp.items[key].pageId }
    : await findExistingPage(title, target.category);

  let pageId;
  if (existing) {
    pageId = existing.id;
    await notion(`/pages/${pageId}`, 'PATCH', {
      properties: {
        '제목': { title: [{ type: 'text', text: { content: title } }] },
        '카테고리': { select: { name: target.category } },
        '순서': { number: target.order },
        '상태': { status: { name: '완료' } },
        '설명': { rich_text: [{ type: 'text', text: { content: target.url } }] },
      },
    });
    await replacePageContent(pageId, children, { trustedCheckpoint: cp.items[key]?.pageId === pageId });
  } else {
    const created = await notion('/pages', 'POST', {
      parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID },
      properties: {
        '제목': { title: [{ type: 'text', text: { content: title } }] },
        '카테고리': { select: { name: target.category } },
        '순서': { number: target.order },
        '상태': { status: { name: '완료' } },
        '설명': { rich_text: [{ type: 'text', text: { content: target.url } }] },
      },
      children: children.slice(0, 100),
    });
    pageId = created.id;
    for (let i = 100; i < children.length; i += 100) {
      await notion(`/blocks/${pageId}/children`, 'PATCH', { children: children.slice(i, i + 100) });
    }
  }

  cp.items[key] = {
    sourceUrl: target.url,
    title,
    category: target.category,
    order: target.order,
    imagesFound: report.imagesFound,
    imagesUploaded: report.imagesUploaded,
    pageId,
    status: report.imageFailures.length ? 'failed' : 'complete',
    error: report.imageFailures.length
      ? `이미지 ${report.imageFailures.length}개 실패: ${report.imageFailures.map((f) => f.error).join(' | ').slice(0, 300)}`
      : null,
    adopted: !!existing,
  };
  saveCheckpoint(cp);
  return cp.items[key];
}

// ═══════════════════════════════════════════════════════════════
// 검증
// ═══════════════════════════════════════════════════════════════

async function verify(targets, cp) {
  console.log('\n🔍 검증');
  const problems = [];
  const byCategory = {};
  const seenPages = new Map();

  for (const t of targets) {
    const rec = cp.items[String(t.no)];
    if (!rec || rec.status !== 'complete') {
      problems.push(`미완료: ${t.no} ${t.title}`);
      continue;
    }
    byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
    if (seenPages.has(rec.pageId)) problems.push(`중복 page_id: ${rec.pageId}`);
    seenPages.set(rec.pageId, t.no);

    const page = await notion(`/pages/${rec.pageId}`);
    const actualTitle = page.properties?.['제목']?.title?.map((x) => x.plain_text).join('') || '';
    if (actualTitle !== rec.title) problems.push(`제목 불일치: ${rec.pageId} "${actualTitle}" ≠ "${rec.title}"`);
    if (page.properties?.['상태']?.status?.name !== '완료') problems.push(`상태가 완료가 아님: ${rec.pageId}`);

    const list = await listAllChildren(rec.pageId);
    const syncedFrom = list
      .filter((b) => b.type === 'synced_block' && b.synced_block?.synced_from?.block_id)
      .map((b) => b.synced_block.synced_from.block_id.replace(/-/g, ''));
    const top = syncedFrom.filter((id) => id === SYNCED_TOP_ID.replace(/-/g, '')).length;
    const bottom = syncedFrom.filter((id) => id === SYNCED_BOTTOM_ID.replace(/-/g, '')).length;
    if (top !== 1) problems.push(`상단 동기화 블록 ${top}개: ${rec.pageId}`);
    if (bottom !== 1) problems.push(`하단 동기화 블록 ${bottom}개: ${rec.pageId}`);

    const imageBlocks = list.filter((b) => b.type === 'image').length;
    if (imageBlocks !== rec.imagesUploaded) {
      problems.push(`이미지 수 불일치: ${rec.pageId} 페이지 ${imageBlocks} ≠ 업로드 ${rec.imagesUploaded}`);
    }
    const external = list.some(
      (b) => b.type === 'image' && /dcinside/.test(b.image?.external?.url || '')
    );
    if (external) problems.push(`DCInside 임시 URL 잔존: ${rec.pageId}`);
  }

  console.log(`   대상 ${targets.length}개 / 기대 ${EXPECTED.total}개`);
  for (const [cat, want] of Object.entries(EXPECTED)) {
    if (cat === 'total') continue;
    const got = byCategory[cat] || 0;
    console.log(`   ${cat}: ${got}개 (기대 ${want}개)`);
    if (got !== want) problems.push(`카테고리 개수 불일치: ${cat} ${got} ≠ ${want}`);
  }
  if (targets.length !== EXPECTED.total) problems.push(`대상 수 불일치: ${targets.length} ≠ ${EXPECTED.total}`);

  return problems;
}

// ═══════════════════════════════════════════════════════════════
// 실행
// ═══════════════════════════════════════════════════════════════

async function main() {
  if (!API_KEY) {
    console.error('❌ NOTION_API_KEY가 없음 (.env 확인)');
    process.exit(1);
  }

  const targets = await crawl();
  if (EXPORT_MD) {
    await exportMarkdown(targets);
    return;
  }
  if (CRAWL_ONLY) {
    const counts = Object.fromEntries(CATEGORY_BY_SERIES_INDEX.map((category) => [
      category,
      targets.filter((t) => t.category === category).length,
    ]));
    console.log(`\n수집 결과: 전체 ${targets.length}개 / ${Object.entries(counts).map(([k, v]) => `${k} ${v}개`).join(' / ')}`);
    if (targets.length !== EXPECTED.total || CATEGORY_BY_SERIES_INDEX.some((c) => counts[c] !== EXPECTED[c])) {
      process.exitCode = 1;
    }
    return;
  }
  const cp = loadCheckpoint();

  if (!VERIFY_ONLY) {
    const queue = targets.filter((t) => cp.items[String(t.no)]?.status !== 'complete');
    const slice = LIMIT ? queue.slice(0, LIMIT) : queue;
    console.log(`\n📝 처리 대상 ${slice.length}개 (전체 ${targets.length}, 완료 ${targets.length - queue.length})`);

    for (const [idx, t] of slice.entries()) {
      try {
        const rec = await importOne(t, cp);
        console.log(`  [${idx + 1}/${slice.length}] ${rec.status === 'complete' ? '✅' : '⚠️ '} ${t.no} ${rec.title} (이미지 ${rec.imagesUploaded}/${rec.imagesFound})`);
      } catch (e) {
        cp.items[String(t.no)] = {
          ...(cp.items[String(t.no)] || {}),
          sourceUrl: t.url, title: t.title, category: t.category, order: t.order,
          status: 'failed', error: String(e.message || e),
        };
        saveCheckpoint(cp);
        console.error(`  [${idx + 1}/${slice.length}] ❌ ${t.no} ${t.title}: ${e.message}`);
      }
    }

    // 실패 항목 2차 재시도
    const retry = targets.filter((t) => cp.items[String(t.no)]?.status === 'failed');
    if (retry.length && !LIMIT) {
      console.log(`\n♻️  실패 ${retry.length}개 재시도`);
      for (const t of retry) {
        try {
          const rec = await importOne(t, cp);
          console.log(`   ${rec.status === 'complete' ? '✅' : '⚠️ '} ${t.no} ${rec.title}`);
        } catch (e) {
          console.error(`   ❌ ${t.no}: ${e.message}`);
        }
      }
    }
  }

  const problems = await verify(targets, cp);

  const done = targets.filter((t) => cp.items[String(t.no)]?.status === 'complete');
  const failed = targets.filter((t) => cp.items[String(t.no)]?.status === 'failed');
  const adopted = done.filter((t) => cp.items[String(t.no)]?.adopted);
  const imagesFound = Object.values(cp.items).reduce((a, r) => a + (r.imagesFound || 0), 0);
  const imagesUploaded = Object.values(cp.items).reduce((a, r) => a + (r.imagesUploaded || 0), 0);

  console.log('\n══════════ 최종 보고 ══════════');
  console.log(`성공 ${done.length} / 실패 ${failed.length} / 기존 페이지 재사용 ${adopted.length} (전체 ${targets.length})`);
  console.log(`이미지 발견 ${imagesFound}개, 업로드 성공 ${imagesUploaded}개`);
  console.log(`체크포인트: ${CHECKPOINT_PATH}`);
  console.log(`크롤 캐시:  ${CRAWL_CACHE_PATH}`);

  if (failed.length) {
    console.log('\n실패 항목:');
    for (const t of failed) console.log(`  - ${t.url} :: ${cp.items[String(t.no)].error}`);
  }
  if (problems.length) {
    console.log('\n검증 실패:');
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ 검증 통과');
    console.log('\n페이지 URL:');
    for (const t of targets) {
      const r = cp.items[String(t.no)];
      if (r?.pageId) console.log(`  ${r.category} ${r.order}. ${r.title}\n     https://www.notion.so/${r.pageId.replace(/-/g, '')}`);
    }
  }
}

main().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
