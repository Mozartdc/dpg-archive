#!/usr/bin/env node
/**
 * 교정 완료된 로컬 Markdown(content/dcinside-piano-history/) → Notion DPG Archive 콘텐츠 업로드
 *
 *   node scripts/upload-piano-history-to-notion.js --test [--post=1910]  이미지 있는 글 1개만 시험
 *   node scripts/upload-piano-history-to-notion.js --all      전체 124개 업로드 (+ 실패 1회 재시도) + 검증 + 보고서
 *   node scripts/upload-piano-history-to-notion.js --refresh=1910,2007  지정 글만 기존 페이지에 다시 반영 + 전체 검증
 *   node scripts/upload-piano-history-to-notion.js --verify   업로드 없이 검증 + 보고서만 갱신
 *
 * 중요:
 * - DCInside를 다시 크롤하지 않는다. 원본은 오직 content/dcinside-piano-history/ 의 교정 완료된
 *   Markdown 124개(review/, fact-check/, correction-report.md 등은 제외)이다.
 * - 로컬 이미지 271개는 content/dcinside-piano-history/assets/ 에서 읽어 Notion File Upload API로
 *   올린다. DCInside 외부 이미지 URL을 Notion에 직접 연결하지 않는다.
 * - 상단/하단은 실제 synced_block reference로 연결한다(텍스트 복사가 아님).
 * - 재실행하면 체크포인트의 complete 항목은 건너뛰고 pending/failed만 이어서 처리한다.
 * - 의존성 없음(Node 18+ 내장 fetch/FormData/Blob 사용).
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
const NOTION_VERSION = '2026-03-11';

const DATA_SOURCE_ID = '2f726dfb-cd79-80e8-bf74-000b28a8aaa6';
const DATABASE_ID = '2f726dfb-cd79-80e1-a9e4-c8872b0524f3';

const SYNCED_TOP_ID = '3b726dfb-cd79-808f-8ad4-d57f791ebb17';
const SYNCED_BOTTOM_ID = '2f126dfb-cd79-80c9-b783-d7e85011a79e';

const CONTENT_ROOT = path.join(__dirname, '..', 'content', 'dcinside-piano-history');
const CHECKPOINT_PATH = path.join(__dirname, '..', 'tmp', 'dcinside-piano-history-notion.checkpoint.json');
const REPORT_PATH = path.join(CONTENT_ROOT, 'notion-upload-report.md');
const TEMPLATES_PATH = path.join(CONTENT_ROOT, 'notion-templates.json');

const CATEGORIES = ['바로크·고전', '낭만·그 이후', '작곡가 이야기'];
const EXPECTED_COUNTS = { total: 124, '바로크·고전': 40, '낭만·그 이후': 60, '작곡가 이야기': 24 };
const EXCLUDED_POST_NOS = new Set(['3658']); // 본문 없음 — 절대 페이지를 만들지 않는다

const IMAGE_CONCURRENCY = 2;
const MAX_IMAGE_RETRY = 4;
const MAX_NOTION_RETRY = 3;
const NOTION_REQUEST_TIMEOUT_MS = 30_000;
const FILE_UPLOAD_TIMEOUT_MS = 30_000;

const MODE = process.argv.includes('--test') ? 'test'
  : process.argv.includes('--all') ? 'all'
  : process.argv.includes('--verify') ? 'verify'
  : process.argv.some((arg) => arg.startsWith('--refresh=')) ? 'refresh'
  : null;
const POST_ARG = process.argv.find((arg) => arg.startsWith('--post='))?.slice('--post='.length) || null;
const REFRESH_POSTS = (process.argv.find((arg) => arg.startsWith('--refresh='))?.slice('--refresh='.length) || '')
  .split(',').map((value) => value.trim()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 프런트매터 + 본문 파싱
// ═══════════════════════════════════════════════════════════════

/** `key: value` 줄들(빈 줄로 구분됨)을 파싱한다. value는 JSON 리터럴(문자열/숫자/불리언). */
function parseFrontmatter(block) {
  const fm = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = /^([a-zA-Z_]+):\s*(.+)$/.exec(trimmed);
    if (!m) continue;
    const [, key, rawValue] = m;
    try {
      fm[key] = JSON.parse(rawValue);
    } catch {
      fm[key] = rawValue;
    }
  }
  return fm;
}

/**
 * 파일 전체를 { frontmatter, body } 로 나눈다.
 * 파일은 `---\n\n...\n\n---\n\n<본문>` 형태이고, 문단들은 빈 줄(1개 이상의 연속 개행)로 구분된다.
 */
function splitFile(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const firstDelim = text.indexOf('---');
  if (firstDelim === -1) throw new Error('frontmatter 시작 --- 를 찾지 못함');
  const afterFirst = firstDelim + 3;
  const secondDelim = text.indexOf('\n---', afterFirst);
  if (secondDelim === -1) throw new Error('frontmatter 종료 --- 를 찾지 못함');
  const fmBlock = text.slice(afterFirst, secondDelim);
  const body = text.slice(secondDelim + 4);
  return { frontmatter: parseFrontmatter(fmBlock), body };
}

/** 본문 안의 NOTION_SYNCED_TOP/BOTTOM 마커 줄을 제거한다(실제 synced_block reference로 대체할 것이므로). */
function stripSyncedMarkers(body) {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk && !/^<!--\s*NOTION_SYNCED_(TOP|BOTTOM):/.test(chunk));
}

/**
 * 이스케이프( \* \_ \[ \] \\ )와 **bold**, *italic*, <u>underline</u>, [text](url) 를
 * 인라인 rich-text run 배열로 파싱한다. export 스크립트(richTextToMarkdown)의 정확한 역변환.
 */
function parseInline(text, inherited = {}) {
  const runs = [];
  let i = 0;
  const n = text.length;
  let buf = '';

  const flush = () => {
    if (buf) {
      runs.push({ text: buf, bold: !!inherited.bold, italic: !!inherited.italic, underline: !!inherited.underline, link: inherited.link || null });
      buf = '';
    }
  };

  const findMatchingBracket = (s, openIdx) => {
    let depth = 0;
    for (let j = openIdx; j < s.length; j++) {
      if (s[j] === '[') depth++;
      else if (s[j] === ']') {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  };

  const findMatchingParen = (s, openIdx) => {
    let depth = 0;
    for (let j = openIdx; j < s.length; j++) {
      if (s[j] === '\\') { j++; continue; }
      if (s[j] === '(') depth++;
      else if (s[j] === ')') {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  };

  while (i < n) {
    const c = text[i];

    if (c === '\\' && i + 1 < n && /[\\*_\[\]<>`$\{\}|^~]/.test(text[i + 1])) {
      buf += text[i + 1];
      i += 2;
      continue;
    }

    if (text.startsWith('<u>', i)) {
      flush();
      const closeIdx = text.indexOf('</u>', i + 3);
      const inner = closeIdx === -1 ? text.slice(i + 3) : text.slice(i + 3, closeIdx);
      i = closeIdx === -1 ? n : closeIdx + 4;
      runs.push(...parseInline(inner, { ...inherited, underline: true }));
      continue;
    }

    if (text.startsWith('**', i)) {
      flush();
      const closeIdx = text.indexOf('**', i + 2);
      const inner = closeIdx === -1 ? text.slice(i + 2) : text.slice(i + 2, closeIdx);
      i = closeIdx === -1 ? n : closeIdx + 2;
      runs.push(...parseInline(inner, { ...inherited, bold: true }));
      continue;
    }

    if (c === '*') {
      flush();
      const closeIdx = text.indexOf('*', i + 1);
      if (closeIdx === -1) { buf += c; i++; continue; }
      const inner = text.slice(i + 1, closeIdx);
      i = closeIdx + 1;
      runs.push(...parseInline(inner, { ...inherited, italic: true }));
      continue;
    }

    if (c === '[') {
      const closeBracket = findMatchingBracket(text, i);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = findMatchingParen(text, closeBracket + 1);
        if (closeParen !== -1) {
          flush();
          const linkText = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          i = closeParen + 1;
          runs.push(...parseInline(linkText, { ...inherited, link: url }));
          continue;
        }
      }
      buf += c;
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  flush();
  return runs;
}

/** rich_text 배열 생성 (2000자 분할, 100개 제한은 문단 단위로는 거의 발생하지 않음) */
function richText(runs) {
  const out = [];
  for (const run of runs) {
    let text = run.text;
    if (!text) continue;
    while (text.length > 0 && out.length < 100) {
      const chunk = text.slice(0, 2000);
      text = text.slice(2000);
      const safeLink = run.link && isNotionSafeUrl(run.link) ? run.link : null;
      out.push({
        type: 'text',
        text: { content: chunk, link: safeLink ? { url: safeLink } : null },
        annotations: {
          bold: !!run.bold, italic: !!run.italic, strikethrough: false,
          underline: !!run.underline, code: false, color: 'default',
        },
      });
    }
  }
  return out;
}

const IMAGE_LINE_RE = /^!\[(.*)\]\(([^)]+)\)$/;
const BARE_URL_RE = /^https?:\/\/\S+$/;

/** Notion이 허용할 정상 HTTP(S) URL만 남긴다. Op.10, S.219 같은 작품번호 자동 링크는 평문으로 보존한다. */
function isNotionSafeUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (/^(op|no|s|h|k|hob)\.\d+(?:\.|$)/i.test(host)) return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
    const labels = host.split('.');
    const tld = labels.at(-1) || '';
    return labels.length >= 2 && (/^[a-z]{2,}$/i.test(tld) || /^xn--[a-z0-9-]+$/i.test(tld));
  } catch {
    return false;
  }
}

/**
 * 본문 청크(빈 줄로 구분된 조각) 배열 → Notion 블록 배열.
 * 이미지는 { __image: 절대경로, alt } 자리표시자로 넣고, 나중에 업로드 결과로 교체한다.
 */
function bodyToBlocks(chunks, mdFileDir) {
  const blocks = [];
  for (const chunk of chunks) {
    if (chunk === '---') {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      continue;
    }
    const imgMatch = IMAGE_LINE_RE.exec(chunk);
    if (imgMatch) {
      const [, alt, relPath] = imgMatch;
      const absPath = path.resolve(mdFileDir, relPath);
      blocks.push({ __image: absPath, alt });
      continue;
    }
    if (/^<!--\s*IMAGE_DOWNLOAD_FAILED:/.test(chunk)) {
      // 규칙상 존재하지 않아야 함(최종 검증에서 0건 확인됨) — 방어적으로 건너뛰고 기록만 함
      blocks.push({ __skippedFailedImageMarker: chunk });
      continue;
    }
    if (BARE_URL_RE.test(chunk) && isNotionSafeUrl(chunk)) {
      blocks.push({ object: 'block', type: 'embed', embed: { url: chunk } });
      continue;
    }
    const runs = parseInline(chunk);
    const rt = richText(runs);
    if (rt.length === 0) continue; // 빈 문단
    blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt } });
  }
  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// 글 목록 적재 (로컬 Markdown 124개만 — DCInside 접근 없음)
// ═══════════════════════════════════════════════════════════════

function walkMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'assets' || entry.name === 'review' || entry.name === 'fact-check') continue;
      out.push(...walkMarkdownFiles(p));
    } else if (entry.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

export { splitFile, parseFrontmatter, stripSyncedMarkers, parseInline, richText, bodyToBlocks, detectImageFormat, isNotionSafeUrl };

function loadPosts() {
  const files = walkMarkdownFiles(CONTENT_ROOT).filter((f) => CATEGORIES.includes(path.basename(path.dirname(f))));
  const posts = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { frontmatter, body } = splitFile(raw);
    const postNo = String(frontmatter.source_post_no);
    if (EXCLUDED_POST_NOS.has(postNo)) continue; // 3658 방어
    if (frontmatter.status !== 'complete') {
      console.warn(`⚠️  status가 complete가 아님(건너뛰지 않고 그대로 처리): ${file}`);
    }
    const chunks = stripSyncedMarkers(body);
    posts.push({
      postNo,
      title: frontmatter.title,
      category: frontmatter.category,
      order: Number(frontmatter.order),
      sourceUrl: frontmatter.source_url,
      imagesExpected: Number(frontmatter.images_expected) || 0,
      file,
      fileDir: path.dirname(file),
      chunks,
    });
  }
  posts.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
  return posts;
}

// ═══════════════════════════════════════════════════════════════
// Notion REST API
// ═══════════════════════════════════════════════════════════════

async function notion(endpoint, method = 'GET', body = null) {
  for (let attempt = 0; attempt < MAX_NOTION_RETRY; attempt++) {
    let res;
    try {
      res = await fetch(`https://api.notion.com/v1${endpoint}`, {
        method,
        signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
      });
    } catch (e) {
      // 네트워크 오류도 지수 백오프로 재시도
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt)));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Notion ${res.status} ${endpoint}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }
  throw new Error(`Notion 재시도 초과: ${method} ${endpoint}`);
}

// ═══════════════════════════════════════════════════════════════
// 이미지 형식 확인 + File Upload API
// ═══════════════════════════════════════════════════════════════

/** 매직 바이트로 실제 이미지 형식을 확인하고 확장자와 대조한다. */
function detectImageFormat(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a')) return { ext: 'gif', contentType: 'image/gif' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  return null;
}

/** 로컬 이미지 파일 → Notion File Upload (단일 파트, 업로드 완료 상태까지 확인) */
async function uploadLocalImage(absPath) {
  if (!fs.existsSync(absPath)) throw new Error(`이미지 파일 없음: ${absPath}`);
  const buf = fs.readFileSync(absPath);
  const detected = detectImageFormat(buf);
  if (!detected) throw new Error(`이미지 매직바이트 인식 실패(형식 오류 의심): ${absPath}`);
  const extFromName = path.extname(absPath).slice(1).toLowerCase().replace('jpeg', 'jpg');
  if (extFromName && extFromName !== detected.ext && !(extFromName === 'jpg' && detected.ext === 'jpg')) {
    console.warn(`⚠️  확장자(.${extFromName})와 실제 형식(${detected.ext})이 다름: ${absPath} — 실제 형식 기준으로 업로드`);
  }

  const filename = path.basename(absPath, path.extname(absPath)) + '.' + detected.ext;
  const created = await notion('/file_uploads', 'POST', {
    mode: 'single_part',
    filename,
    content_type: detected.contentType,
  });

  let uploadRes;
  for (let attempt = 0; attempt < MAX_NOTION_RETRY; attempt++) {
    const form = new FormData();
    form.append('file', new Blob([buf], { type: detected.contentType }), filename);
    uploadRes = await fetch(created.upload_url, {
      method: 'POST',
      signal: AbortSignal.timeout(FILE_UPLOAD_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${API_KEY}`, 'Notion-Version': NOTION_VERSION },
      body: form,
    });
    if (uploadRes.status === 429 || uploadRes.status >= 500) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    break;
  }
  if (!uploadRes.ok) throw new Error(`업로드 실패 ${uploadRes.status}: ${(await uploadRes.text()).slice(0, 300)}`);

  // 업로드 완료 상태 확인(응답 반영이 지연될 수 있으므로 짧게 폴링)
  let status;
  for (let attempt = 0; attempt < 5; attempt++) {
    status = await notion(`/file_uploads/${created.id}`);
    if (status.status === 'uploaded') break;
    if (status.status === 'failed' || status.status === 'expired') break;
    await sleep(500 * Math.pow(2, attempt));
  }
  if (status?.status !== 'uploaded') {
    throw new Error(`업로드 후 상태가 uploaded가 아님(${status?.status || 'unknown'}): ${absPath}`);
  }

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

async function resolveImages(blocks) {
  const targets = blocks.map((b, i) => (b.__image ? { i, absPath: b.__image, alt: b.alt } : null)).filter(Boolean);
  const failures = [];
  let uploaded = 0;

  await mapLimit(targets, IMAGE_CONCURRENCY, async (t) => {
    for (let attempt = 0; attempt < MAX_IMAGE_RETRY; attempt++) {
      try {
        const fileId = await uploadLocalImage(t.absPath);
        blocks[t.i] = {
          object: 'block', type: 'image',
          image: { type: 'file_upload', file_upload: { id: fileId }, caption: t.alt ? [{ type: 'text', text: { content: t.alt } }] : [] },
        };
        uploaded++;
        return;
      } catch (e) {
        if (attempt === MAX_IMAGE_RETRY - 1) {
          failures.push({ absPath: t.absPath, error: String(e.message || e) });
        } else {
          await sleep(800 * Math.pow(2, attempt));
        }
      }
    }
  });

  return { blocks: blocks.filter((b) => b && b.object === 'block'), found: targets.length, uploaded, failures };
}

function syncedRef(blockId) {
  return { object: 'block', type: 'synced_block', synced_block: { synced_from: { block_id: blockId } } };
}

// ═══════════════════════════════════════════════════════════════
// 기존 페이지 식별 (source_url 최우선 → 체크포인트 page_id → 제목+카테고리)
// ═══════════════════════════════════════════════════════════════

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

function hasImportMarkers(blocks) {
  const expected = new Set([SYNCED_TOP_ID, SYNCED_BOTTOM_ID].map((id) => id.replace(/-/g, '')));
  return blocks.some((b) => {
    const sourceId = b.type === 'synced_block' && b.synced_block?.synced_from?.block_id;
    return sourceId && expected.has(sourceId.replace(/-/g, ''));
  });
}

async function queryBySourceUrl(sourceUrl) {
  const res = await notion(`/data_sources/${DATA_SOURCE_ID}/query`, 'POST', {
    filter: { property: '설명', rich_text: { equals: sourceUrl } },
    page_size: 10,
  });
  return res.results || [];
}

async function queryByTitleCategory(title, category) {
  const res = await notion(`/data_sources/${DATA_SOURCE_ID}/query`, 'POST', {
    filter: {
      and: [
        { property: '제목', title: { equals: title } },
        { property: '카테고리', select: { equals: category } },
      ],
    },
    page_size: 10,
  });
  return res.results || [];
}

/**
 * 반환: { pageId, adopted, isNew } 또는 conflict 시 { conflict: 사유 }
 */
async function identifyPage(post, cp) {
  const key = post.postNo;
  const cpRecord = cp.items[key];

  // 1순위: 체크포인트에 이미 기록된 page_id (신뢰)
  const checkpointPageId = cpRecord?.page_id || cpRecord?.pageId;
  if (checkpointPageId) {
    return { pageId: checkpointPageId, adopted: true, trusted: true };
  }

  // 2순위: 설명 속성의 source_url 완전 일치
  const bySourceUrl = await queryBySourceUrl(post.sourceUrl);
  if (bySourceUrl.length > 1) {
    return { conflict: `source_url 중복 페이지 ${bySourceUrl.length}개: ${post.sourceUrl}` };
  }
  if (bySourceUrl.length === 1) {
    return { pageId: bySourceUrl[0].id, adopted: true, trusted: false };
  }

  // 3순위: 제목+카테고리 완전 일치 (내용이 있으면 우리 표식이 있을 때만 갱신, 없으면 새 페이지 생성)
  const byTitleCategory = await queryByTitleCategory(post.title, post.category);
  if (byTitleCategory.length > 1) {
    return { conflict: `제목+카테고리 중복 페이지 ${byTitleCategory.length}개: ${post.category} / ${post.title}` };
  }
  if (byTitleCategory.length === 1) {
    const candidate = byTitleCategory[0];
    const children = await listAllChildren(candidate.id);
    if (children.length === 0 || hasImportMarkers(children)) {
      return { pageId: candidate.id, adopted: true, trusted: false };
    }
    // 내용이 있는 무관한 기존 페이지 — 중복 생성도 하지 않고 사람이 판별할 conflict로 남긴다.
    return { conflict: `제목+카테고리 일치 페이지에 가져오기 표식이 없어 자동 갱신·중복 생성을 중단함: ${post.category} / ${post.title}` };
  }

  return { pageId: null, adopted: false };
}

async function replacePageContent(pageId, blocks, { trusted } = {}) {
  const oldBlocks = await listAllChildren(pageId);
  if (!trusted && oldBlocks.length > 0 && !hasImportMarkers(oldBlocks)) {
    throw new Error(`기존 페이지에 가져오기 표식이 없어 본문 삭제를 중단함: ${pageId}`);
  }
  for (const b of oldBlocks) {
    await notion(`/blocks/${b.id}`, 'DELETE');
  }
  for (let i = 0; i < blocks.length; i += 100) {
    await notion(`/blocks/${pageId}/children`, 'PATCH', { children: blocks.slice(i, i + 100) });
  }
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
// 글 1개 업로드
// ═══════════════════════════════════════════════════════════════

async function importOne(post, cp) {
  const key = post.postNo;

  const identity = await identifyPage(post, cp);
  if (identity.conflict) {
    cp.conflicts = cp.conflicts || [];
    if (!cp.conflicts.some((c) => c.postNo === key)) {
      cp.conflicts.push({ postNo: key, title: post.title, category: post.category, reason: identity.conflict });
    }
    cp.items[key] = {
      source_post_no: key, source_url: post.sourceUrl, page_id: null, title: post.title,
      category: post.category, order: post.order, images_expected: post.imagesExpected,
      images_uploaded: 0, status: 'conflict', error: identity.conflict, adopted_existing: false,
    };
    saveCheckpoint(cp);
    return cp.items[key];
  }

  // 이전 실행의 conflict가 해소된 경우 최종 검증에 낡은 기록을 남기지 않는다.
  cp.conflicts = (cp.conflicts || []).filter((c) => c.postNo !== key);

  let blocks = bodyToBlocks(post.chunks, post.fileDir);
  const { blocks: resolvedBlocks, found, uploaded, failures } = await resolveImages(blocks);

  if (failures.length > 0) {
    cp.items[key] = {
      source_post_no: key, source_url: post.sourceUrl, page_id: identity.pageId || null, title: post.title,
      category: post.category, order: post.order, images_expected: post.imagesExpected,
      images_uploaded: uploaded, status: 'failed',
      error: `이미지 ${failures.length}개 업로드 실패: ${failures.map((f) => `${f.absPath}: ${f.error}`).join(' | ').slice(0, 500)}`,
      adopted_existing: !!identity.pageId,
    };
    saveCheckpoint(cp);
    return cp.items[key];
  }
  if (found !== post.imagesExpected) {
    console.warn(`⚠️  ${key}: 본문에서 발견한 이미지(${found})와 frontmatter images_expected(${post.imagesExpected})가 다름`);
  }

  const children = [syncedRef(SYNCED_TOP_ID), ...resolvedBlocks, syncedRef(SYNCED_BOTTOM_ID)];
  const properties = {
    '제목': { title: [{ type: 'text', text: { content: post.title } }] },
    '카테고리': { select: { name: post.category } },
    '순서': { number: post.order },
    '상태': { status: { name: '완료' } },
    '설명': { rich_text: [{ type: 'text', text: { content: post.sourceUrl } }] },
  };

  let pageId;
  try {
    if (identity.pageId) {
      pageId = identity.pageId;
      await notion(`/pages/${pageId}`, 'PATCH', { properties });
      await replacePageContent(pageId, children, { trusted: identity.trusted });
    } else {
      const created = await notion('/pages', 'POST', {
        parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID },
        properties,
        children: children.slice(0, 100),
      });
      pageId = created.id;
      for (let i = 100; i < children.length; i += 100) {
        await notion(`/blocks/${pageId}/children`, 'PATCH', { children: children.slice(i, i + 100) });
      }
    }
  } catch (e) {
    cp.items[key] = {
      source_post_no: key, source_url: post.sourceUrl, page_id: identity.pageId || null, title: post.title,
      category: post.category, order: post.order, images_expected: post.imagesExpected,
      images_uploaded: uploaded, status: 'failed', error: String(e.message || e),
      adopted_existing: !!identity.pageId,
    };
    saveCheckpoint(cp);
    return cp.items[key];
  }

  cp.items[key] = {
    source_post_no: key, source_url: post.sourceUrl, page_id: pageId, title: post.title,
    category: post.category, order: post.order, images_expected: post.imagesExpected,
    images_uploaded: uploaded, status: 'complete', error: null, adopted_existing: !!identity.pageId,
  };
  saveCheckpoint(cp);
  return cp.items[key];
}

// ═══════════════════════════════════════════════════════════════
// 검증
// ═══════════════════════════════════════════════════════════════

async function verify(posts, cp) {
  const problems = [];
  const byCategory = {};
  const seenPageIds = new Map();
  const rows = [];

  for (const post of posts) {
    const rec = cp.items[post.postNo];
    if (!rec || rec.status !== 'complete') {
      problems.push(`미완료: ${post.postNo} ${post.title} (status=${rec?.status || '없음'})`);
      continue;
    }
    byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
    if (seenPageIds.has(rec.page_id)) problems.push(`중복 page_id: ${rec.page_id} (${post.postNo}, ${seenPageIds.get(rec.page_id)})`);
    seenPageIds.set(rec.page_id, post.postNo);

    const page = await notion(`/pages/${rec.page_id}`);
    const actualTitle = page.properties?.['제목']?.title?.map((x) => x.plain_text).join('') || '';
    const actualOrder = page.properties?.['순서']?.number;
    const actualStatus = page.properties?.['상태']?.status?.name;
    const actualDesc = page.properties?.['설명']?.rich_text?.map((x) => x.plain_text).join('') || '';

    if (actualTitle !== rec.title) problems.push(`제목 불일치: ${rec.page_id} "${actualTitle}" ≠ "${rec.title}"`);
    if (actualOrder !== rec.order) problems.push(`순서 불일치: ${rec.page_id} ${actualOrder} ≠ ${rec.order}`);
    if (actualStatus !== '완료') problems.push(`상태가 완료가 아님: ${rec.page_id} (${actualStatus})`);
    if (actualDesc !== rec.source_url) problems.push(`설명(source_url) 불일치: ${rec.page_id}`);

    const list = await listAllChildren(rec.page_id);
    const syncedFrom = list
      .filter((b) => b.type === 'synced_block' && b.synced_block?.synced_from?.block_id)
      .map((b) => b.synced_block.synced_from.block_id.replace(/-/g, ''));
    const top = syncedFrom.filter((id) => id === SYNCED_TOP_ID.replace(/-/g, '')).length;
    const bottom = syncedFrom.filter((id) => id === SYNCED_BOTTOM_ID.replace(/-/g, '')).length;
    if (top !== 1) problems.push(`상단 동기화 참조 ${top}개: ${rec.page_id}`);
    if (bottom !== 1) problems.push(`하단 동기화 참조 ${bottom}개: ${rec.page_id}`);

    const imageBlocks = list.filter((b) => b.type === 'image');
    if (imageBlocks.length !== rec.images_uploaded) {
      problems.push(`이미지 수 불일치: ${rec.page_id} 페이지 ${imageBlocks.length} ≠ 업로드 기록 ${rec.images_uploaded}`);
    }
    const externalDc = imageBlocks.some((b) => /dcinside/i.test(b.image?.external?.url || ''));
    if (externalDc) problems.push(`DCInside 임시 URL 잔존: ${rec.page_id}`);

    const bodyText = list
      .filter((b) => b.type === 'paragraph')
      .map((b) => (b.paragraph.rich_text || []).map((r) => r.plain_text).join(''))
      .join(' ');
    if (/NOTION_SYNCED_(TOP|BOTTOM)/.test(bodyText)) problems.push(`본문에 NOTION_SYNCED 주석 문자열 잔존: ${rec.page_id}`);

    rows.push({ postNo: post.postNo, title: rec.title, category: rec.category, order: rec.order, pageId: rec.page_id, url: `https://www.notion.so/${rec.page_id.replace(/-/g, '')}`, imagesUploaded: rec.images_uploaded });
  }

  for (const [cat, want] of Object.entries(EXPECTED_COUNTS)) {
    if (cat === 'total') continue;
    const got = byCategory[cat] || 0;
    if (got !== want) problems.push(`카테고리 개수 불일치: ${cat} ${got} ≠ ${want}`);
  }
  if (posts.length !== EXPECTED_COUNTS.total) problems.push(`대상 글 수 불일치: ${posts.length} ≠ ${EXPECTED_COUNTS.total}`);

  // 3658은 어떤 경우에도 페이지가 생기면 안 됨
  const post3658 = await queryBySourceUrl('https://m.dcinside.com/board/digitalpiano/3658');
  if (post3658.length > 0) problems.push('3658번 글에 대한 Notion 페이지가 존재함 — 생성되면 안 됨');

  if ((cp.conflicts || []).length > 0) {
    problems.push(`미해결 conflicts ${cp.conflicts.length}건: ${cp.conflicts.map((c) => c.postNo).join(', ')}`);
  }

  return { problems, byCategory, rows };
}

// ═══════════════════════════════════════════════════════════════
// 보고서
// ═══════════════════════════════════════════════════════════════

function writeReport(posts, cp, verifyResult) {
  const items = Object.values(cp.items);
  const complete = items.filter((i) => i.status === 'complete');
  const failed = items.filter((i) => i.status === 'failed');
  const conflictItems = items.filter((i) => i.status === 'conflict');
  const uniquePageIds = new Set(complete.map((i) => i.page_id).filter(Boolean));
  const imagesUploaded = items.reduce((sum, i) => sum + (i.images_uploaded || 0), 0);

  const byCategory = {};
  for (const i of complete) byCategory[i.category] = (byCategory[i.category] || 0) + 1;

  const lines = [];
  lines.push('# Notion 업로드 보고서');
  lines.push('');
  lines.push(`생성 시각: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## 1. 요약');
  lines.push('');
  lines.push('| 항목 | 값 |');
  lines.push('| --- | --- |');
  lines.push(`| 대상 글 | ${posts.length}개 |`);
  lines.push(`| 성공(complete) | ${complete.length}개 |`);
  lines.push(`| 실패(failed) | ${failed.length}개 |`);
  lines.push(`| conflicts | ${conflictItems.length}개 |`);
  lines.push(`| 고유 Notion 페이지 | ${uniquePageIds.size}개 |`);
  lines.push(`| 이미지 업로드 성공 | ${imagesUploaded}개 (기대 271개) |`);
  lines.push('');
  lines.push('## 2. 카테고리별 성공 수');
  lines.push('');
  lines.push('| 카테고리 | 성공 | 기대 |');
  lines.push('| --- | --- | --- |');
  for (const cat of CATEGORIES) lines.push(`| ${cat} | ${byCategory[cat] || 0} | ${EXPECTED_COUNTS[cat]} |`);
  lines.push('');
  lines.push('## 3. 실패 항목');
  lines.push('');
  if (failed.length === 0) {
    lines.push('없음.');
  } else {
    lines.push('| 글 번호 | 제목 | 오류 |');
    lines.push('| --- | --- | --- |');
    for (const f of failed) lines.push(`| ${f.source_post_no} | ${f.title} | ${(f.error || '').replace(/\|/g, '\\|').slice(0, 200)} |`);
  }
  lines.push('');
  lines.push('## 4. Conflicts');
  lines.push('');
  if ((cp.conflicts || []).length === 0) {
    lines.push('없음.');
  } else {
    lines.push('| 글 번호 | 제목 | 사유 |');
    lines.push('| --- | --- | --- |');
    for (const c of cp.conflicts) lines.push(`| ${c.postNo} | ${c.title} | ${c.reason} |`);
  }
  lines.push('');
  lines.push('## 5. 전체 페이지 목록 (page_id / URL)');
  lines.push('');
  lines.push('| 글 번호 | 카테고리 | 순서 | 제목 | page_id | URL |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const i of complete.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order)) {
    lines.push(`| ${i.source_post_no} | ${i.category} | ${i.order} | ${i.title} | ${i.page_id} | https://www.notion.so/${String(i.page_id).replace(/-/g, '')} |`);
  }
  lines.push('');
  lines.push('## 6. 최종 검증 결과');
  lines.push('');
  if (!verifyResult) {
    lines.push('검증을 아직 실행하지 않음(`--verify` 또는 `--all` 실행 필요).');
  } else if (verifyResult.problems.length === 0) {
    lines.push('**모든 검증 항목 통과.**');
  } else {
    lines.push(`**검증 실패 ${verifyResult.problems.length}건:**`);
    lines.push('');
    for (const p of verifyResult.problems) lines.push(`- ${p}`);
  }
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`\n💾 보고서 저장: ${REPORT_PATH}`);
}

// ═══════════════════════════════════════════════════════════════
// 실행
// ═══════════════════════════════════════════════════════════════

async function runUpload(posts, cp, targetPosts) {
  console.log(`\n📝 처리 대상 ${targetPosts.length}개`);
  for (const [idx, post] of targetPosts.entries()) {
    const rec = await importOne(post, cp);
    const mark = rec.status === 'complete' ? '✅' : rec.status === 'conflict' ? '⚠️  conflict' : '❌';
    console.log(`  [${idx + 1}/${targetPosts.length}] ${mark} ${post.postNo} ${post.title} (이미지 ${rec.images_uploaded}/${post.imagesExpected})`);
  }
}

async function main() {
  if (!API_KEY) {
    console.error('❌ NOTION_API_KEY가 없음 (.env 확인)');
    process.exit(1);
  }
  if (!MODE) {
    console.error('사용법: node scripts/upload-piano-history-to-notion.js --test [--post=1910] | --all | --refresh=1910,2007 | --verify');
    process.exit(1);
  }

  const posts = loadPosts();
  console.log(`📂 로컬 Markdown ${posts.length}개 적재 (기대 ${EXPECTED_COUNTS.total}개)`);
  if (fs.existsSync(TEMPLATES_PATH)) {
    console.log(`📄 템플릿 기록: ${TEMPLATES_PATH} (참고용 — 실제 페이지는 상단/본문/하단을 직접 구성함)`);
  } else {
    console.warn(`⚠️  ${TEMPLATES_PATH} 없음 — 템플릿은 브라우저 UI에서 별도로 만들어야 함(이 스크립트는 페이지 구조를 직접 구성하므로 실행에는 영향 없음)`);
  }

  const cp = loadCheckpoint();

  if (MODE === 'test') {
    const candidate = POST_ARG
      ? posts.find((p) => p.postNo === POST_ARG && p.imagesExpected > 0)
      : posts.find((p) => p.imagesExpected > 0 && cp.items[p.postNo]?.status !== 'complete')
        || posts.find((p) => p.imagesExpected > 0);
    if (!candidate) {
      console.error(`❌ 이미지가 있는 시험 대상 글을 찾지 못함${POST_ARG ? `: ${POST_ARG}` : ''}`);
      process.exit(1);
    }
    await runUpload(posts, cp, [candidate]);
    console.log('\n시험 업로드 완료. 아래 조건을 Notion에서 직접 확인할 것:');
    console.log('  - 제목 / 카테고리 / 순서 / 상태(완료) / 설명(source_url)');
    console.log('  - 상단 동기화 참조 정확히 1개, 하단 정확히 1개');
    console.log('  - 본문 문단 순서가 Markdown과 일치, 이미지 수·위치 일치');
    console.log('  - 외부 DCInside 이미지 URL이 전혀 없음');
    console.log('통과하면 --all 로 전체 업로드를 진행할 것.');
    return;
  }

  if (MODE === 'all') {
    const pending = posts.filter((p) => cp.items[p.postNo]?.status !== 'complete');
    await runUpload(posts, cp, pending);

    const stillFailed = posts.filter((p) => cp.items[p.postNo]?.status === 'failed');
    if (stillFailed.length > 0) {
      console.log(`\n♻️  실패 ${stillFailed.length}개 1회 재시도`);
      await runUpload(posts, cp, stillFailed);
    }
  }

  if (MODE === 'refresh') {
    const requested = new Set(REFRESH_POSTS);
    const targets = posts.filter((post) => requested.has(post.postNo));
    const missing = [...requested].filter((postNo) => !targets.some((post) => post.postNo === postNo));
    if (requested.size === 0 || missing.length > 0) {
      throw new Error(`재동기화 대상이 잘못됨: ${missing.length > 0 ? missing.join(', ') : '빈 목록'}`);
    }
    await runUpload(posts, cp, targets);

    const failed = targets.filter((post) => cp.items[post.postNo]?.status === 'failed');
    if (failed.length > 0) {
      console.log(`\n♻️  재동기화 실패 ${failed.length}개 1회 재시도`);
      await runUpload(posts, cp, failed);
    }
  }

  // --all, --verify 공통: 검증 + 보고서
  const verifyResult = await verify(posts, cp);
  writeReport(posts, cp, verifyResult);

  console.log('\n══════════ 최종 보고 ══════════');
  const items = Object.values(cp.items);
  console.log(`complete ${items.filter((i) => i.status === 'complete').length} / failed ${items.filter((i) => i.status === 'failed').length} / conflict ${items.filter((i) => i.status === 'conflict').length} (전체 ${posts.length})`);
  if (verifyResult.problems.length === 0) {
    console.log('✅ 검증 통과');
  } else {
    console.log(`❌ 검증 실패 ${verifyResult.problems.length}건:`);
    for (const p of verifyResult.problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((e) => {
    console.error('치명적 오류:', e);
    process.exit(1);
  });
}
