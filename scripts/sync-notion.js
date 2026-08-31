import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { slug as githubSlug } from 'github-slugger';
import { syncPianoDB } from './sync-pianos.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const API_KEY = process.env.NOTION_API_KEY;
const DOCS_PATH = path.join(__dirname, '..', 'src', 'content', 'docs');
const IMAGES_PATH = path.join(__dirname, '..', 'public', 'images');
const REPAIR_GENERATED_DOCS_ONLY = process.argv.includes('--repair-generated-docs-only');
const REWRITE_INTERNAL_LINKS_ONLY = process.argv.includes('--rewrite-internal-links-only');
const SYNC_CATEGORY = process.env.SYNC_CATEGORY?.trim().normalize('NFC') || null;
const SYNC_CATEGORIES = process.env.SYNC_CATEGORIES_FILE
  ? new Set(JSON.parse(fs.readFileSync(process.env.SYNC_CATEGORIES_FILE, 'utf8')).map((category) => category.trim().normalize('NFC')))
  : null;
const PURCHASE_GUIDE_PATH = ['디지털 피아노', '디지털 피아노 구매 · 추천 가이드'];
const MT21_CATEGORY_FOLDERS = new Map([
  ['01장. 기본 개념', '01장. 기본 개념'],
  ['02장. 장음계와 조표', '02장. 장음계와 조표'],
  ['03장. 단음계와 조표', '03장. 단음계와 조표'],
  ['04장. 리듬의 기초', '04장. 리듬의 기초'],
  ['05장. 음정', '05장. 음정'],
  ['06장. 셋온음', '06장. 삼화음'],
  ['06장. 삼화음', '06장. 삼화음'],
  ['07장. 로마 숫자와 케이던스', '07장. 로마 숫자와 케이던스'],
  ['08장. 세븐스 코드', '08장. 7화음'],
  ['09장. 화성 진행과 화성 기능', '09장. 화성 진행과 화성 기능'],
  ['10장. 비화성음', '10장. 비화성음'],
  ['11장. 선율 분석', '11장. 선율 분석'],
  ['12장. 대중음악의 형식', '12장. 대중음악의 형식'],
  ['13장. 프레이즈의 결합', '13장. 악구의 결합'],
  ['14장. 반주 텍스처', '14장. 반주 텍스처'],
  ['15장. 섹션 간 대비 만들기', '15장. 섹션 간 대비 만들기'],
  ['16장. 피겨드 베이스', '16장. 통주저음'],
  ['17장. 세컨더리 도미넌트 코드', '17장. 세컨더리 도미넌트 화음'],
  ['18장. 세컨더리 디미니시드 코드', '18장. 세컨더리 디미니시드 화음'],
  ['19장. 모드 믹스처', '19장. 장단조 병용'],
  ['20장. 나폴리 화음', '20장. 나폴리 화음'],
  ['21장. 증6화음', '21장. 증6화음'],
  ['22장. 전조', '22장. 전조'],
  ['23장. 이명동음 전조', '23장. 이명동음 전조'],
  ['24장. 2부분 형식과 3부분 형식', '24장. 2부분 형식과 3부분 형식'],
  ['25장. 소나타와 론도 형식', '25장. 소나타와 론도 형식'],
  ['26장. 삼화음의 성부 진행', '26장. 삼화음의 성부 진행'],
  ['27장. 7화음의 성부 진행', '27장. 7화음의 성부 진행'],
  ['28장. 비화성음을 포함한 성부 진행', '28장. 비화성음을 포함한 성부 진행'],
  ['29장. 반음계적 화성의 성부 진행', '29장. 반음계적 화성의 성부 진행'],
  ['30장. 대위법 입문', '30장. 대위법 입문'],
  ['31장. 재즈 이론 입문', '31장. 재즈 이론 입문'],
  ['32장. 인상주의와 확장된 조성', '32장. 인상주의와 확장된 조성'],
  ['33장. 집합 이론', '33장. 집합이론'],
  ['34장. 음렬주의', '34장. 음렬주의'],
  ['35장. 미니멀리즘', '35장. 미니멀리즘'],
]);
const CATEGORY_PATHS = new Map([
  ['연결 및 홈 스튜디오 구성', ['디지털 피아노', '디지털 피아노 연결흐름과 개념']],
  ['ASIO4ALL 가이드', ['디지털 피아노', '디지털 피아노 연결흐름과 개념', 'ASIO4ALL 가이드']],
  ['1. 디지털 피아노와 그랜드 피아노', [...PURCHASE_GUIDE_PATH, '1. 디지털 피아노와 그랜드 피아노']],
  ['2. 디지털 피아노와 키보드', [...PURCHASE_GUIDE_PATH, '2. 디지털 피아노와 키보드']],
  ['3. 디지털 피아노의 형태', [...PURCHASE_GUIDE_PATH, '3. 디지털 피아노의 형태']],
  ['4. 타건감과 음원 외 디지털 피아노 선택 요소', [...PURCHASE_GUIDE_PATH, '4. 타건감과 음원 외 디지털 피아노 선택 요소']],
  ['5. 브랜드별 스펙 및 리뷰', [...PURCHASE_GUIDE_PATH, '5. 브랜드별 스펙 및 리뷰']],
  ['4. 팔과 손의 구조 인식', ['피아노 연습', '내 몸 사용 설명서', '4. 팔과 손의 구조']],
  ...[...MT21_CATEGORY_FOLDERS].map(([category, folder]) => [
    category,
    ['음악 이론', '21세기 음악이론 한글판', folder],
  ]),
  ['01. 기초편', ['음악 이론', 'Open Music Theory', '01. 기초편']],
  ['02.대위법과 갈랑 양식', ['음악 이론', 'Open Music Theory', '02.대위법과 갈랑 양식']],
  ['03.형식', ['음악 이론', 'Open Music Theory', '03.형식']],
  ['04. 온음계 화성과 프레이즈 모델', ['음악 이론', 'Open Music Theory', '04. 온음계 화성과 프레이즈 모델']],
  ['05. 반음계 화성', ['음악 이론', 'Open Music Theory', '05. 반음계 화성']],
  ['06. 재즈 이론', ['음악 이론', 'Open Music Theory', '06. 재즈 이론']],
  ['바로크, 고전', ['음악 이야기', '피아노 음악사', '바로크, 고전']],
  ['바로크·고전', ['음악 이야기', '피아노 음악사', '바로크, 고전']],
  ['낭만, 그 이후', ['음악 이야기', '피아노 음악사', '낭만, 그 이후']],
  ['낭만·그 이후', ['음악 이야기', '피아노 음악사', '낭만, 그 이후']],
  ['작곡가 이야기', ['음악 이야기', '피아노 음악사', '작곡가 이야기']],
]);
let notionPageRouteMap = new Map();
let notionPageOrderMap = new Map();
let notionTitleOrderMap = new Map();
const TITLE_ORDER_OVERRIDES = new Map([
  ['카시오 PX-S1100 디지털 피아노', 2],
  ['카시오 PX-S3100 디지털 피아노', 3],
  ['카시오 PX-S5000 디지털 피아노', 4],
  ['카시오 PX-S6000 디지털 피아노', 5],
  ['카시오 PX-S7000 디지털 피아노', 6],
  ['카시오 AP-S200 / AP-300 디지털 피아노', 7],
  ['카시오 AP-S450 / 550 디지털 피아노', 8],
  ['카시오 AP-750 디지털 피아노', 9],
  ['카시오 GP-310 디지털 피아노', 10],
  ['카시오 GP-510 디지털 피아노', 11],
  ['가와이 ES60 디지털 피아노', 2],
  ['가와이 ES120 디지털 피아노', 3],
  ['가와이 ES520 디지털 피아노', 4],
  ['가와이 CX102, 202, 302 디지털 피아노', 5],
  ['가와이 CN201, CN301 디지털 피아노', 6],
  ['가와이 CA401/501 디지털 피아노', 7],
  ['가와이 CA701 디지털 피아노', 8],
  ['롤랜드 FP-10 디지털 피아노', 2],
  ['롤랜드 FP-30X 디지털 피아노', 3],
  ['롤랜드 FP-60X 디지털 피아노', 4],
  ['롤랜드 FP-90X 디지털 피아노', 5],
  ['F701/RP701 디지털 피아노', 6],
  ['롤랜드 HP702 / HP704 디지털 피아노', 7],
  ['롤랜드 LX5 디지털 피아노', 8],
  ['롤랜드 LX6 디지털 피아노', 9],
  ['롤랜드 LX9 디지털 피아노', 10],
  ['야마하 P-145 디지털 피아노', 2],
  ['야마하 P-225 디지털 피아노', 3],
  ['야마하 P-525 디지털 피아노', 4],
  ['야마하 YDP 145 / S35 디지털 피아노', 5],
  ['야마하 YDP-165, YDP-S55 디지털 피아노', 6],
  ['야마하 CLP-825,835,845 디지털 피아노', 7],
  ['야마하 CLP-875, 885 디지털 피아노', 8],
  ['야마하 NU1XA 하이브리드 디지털 피아노', 9],
  ['야마하 N1X 하이브리드 디지털 피아노', 10],
  ['야마하 N3x 하이브리드 디지털 피아노', 11],
  ['E2x2 OTG 한글 매뉴얼', 2],
  ['TOPPING Control Center 한글 매뉴얼', 3],
  ['i. 화음과 화성', 2],
  ['v. 장조와 단조의 3화음', 6],
  ['vi. 주요 3화음과 부 3화음', 7],
].map(([title, order]) => [normalizeTitleKey(title), order]));
const LEGACY_NOTION_ROUTE_OVERRIDES = new Map([
  ['3b326dfbcd798113a15af80548c1cb66', '/음악-이론/open-music-theory/01-기초편/15-음정/'],
  ['3b326dfbcd79811c8e09decb0de56c39', '/음악-이론/open-music-theory/01-기초편/20-통주저음/'],
  ['3b426dfbcd79816d8ae5d7615b7a4785', '/음악-이론/21세기-음악이론-한글판/29장-반음계적-화성의-성부-진행/292-차용화음의-성부-진행/'],
]);
const EXCLUDED_NOTION_PAGE_IDS = new Set([
  // 사이트에서 제거한 가와이 라인업 인덱스 페이지
  '35e26dfb-cd79-80dc-b0ad-c09ee5223f7d',
]);
const EXCLUDED_NOTION_PAGE_TITLES = new Set([
  '내 몸 사용 설명서',
  '내몸 사용 설명서',
  'ToppingPro V1.6_페이지_15_이미지_0003',
  'ToppingPro V1.6_페이지_15_이미지_0003',
]);



// ⚠️ [참고] 아래 맵들은 이제 직접 사용되지 않지만, 
// CSS 파일(global.css)을 작성할 때 색상 참고용으로 남겨둡니다.

// annotations.color 값 → 글자색
const TEXT_COLOR_MAP = {
  gray:   'rgba(125, 122, 117, 1)',
  brown:  'rgba(159, 118, 90, 1)',
  orange: 'rgba(210, 123, 45, 1)',
  yellow: 'rgba(203, 148, 52, 1)',
  teal:   'rgba(80, 148, 110, 1)',
  blue:   'rgba(56, 125, 201, 1)',
  purple: 'rgba(154, 107, 180, 1)',
  pink:   'rgba(193, 76, 138, 1)',
  red:    'rgba(207, 81, 72, 1)',
};

// annotations.color 값 → 백그라운드 하이라이트
const HIGHLIGHT_BG_MAP = {
  gray:   'rgba(240, 239, 237, 1)',
  brown:  'rgba(245, 237, 233, 1)',
  orange: 'rgba(251, 235, 222, 1)',
  yellow: 'rgba(249, 243, 220, 1)',
  teal:   'rgba(232, 241, 236, 1)',
  blue:   'rgba(229, 242, 252, 1)',
  purple: 'rgba(243, 235, 249, 1)',
  pink:   'rgba(250, 233, 241, 1)',
  red:    'rgba(252, 233, 231, 1)',
};

// callout 블럭의 color 속성 → 배경색
const CALLOUT_BG_MAP = {
  default_background:  'rgba(240, 239, 237, 1)',
  gray_background:     'rgba(240, 239, 237, 1)',
  brown_background:    'rgba(245, 237, 233, 1)',
  orange_background:   'rgba(251, 235, 222, 1)',
  yellow_background:   'rgba(249, 243, 220, 1)',
  teal_background:     'rgba(232, 241, 236, 1)',
  blue_background:     'rgba(229, 242, 252, 1)',
  purple_background:   'rgba(243, 235, 249, 1)',
  pink_background:     'rgba(250, 233, 241, 1)',
  red_background:      'rgba(252, 233, 231, 1)',
};


// ═══════════════════════════════════════════════════════════════
// 1. 폴더 찾기 (맥 NFD 자모 분리 문제 해결)
// ═══════════════════════════════════════════════════════════════

function findFolderPath(startPath, targetFolderName) {
  if (!fs.existsSync(startPath)) return null;
  const files = fs.readdirSync(startPath, { withFileTypes: true });
  
  // 타겟(노션 카테고리) 이름을 NFC(합친 글자)로 통일
  const targetNormalized = targetFolderName.normalize('NFC');

  for (const file of files) {
    if (file.isDirectory()) {
      // 파일(폴더) 이름을 NFC로 변환해서 비교
      const fileNameNormalized = file.name.normalize('NFC');

      if (fileNameNormalized === targetNormalized) {
        return path.join(startPath, file.name);
      }
      
      // 제외할 폴더들
      if (['node_modules', '.git', 'public', '.astro', 'scripts'].includes(file.name)) continue;
      
      const foundPath = findFolderPath(path.join(startPath, file.name), targetFolderName);
      if (foundPath) return foundPath;
    }
  }
  return null;
}

function findCategoryFolder(category) {
  const pathSegments = CATEGORY_PATHS.get(category.normalize('NFC'));
  if (!pathSegments) return findFolderPath(DOCS_PATH, category);

  let currentPath = DOCS_PATH;
  for (const segment of pathSegments) {
    if (!fs.existsSync(currentPath)) return null;
    const normalizedSegment = segment.normalize('NFC');
    const child = fs.readdirSync(currentPath, { withFileTypes: true })
      .find((entry) => entry.isDirectory()
        && entry.name.normalize('NFC') === normalizedSegment);
    if (child) {
      currentPath = path.join(currentPath, child.name);
      continue;
    }

    // 명시적으로 경로를 지정한 새 Notion 카테고리는 첫 동기화 때
    // 아직 Astro 폴더가 없어도 건너뛰지 않고 생성한다.
    currentPath = path.join(currentPath, segment);
    fs.mkdirSync(currentPath, { recursive: true });
  }
  return currentPath;
}

function normalizeNotionId(id) {
  return String(id || '').replace(/-/g, '').toLowerCase();
}

function routeForDocumentPath(documentPath) {
  const relativePath = path.relative(DOCS_PATH, documentPath).replace(/\.mdx?$/i, '');
  const routeSegments = relativePath
    .split(path.sep)
    .map((segment) => githubSlug(segment.normalize('NFC')))
    .filter(Boolean);
  return `/${routeSegments.join('/')}/`;
}

function collectDocumentPaths(directoryPath, output = []) {
  if (!fs.existsSync(directoryPath)) return output;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) collectDocumentPaths(entryPath, output);
    else if (/\.mdx?$/i.test(entry.name)) output.push(entryPath);
  }
  return output;
}

function pageOrder(page, title) {
  const storedOrder = page.properties['순서']?.number;
  if (storedOrder !== undefined && storedOrder !== null && storedOrder < 9999) {
    return storedOrder;
  }

  const override = TITLE_ORDER_OVERRIDES.get(normalizeTitleKey(title));
  if (override !== undefined) return override;

  const numberMatch = title.trim().match(/^(\d+)(?:\.(\d+))?/);
  if (!numberMatch) return 9999;
  const localNumber = Number(numberMatch[2] || numberMatch[1]);
  return Number.isFinite(localNumber) ? localNumber + 1 : 9999;
}

function normalizeTitleKey(title) {
  return String(title || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function getStoredTitle(contents) {
  const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;
  const titleMatch = frontmatterMatch[1].match(/(?:^|\n)title:\s*["']?([^"'\n]+)["']?/);
  return titleMatch ? titleMatch[1].trim() : null;
}

function buildNotionPageMaps(allPages) {
  const routeMap = new Map();
  const orderMap = new Map();
  const titleOrderMap = new Map();
  const titleRouteMap = new Map();

  for (const documentPath of collectDocumentPaths(DOCS_PATH)) {
    const contents = readFileSafe(documentPath);
    const pageId = getStoredNotionPageId(contents);
    const title = getStoredTitle(contents);
    if (title) titleRouteMap.set(normalizeTitleKey(title), routeForDocumentPath(documentPath));
    if (pageId) routeMap.set(normalizeNotionId(pageId), routeForDocumentPath(documentPath));
  }

  for (const page of allPages) {
    const pageId = normalizeNotionId(page.id);
    const title = page.properties['제목']?.title?.map((text) => text.plain_text).join('') || '';
    const category = page.properties['카테고리']?.select?.name;
    if (!title) continue;

    const order = pageOrder(page, title);
    orderMap.set(pageId, order);
    titleOrderMap.set(normalizeTitleKey(title), order);
    if (routeMap.has(pageId)) continue;

    const existingTitleRoute = titleRouteMap.get(normalizeTitleKey(title));
    if (existingTitleRoute) {
      routeMap.set(pageId, existingTitleRoute);
      continue;
    }
    if (!category) continue;

    const categoryFolder = findCategoryFolder(category);
    if (!categoryFolder) continue;
    const documentPath = path.join(categoryFolder, `${sanitizeName(title)}.md`);
    routeMap.set(pageId, routeForDocumentPath(documentPath));
  }

  return { routeMap, orderMap, titleOrderMap };
}

function internalRouteForNotionHref(href) {
  try {
    const url = new URL(href);
    if (!/(^|\.)notion\.(?:com|so)$/i.test(url.hostname)) return null;
    const matches = url.pathname.match(/[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi);
    if (!matches?.length) return null;
    const pageId = normalizeNotionId(matches.at(-1));
    return notionPageRouteMap.get(pageId) || LEGACY_NOTION_ROUTE_OVERRIDES.get(pageId) || null;
  } catch {
    return null;
  }
}

function isNotionHref(href) {
  try {
    return /(^|\.)notion\.(?:com|so)$/i.test(new URL(href).hostname);
  } catch {
    return false;
  }
}

function repairGeneratedDocuments({ rewriteOrders = true } = {}) {
  let changedDocuments = 0;
  let rewrittenLinks = 0;
  let rewrittenOrders = 0;

  for (const documentPath of collectDocumentPaths(DOCS_PATH)) {
    const original = fs.readFileSync(documentPath, 'utf8');
    let markdown = original.replace(
      /<a\s+href="(https:\/\/[^"\s]*notion\.(?:com|so)[^"\s]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (match, href, label) => {
        const route = internalRouteForNotionHref(href);
        if (!route) return label;
        rewrittenLinks++;
        return `<a href="${route}" style="color: inherit; text-decoration: underline;">${label}</a>`;
      },
    );

    markdown = markdown.replace(
      /https:\/\/[^\s)"'>]*notion\.(?:com|so)[^\s)"'>]*/gi,
      (href) => {
        const route = internalRouteForNotionHref(href);
        if (!route) return href;
        rewrittenLinks++;
        return route;
      },
    );

    if (rewriteOrders) {
      const pageId = normalizeNotionId(getStoredNotionPageId(markdown));
      const title = getStoredTitle(markdown) || path.basename(documentPath, path.extname(documentPath));
      let order = notionPageOrderMap.get(pageId) ?? notionTitleOrderMap.get(normalizeTitleKey(title));
      if (order === undefined || order >= 9999) {
        const numberMatch = title.match(/^(?:레슨\s*)?(\d+)(?:\.(\d+))?/i);
        if (numberMatch) order = Number(numberMatch[2] || numberMatch[1]) + 1;
      }
      if (order !== undefined && order < 9999) {
        markdown = markdown.replace(
          /(sidebar:\s*\n\s*order:\s*)[^\n]+/,
          (match, prefix) => {
            if (match === `${prefix}${order}`) return match;
            rewrittenOrders++;
            return `${prefix}${order}`;
          },
        );
      }
    }

    if (markdown !== original) {
      fs.writeFileSync(documentPath, markdown, 'utf8');
      changedDocuments++;
    }
  }

  console.log(`🧭 생성 문서 ${changedDocuments}개 복구: 내부 링크 ${rewrittenLinks}개, 순서 ${rewrittenOrders}개`);
}


// ═══════════════════════════════════════════════════════════════
// 2. Notion API 호출
// ═══════════════════════════════════════════════════════════════

async function fetchNotion(endpoint, method = 'GET', body = null) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
      });
      if (response.ok) return response.json();
      if (response.status === 404) return { results: [], status: 404 };

      const err = (await response.text()).slice(0, 500);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`API 오류 (${response.status}): ${err}`);
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * (2 ** (attempt - 1));
      console.warn(`      ⚠️  Notion API ${response.status}, ${delay}ms 뒤 재시도 (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      const isApiError = /^API 오류/.test(error.message || '');
      if (isApiError || attempt === maxAttempts) throw error;
      const delay = 500 * (2 ** (attempt - 1));
      console.warn(`      ⚠️  Notion 네트워크 오류, ${delay}ms 뒤 재시도 (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Notion API 재시도 소진: ${method} ${endpoint}`);
}


// ═══════════════════════════════════════════════════════════════
// 3. 단일 블럭 조회 (synced_block 원본 복원용)
// ═══════════════════════════════════════════════════════════════

async function fetchSingleBlock(blockId) {
  const response = await fetchNotion(`/blocks/${blockId}`, 'GET');
  if (response.status === 404) return null;
  return response;
}


// ═══════════════════════════════════════════════════════════════
// 4. 동기화 블럭 재귀 조회
// ═══════════════════════════════════════════════════════════════

async function fetchAllChildren(blockId, depth = 0) {
  let allResults = [];
  let cursor = undefined;
  if (depth > 5) return [];

  do {
    const endpoint = `/blocks/${blockId}/children` + (cursor ? `?start_cursor=${cursor}` : "");
    const response = await fetchNotion(endpoint, 'GET');

    if (response.status === 404) {
      console.log(`      🚫 [접근 불가] 블럭(${blockId}) 권한 없음.`);
      return [];
    }
    if (!response.results) break;

    for (const block of response.results) {
      if (block.type === 'synced_block') {
        const syncedFrom = block.synced_block.synced_from;
        if (syncedFrom && syncedFrom.block_id) {
          const originalBlock = await fetchSingleBlock(syncedFrom.block_id);
          if (originalBlock && originalBlock.type !== 'synced_block') {
            if (originalBlock.has_children) {
              originalBlock.children_content = await fetchAllChildren(originalBlock.id, depth + 1);
            }
            allResults.push(originalBlock);
          } else {
            const children = await fetchAllChildren(syncedFrom.block_id, depth + 1);
            allResults.push(...children);
          }
        } else {
          const children = await fetchAllChildren(block.id, depth + 1);
          allResults.push(...children);
        }
        continue;
      }

      if (block.has_children) {
        block.children_content = await fetchAllChildren(block.id, depth + 1);
      }
      allResults.push(block);
    }
    cursor = response.next_cursor;
  } while (cursor);

  return allResults;
}


// ═══════════════════════════════════════════════════════════════
// 5. MuseScore 높이 조회
// ═══════════════════════════════════════════════════════════════

async function getMusescoreHeight(url) {
  return 394;
}

function getParagraphPlainText(block) {
  if (!block || block.type !== 'paragraph') return '';
  return (block.paragraph?.rich_text || [])
    .map((item) => item.plain_text || '')
    .join('')
    .trim();
}

function getBookmarkUrl(block) {
  return block?.type === 'bookmark' ? block.bookmark?.url || '' : '';
}

function getAudioUrlFromParagraph(block) {
  if (!block || block.type !== 'paragraph') return null;

  const richText = block.paragraph?.rich_text || [];
  if (richText.length !== 1) return null;

  const item = richText[0];
  const candidate =
    item?.href ||
    item?.text?.link?.url ||
    item?.plain_text ||
    '';

  if (!candidate) return null;

  return /\.mp3(?:$|[?#])/i.test(candidate.trim()) ? candidate.trim() : null;
}

function renderAudioPlayerMdx(audioUrl, title = '') {
  const titleProp = title ? ` title={${JSON.stringify(title)}}` : '';
  return `\n\n<AudioPlayer src={${JSON.stringify(audioUrl)}}${titleProp} />\n\n`;
}

function findSourceBookmarkUrl(blocks) {
  const supportedPatterns = [
    /https?:\/\/viva\.pressbooks\.pub\/openmusictheory\/chapter\//i,
  ];

  for (let i = blocks.length - 1; i >= 0; i--) {
    const url = getBookmarkUrl(blocks[i]);
    if (url && supportedPatterns.some((pattern) => pattern.test(url))) {
      return url;
    }
  }

  return null;
}

function normalizeMusescoreUrl(rawUrl) {
  if (!rawUrl || !rawUrl.includes('musescore.com')) return null;

  const match = rawUrl.match(/(musescore\.com\/user\/\d+\/scores\/\d+(\/s\/[\w-]+)?)/);
  if (!match) return null;

  const canonicalPath = match[0];
  const scoreIdMatch = canonicalPath.match(/\/scores\/(\d+)/);

  return {
    embedUrl: `https://${canonicalPath}/embed`,
    scoreId: scoreIdMatch ? scoreIdMatch[1] : null,
  };
}

const sourceMusescoreCache = new Map();

async function fetchSourceMusescoreHeights(sourceUrl) {
  if (!sourceUrl) return [];
  if (sourceMusescoreCache.has(sourceUrl)) {
    return sourceMusescoreCache.get(sourceUrl);
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      sourceMusescoreCache.set(sourceUrl, []);
      return [];
    }

    const html = await response.text();
    const matches = [...html.matchAll(/<iframe\b[^>]*>[\s\S]*?<\/iframe>|<iframe\b[^>]*\/?>/gi)];
    const entries = [];

    for (const match of matches) {
      const tag = match[0];
      const srcMatch = tag.match(/\bsrc="([^"]*musescore\.com[^"]*)"/i);
      const heightMatch = tag.match(/\bheight="(\d+)"/i);
      if (!srcMatch || !heightMatch) continue;

      const normalized = normalizeMusescoreUrl(srcMatch[1]);
      if (!normalized) continue;

      entries.push({
        embedUrl: normalized.embedUrl,
        scoreId: normalized.scoreId,
        height: Number(heightMatch[1]),
      });
    }

    sourceMusescoreCache.set(sourceUrl, entries);
    return entries;
  } catch (error) {
    sourceMusescoreCache.set(sourceUrl, []);
    return [];
  }
}

function resolveMusescoreHeightFromSource(rawUrl, sourceEntries) {
  if (!Array.isArray(sourceEntries) || sourceEntries.length === 0) return null;

  const normalized = normalizeMusescoreUrl(rawUrl);
  if (!normalized) return null;

  const byEmbedUrl = sourceEntries.find((entry) => entry.embedUrl === normalized.embedUrl);
  if (byEmbedUrl) return byEmbedUrl.height;

  if (normalized.scoreId) {
    const byScoreId = sourceEntries.find((entry) => entry.scoreId === normalized.scoreId);
    if (byScoreId) return byScoreId.height;
  }

  return null;
}


// ═══════════════════════════════════════════════════════════════
// 6. 북마크 OG 메타 조회
// ═══════════════════════════════════════════════════════════════

async function fetchBookmarkMeta(url) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ];

  for (const ua of userAgents) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();

      // og:title / twitter:title / <title> — 속성 순서가 바뀌어도 매칭
      const ogTitle =
        html.match(/<meta\s+[^>]*property=["']og:title["']\s+[^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+[^>]*property=["']og:title["']/i);
      const twitterTitle =
        html.match(/<meta\s+[^>]*name=["']twitter:title["']\s+[^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+[^>]*name=["']twitter:title["']/i);
      const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);

      const ogDesc =
        html.match(/<meta\s+[^>]*property=["']og:description["']\s+[^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+[^>]*property=["']og:description["']/i);
      const ogImage =
        html.match(/<meta\s+[^>]*property=["']og:image["']\s+[^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+[^>]*property=["']og:image["']/i);

      const title = (ogTitle?.[1] || twitterTitle?.[1] || htmlTitle?.[1] || null)?.trim();
      if (title) {
        return {
          title,
          description: ogDesc?.[1]?.trim() || null,
          image:       ogImage?.[1]?.trim() || null,
        };
      }
    } catch (e) {
      continue; // 다음 UA로 재시도
    }
  }

  console.warn(`      ⚠️  [북마크] OG 메타 조회 실패: ${url}`);
  return { title: null, description: null, image: null };
}


// ═══════════════════════════════════════════════════════════════
// 7. RichText → HTML (✅ 수정 1: CSS 클래스 사용)
// ═══════════════════════════════════════════════════════════════

function normalizeMarkdownMathDelimiters(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression) => `$$${expression}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression) => `$${expression}$`);
}

function richTextToHtml(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return "";

  return richTextArray.map(t => {
    // 인라인 수식
    if (t.type === 'equation') {
      return `$${t.equation.expression}$`;
    }

    let txt = normalizeMarkdownMathDelimiters(t.plain_text || '');



    if (t.href) {
      const internalRoute = internalRouteForNotionHref(t.href);
      if (internalRoute) {
        txt = `<a href="${internalRoute}" style="color: inherit; text-decoration: underline;">${txt}</a>`;
      } else if (!isNotionHref(t.href)) {
        txt = `<a href="${t.href}" target="_blank" style="color: inherit; text-decoration: underline;">${txt}</a>`;
      }
    }
    if (txt.trim().length === 0) return txt;

    if (t.annotations.code) {
      // $...$ 또는 $$...$$ 수식이면 code 태그 없이 그대로 출력
      if (/^\$\$[\s\S]+\$\$$/.test(txt.trim()) || /^\$[^$]+\$$/.test(txt.trim())) {
        // txt 그대로 유지 (KaTeX가 렌더링)
      } else {
        txt = `<code style="background: rgba(135,131,120,0.15); color: #EB5757; padding: 2px 5px; border-radius: 3px;">${txt}</code>`;
      }
    }
    if (t.annotations.bold)          txt = `<strong>${txt}</strong>`;
    if (t.annotations.italic)        txt = `<em>${txt}</em>`;
    if (t.annotations.strikethrough) txt = `<del>${txt}</del>`;

    // color 처리 - CSS 클래스 사용
    const color = t.annotations.color;
    if (color && color !== 'default') {
      if (color.endsWith('_background')) {
        // 백그라운드 하이라이트
        const key = color.replace('_background', '');
        txt = `<mark class="notion-highlight-${key}">${txt}</mark>`;
      } else {
        // 글자색
        txt = `<span class="notion-text-${color}">${txt}</span>`;
      }
    }

    return txt;
  }).join("");
}


// ═══════════════════════════════════════════════════════════════
// 8. 블럭 단위 color → 스타일 문자열 (✅ 수정 2: 클래스 이름 반환)
// ═══════════════════════════════════════════════════════════════

function getBlockColorStyle(content) {
  const color = content?.color;
  if (!color || color === 'default') return '';

  if (color.endsWith('_background')) {
    const key = color.replace('_background', '');
    return `notion-highlight-${key}`;
  } else {
    return `notion-text-${color}`;
  }
}


// ═══════════════════════════════════════════════════════════════
// 9. 마크다운 변환
// ═══════════════════════════════════════════════════════════════

async function convertToMarkdown(blocks, indent = "", context = {}) {
  let output = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const type = block.type;
    const content = block[type];

    let text = "";
    if (content && content.rich_text) {
      text = richTextToHtml(content.rich_text);
    }

    const childrenMd = (type !== 'table') && block.children_content
      ? await convertToMarkdown(block.children_content, indent + "  ", context)
      : "";

    // 여기서는 이제 inline style 대신 class 이름이 반환됨
    const blockColorStyle = content ? getBlockColorStyle(content) : '';

    switch (type) {
// ── paragraph (✅ 수정: 유령 문자 제거 로직 강화) ──
      case 'paragraph': {
        const audioUrl = getAudioUrlFromParagraph(block);
        if (audioUrl) {
          context.usesAudioPlayer = true;
          output.push(`${indent}${renderAudioPlayerMdx(audioUrl)}`);
          break;
        }

        // 다시 수정함
        const plain = (text || '')
          .replace(/<br\s*\/?>/gi, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&ZeroWidthSpace;/gi, '')
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // 눈에 안 보이는 특수 문자 제거
          .replace(/<[^>]*>/g, '') // HTML 태그 제거
          .trim();

        // 진짜 내용이 없으면 아예 출력하지 않음 (빈 p태그 생성 방지)
        if (!plain) break;

        // MDX에서 raw <p>는 리스트/블록 경계와 충돌하기 쉬워서 피한다.
        // 일반 문단은 마크다운 문단으로, 색상 문단만 안전한 block div로 출력한다.
        if (/\$/.test(text)) {
          output.push(`${indent}${plain}\n\n`);
        } else if (blockColorStyle) {
          output.push(`${indent}<div class="${blockColorStyle}" style="margin: 0 0 1em 0;">${text}</div>\n\n`);
        } else {
          output.push(`${indent}${text}\n\n`);
        }
        break;
      }


      // ── heading (✅ 수정 4: class 적용) ──
      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const level = type.slice(-1);
        if (blockColorStyle) {
          output.push(`\n<h${level} class="${blockColorStyle}">${text}</h${level}>\n\n`);
        } else {
          output.push(`\n${'#'.repeat(Number(level))} ${text}\n\n`);
        }
        break;
      }

      case 'bulleted_list_item':
        output.push(`${indent}- ${text}\n${childrenMd}${childrenMd && !childrenMd.endsWith('\n') ? '\n' : ''}\n`);
        break;
      case 'numbered_list_item':
        output.push(`${indent}1. ${text}\n${childrenMd}${childrenMd && !childrenMd.endsWith('\n') ? '\n' : ''}\n`);
        break;
      case 'quote':               output.push(`> ${text}\n\n`); break;

      // ── callout (✅ 수정 5: class 기반 및 배경색 제거) ──
      case 'callout': {
        const icon = block.callout?.icon?.emoji || null;
        const calloutColor = block.callout?.color || 'default_background';
        const colorKey = calloutColor.replace('_background', '');
        const calloutClass = `notion-callout-${colorKey}`;

        output.push(`\n\n<div class="${calloutClass}" style="padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; line-height: 1.6;">\n`);

        if (icon) {
          output.push(`  <div style="display: flex; gap: 12px; align-items: baseline;">\n`);
          output.push(`    <div style="font-size: 18px; line-height: 1; flex-shrink: 0; transform: translateY(2px);">${icon}</div>\n`);
          output.push(`    <div style="flex: 1; min-width: 0; line-height: 1.6;">${text}</div>\n`);
          output.push(`  </div>\n`);
        } else if (text) {
          output.push(`  <div>${text}</div>\n`);
        }

        if (childrenMd && childrenMd.trim()) {
          output.push(`  <div style="${text ? 'margin-top: 10px; ' : ''}display: flex; flex-direction: column; gap: 10px;">${childrenMd}</div>\n`);
        }

        output.push(`</div>\n\n`);
        break;
      }

      // ── table ──
      case 'table': {
        const rows = block.children_content;
        if (!rows || rows.length === 0) break;
        let tableMd = "\n";
        rows.forEach((row, idx) => {
          if (row.type !== 'table_row') return;
          const cells = row.table_row.cells.map(cell => {
            let cellHtml = richTextToHtml(cell);
            return cellHtml.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
          });
          tableMd += `| ${cells.join(' | ')} |\n`;
          if (idx === 0) {
            tableMd += `| ${cells.map(() => '---').join(' | ')} |\n`;
          }
        });
        output.push(tableMd + "\n");
        break;
      }
      case 'table_row': break;

      // ── image ──
      case 'image': {
        const imgUrl = content.type === 'external' ? content.external.url : content.file.url;
        const caption = content.caption?.map(t => t.plain_text).join("") || "";
        output.push(`\n\n<img src="${imgUrl}" alt="${caption}" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />\n\n`);
        break;
      }

      // ── column list / column ──
      case 'column_list': {
        const columns = block.children_content || [];
        if (columns.length === 0) break;

        const nonEmptyColumns = columns.filter(
          (column) => column.type === 'column' && (column.children_content || []).length > 0
        );

        if (nonEmptyColumns.length === 0) break;

        output.push(`\n\n<div class="notion-columns" style="--notion-columns:${nonEmptyColumns.length}; display:grid; grid-template-columns:repeat(${nonEmptyColumns.length}, minmax(0, 1fr)); gap:1.5rem; margin:1.5rem 0; align-items:start; width:100%; max-width:100%;">\n\n`);

        for (const column of nonEmptyColumns) {
          const columnChildren = column.children_content || [];

          output.push(`<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">\n\n`);
          const columnContent = await convertToMarkdown(columnChildren, indent, context);
          output.push(columnContent);
          output.push(`\n\n</div>\n\n`);
        }

        output.push(`</div>\n\n`);
        break;
      }

      case 'column':
        if (childrenMd && childrenMd.trim()) {
          output.push(childrenMd);
        }
        break;

      // ── audio ──
      case 'audio': {
        const audioUrl = content.type === 'external' ? content.external.url : content.file?.url;
        const caption = content.caption?.map(t => t.plain_text).join("") || "";

        if (audioUrl) {
          context.usesAudioPlayer = true;
          output.push(renderAudioPlayerMdx(audioUrl, caption));
        }
        break;
      }

      // ── video / embed ──
      case 'video':
      case 'embed': {
        let rawUrl = content.url || (content.external ? content.external.url : content.file?.url);

        if (rawUrl && rawUrl.includes('musescore.com')) {
          const match = rawUrl.match(/(musescore\.com\/user\/\d+\/scores\/\d+(\/s\/[\w-]+)?)/);
          if (match) {
            const embedUrl = `https://${match[0]}/embed`;
            let realHeight = await getMusescoreHeight(rawUrl);
            const nextBlock = blocks[i + 1];
            const nextPlainText = getParagraphPlainText(nextBlock);
            const sizeMatch = nextPlainText.match(/width\s*=\s*"([^"]+)"\s+height\s*=\s*"(\d+)"/i);

            if (sizeMatch) {
              realHeight = Number(sizeMatch[2]);
              i += 1;
            } else {
              const sourceHeight = resolveMusescoreHeightFromSource(rawUrl, context.sourceMusescoreHeights);
              if (sourceHeight) {
                realHeight = sourceHeight;
              }
            }

            output.push(`\n\n<div class="notion-embed notion-embed--musescore" style="--musescore-height:${realHeight}px;"><iframe src="${embedUrl}" style="width:100%; height:${realHeight}px !important; border:none; display:block;" frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe></div>\n\n`);
          } else {
            output.push(`\n[🔗 악보 링크](${rawUrl})\n\n`);
          }
        }
        else if (rawUrl && (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be'))) {
          if (rawUrl.includes('watch?v=')) rawUrl = rawUrl.replace('watch?v=', 'embed/');
          else if (rawUrl.includes('youtu.be/')) rawUrl = rawUrl.replace('youtu.be/', 'youtube.com/embed/');
          output.push(`\n\n
<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;">
  <iframe src="${rawUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>\n\n`);
        }
        else if (rawUrl && rawUrl.includes('spotify.com')) {
          // 스포티파이: track=152px, 그 외(앨범/플레이리스트)=352px
          const spotifyHeight = rawUrl.includes('/track/') ? 152 : 352;
          // open.spotify.com/track/xxx → open.spotify.com/embed/track/xxx
          const spotifyEmbed = rawUrl.includes('/embed/') ? rawUrl : rawUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
          output.push(`\n\n<iframe src="${spotifyEmbed}" width="100%" height="${spotifyHeight}" frameborder="0" style="border-radius: 12px; display: block; margin: 1rem 0;" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>\n\n`);
        }
        else {
          output.push(`\n\n<iframe src="${rawUrl}" width="100%" height="450" frameborder="0"></iframe>\n\n`);
        }
        break;
      }

      // ── bookmark ──
      case 'bookmark': {
        const bUrl = content.url;
        const bCaption = content.caption?.map(t => t.plain_text).join("") || "";

        console.log(`      📎 [북마크] 메타 조회: ${bUrl}`);
        const meta = await fetchBookmarkMeta(bUrl);

        const bTitle       = bCaption || meta.title || bUrl;
        const bDescription = meta.description || '';
        const bImage       = meta.image || null;

        output.push(`\n\n`);

        if (bImage) {
          output.push(`
<a href="${bUrl}" target="_blank" style="display: flex; border: 1px solid #e5e7eb; border-radius: 6px; text-decoration: none; color: inherit; margin: 16px 0; overflow: hidden; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
  <div style="padding: 12px 16px; flex: 1; min-width: 0;">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111827;">${bTitle}</div>
    ${bDescription ? `<div style="font-size: 12px; color: #6b7280; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 6px;">${bDescription}</div>` : ''}
    <div style="font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bUrl}</div>
  </div>
  <div style="width: 140px; min-width: 140px; background: #f3f4f6; overflow: hidden;">
    <img src="${bImage}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
  </div>
</a>`);
        } else {
  output.push(`
<a href="${bUrl}" target="_blank" style="display: block; border: 1px solid #e5e7eb; border-radius: 6px; text-decoration: none; color: inherit; margin: 16px 0; padding: 16px; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
  <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #111827; word-break: break-all; overflow-wrap: anywhere;">🔗 ${bTitle}</div>
  ${bDescription ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 8px;">${bDescription}</div>` : ''}
  <div style="font-size: 11px; color: #9ca3af; word-break: break-all;">${bUrl}</div>
</a>`);
              }
        output.push(`\n\n`);
        break;
      }

      case 'equation':
        output.push(`$$\n${content.expression}\n$$\n\n`);
        break;

      case 'divider': output.push(`---\n\n`); break;
      case 'code':    output.push(`\`\`\`${content.language}\n${text}\n\`\`\`\n\n`); break;
      case 'toggle':
        output.push(`\n\n<details>\n\n`);
        output.push(`<summary>${text}</summary>\n\n`);
        if (childrenMd && childrenMd.trim()) {
          output.push(childrenMd);
        }
        output.push(`\n\n</details>\n\n`);
        break;

      default:
        if (text) output.push(`${indent}${text}\n\n`);
    }
  }
  return output.join("");
}


// ═══════════════════════════════════════════════════════════════
// 10. 이미지 다운로더 (SVG 포함)
// ═══════════════════════════════════════════════════════════════

async function downloadImage(url, filepathWithoutExt) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type');
    let ext = '.png';
    if (contentType) {
      if (contentType.includes('svg'))                                       ext = '.svg';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
      else if (contentType.includes('png'))                                  ext = '.png';
      else if (contentType.includes('gif'))                                  ext = '.gif';
    } else {
      const urlPath = new URL(url).pathname;
      const urlExt = path.extname(urlPath).toLowerCase();
      if (['.svg', '.png', '.jpg', '.jpeg', '.gif'].includes(urlExt)) ext = urlExt;
    }

    const buffer = await response.arrayBuffer();
    const finalFilename = `${filepathWithoutExt}${ext}`;
    fs.writeFileSync(finalFilename, Buffer.from(buffer));
    return path.basename(finalFilename);
  } catch (e) {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// 11. Frontmatter 생성 (✅ 업데이트: 순서 속성 추가)
// ═══════════════════════════════════════════════════════════════

function buildFrontmatter(title, tags, createdTime, lastEditedTime, order, notionPageId) {
  let fm = `---\ntitle: "${title.replace(/"/g, '\\"')}"\n`;

  if (createdTime) {
    fm += `date: ${createdTime.slice(0, 10)}\n`;
  }
  if (lastEditedTime) {
    fm += `lastEdited: ${lastEditedTime.slice(0, 10)}\n`;
  }
  if (notionPageId) {
    fm += `notionPageId: "${notionPageId}"\n`;
  }
  if (tags && tags.length > 0) {
    fm += `tags:\n`;
    tags.forEach(tag => {
      fm += `  - "${tag.replace(/"/g, '\\"')}"\n`;
    });
  }

  // ✅ 사이드바 정렬 순서 추가
  fm += `sidebar:\n  order: ${order}\n`;

  fm += `---\n\n`;
  return fm;
}


function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '');
}
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function getStoredNotionPageId(contents) {
  if (!contents) return null;

  const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const notionPageIdMatch = frontmatterMatch[1].match(/(?:^|\n)notionPageId:\s*"([^"\n]+)"/);
    if (notionPageIdMatch) return notionPageIdMatch[1];
  }

  const legacyMarkerMatch = contents.match(/notion-sync: page-id=([a-f0-9-]+)/i);
  return legacyMarkerMatch ? legacyMarkerMatch[1] : null;
}

function preserveMt21cSourceLink(existingContents, generatedMarkdown, categoryFolder) {
  if (!categoryFolder.normalize('NFC').includes('21세기 음악이론 한글판')) {
    return generatedMarkdown;
  }

  const sourceUrl = existingContents.match(
    /https:\/\/musictheory\.pugetsound\.edu\/mt21c\/[A-Za-z0-9_-]+\.html/,
  )?.[0];
  if (!sourceUrl || generatedMarkdown.includes(sourceUrl)) return generatedMarkdown;

  const section = getStoredTitle(existingContents)?.match(/^(\d+(?:\.\d+)+)/)?.[1] || '';
  const sourceCard = `<a href="${sourceUrl}" target="_blank" class="mt21c-source-link">\n  <strong>🔗 원문${section ? ` ${section}` : ''}</strong>\n  <span>${sourceUrl}</span>\n</a>`;
  const trailingDivider = /\n---\s*$/;

  if (trailingDivider.test(generatedMarkdown)) {
    return generatedMarkdown.replace(trailingDivider, `\n\n${sourceCard}\n\n---\n`);
  }
  return `${generatedMarkdown.trimEnd()}\n\n${sourceCard}\n`;
}

function normalizeLegacyStem(name) {
  return name
    .normalize('NFC')
    .replace(/\.(md|mdx)$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^0+(\d+)(\.)/, '$1$2')
    .trim()
    .toLowerCase();
}

function removeLegacySyncedVariants(categoryFolder, pageId, baseFilename, currentExtension) {
  const entries = fs.readdirSync(categoryFolder, { withFileTypes: true });
  const targetStem = normalizeLegacyStem(baseFilename);

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.md' && ext !== '.mdx') continue;

    const entryPath = path.join(categoryFolder, entry.name);
    const sameTargetPath = entry.name === `${baseFilename}${currentExtension}`;
    if (sameTargetPath) continue;

    const contents = readFileSafe(entryPath);
    const hasSamePageMarker = getStoredNotionPageId(contents) === pageId;
    const sameLegacyStem = normalizeLegacyStem(entry.name) === targetStem;

    if (hasSamePageMarker || sameLegacyStem) {
      fs.unlinkSync(entryPath);
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// 12. 메인 (✅ 업데이트: 순서 속성 처리 로직 추가)
// ═══════════════════════════════════════════════════════════════

async function syncNotion() {
  try {
    console.log('🚀 Notion 동기화 시작...');
    if (!fs.existsSync(IMAGES_PATH)) fs.mkdirSync(IMAGES_PATH, { recursive: true });

    let allPages = [];
    let cursor = undefined;

    console.log('📚 페이지 수집 중...');
    do {
      const body = {
        page_size: 100,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      };
      if (cursor) body.start_cursor = cursor;

      const queryData = await fetchNotion(`/databases/${DATABASE_ID}/query`, 'POST', body);
      if (queryData.results) allPages.push(...queryData.results);
      cursor = queryData.next_cursor;
      process.stdout.write('.');
    } while (cursor);

    console.log(`\n✅ 총 ${allPages.length}개의 페이지 발견.\n`);

    const pageMaps = buildNotionPageMaps(allPages);
    notionPageRouteMap = pageMaps.routeMap;
    notionPageOrderMap = pageMaps.orderMap;
    notionTitleOrderMap = pageMaps.titleOrderMap;
    console.log(`🔗 내부 링크 경로 ${notionPageRouteMap.size}개 준비 완료.\n`);

    if (REPAIR_GENERATED_DOCS_ONLY || REWRITE_INTERNAL_LINKS_ONLY) {
      repairGeneratedDocuments({ rewriteOrders: !REWRITE_INTERNAL_LINKS_ONLY });
      console.log('\n✨ 생성 문서 링크·순서 복구 완료!');
      return;
    }

    const pageErrors = [];

    for (const page of allPages) {
      try {
        if (EXCLUDED_NOTION_PAGE_IDS.has(page.id)) continue;

        const title       = page.properties['제목']?.title?.map(t => t.plain_text).join("") || 'Untitled';
        if (EXCLUDED_NOTION_PAGE_TITLES.has(title.normalize('NFC'))) continue;

        const category    = page.properties['카테고리']?.select?.name;
        const status      = page.properties['상태']?.status?.name;
        const createdTime = page.created_time;
        const lastEdited  = page.last_edited_time;

        // ✅ 순서 속성 가져오기 (값이 없으면 9999로 설정하여 맨 뒤로 보냄)
        const order = pageOrder(page, title);

        // tags 추출
        let tags = [];
        const descProp = page.properties['설명'];
        if (descProp) {
          if (descProp.type === 'multi_select' && descProp.multi_select) {
            tags = descProp.multi_select.map(s => s.name);
          } else if (descProp.type === 'select' && descProp.select) {
            tags = [descProp.select.name];
          } else if (descProp.type === 'rich_text' && descProp.rich_text) {
            const rawText = descProp.rich_text.map(t => t.plain_text).join("").trim();
            if (rawText) tags = rawText.split(',').map(t => t.trim()).filter(Boolean);
          } else if (descProp.type === 'relation' && descProp.relation) {
            for (const rel of descProp.relation) {
              const relPage = await fetchNotion(`/pages/${rel.id}`, 'GET');
              const relTitle = relPage?.properties?.['제목']?.title?.map(t => t.plain_text).join("") || '';
              if (relTitle) tags.push(relTitle);
            }
          }
        }

        if (!['시작 전', '완료'].includes(status?.trim())) continue;
        if (!category) {
          console.warn(`   [건너뜀] 카테고리 없음: "${title}" (${page.id})`);
          continue;
        }
        const normalizedCategory = category.normalize('NFC');
        if (SYNC_CATEGORY && normalizedCategory !== SYNC_CATEGORY) continue;
        if (SYNC_CATEGORIES && !SYNC_CATEGORIES.has(normalizedCategory)) continue;

        const categoryFolder = findCategoryFolder(category);
        if (!categoryFolder) {
          console.warn(`   [건너뜀] 아스트로 폴더 없음: "${title}" / 카테고리 "${category}" (${page.id})`);
          continue;
        }

        console.log(`   📄 [변환] "${title}" (순서: ${order})`);

        const blocks = await fetchAllChildren(page.id);
        const sourceBookmarkUrl = findSourceBookmarkUrl(blocks);
        const sourceMusescoreHeights = sourceBookmarkUrl ? await fetchSourceMusescoreHeights(sourceBookmarkUrl) : [];
        const renderContext = { sourceMusescoreHeights, usesAudioPlayer: false };
        let markdown = await convertToMarkdown(blocks, "", renderContext);

        // 이미지 경로 교체
        const imageRegex = /<img src="(https:\/\/[^"]+)"/g;
        let newMarkdown = markdown;
        const matches = [...markdown.matchAll(imageRegex)];
        let imageIndex = 0;
        const safeTitleForImage = sanitizeName(title).replace(/\s+/g, '-');

        for (const m of matches) {
          const imageUrl = m[1];
          const baseImagePath = path.join(IMAGES_PATH, `${safeTitleForImage}-${imageIndex}`);
          const savedFilename = await downloadImage(imageUrl, baseImagePath);
          if (savedFilename) {
            newMarkdown = newMarkdown.replace(imageUrl, `/images/${savedFilename}`);
            imageIndex++;
          }
        }
        markdown = newMarkdown;

        let imports = '';
        let extension = '.md';

        if (renderContext.usesAudioPlayer) {
          const audioPlayerPath = path.join(__dirname, '..', 'src', 'components', 'AudioPlayer.astro');
          let relativeImportPath = path.relative(categoryFolder, audioPlayerPath).replace(/\\/g, '/');
          if (!relativeImportPath.startsWith('.')) {
            relativeImportPath = `./${relativeImportPath}`;
          }
          imports = `import AudioPlayer from '${relativeImportPath}';\n\n`;
          extension = '.mdx';
        }

        // ✅ Frontmatter 생성 시 order 전달
        const frontmatter = buildFrontmatter(title, tags, createdTime, lastEdited, order, page.id);
        const baseFilename = sanitizeName(title);
        const filename = `${baseFilename}${extension}`;
        const filePath = path.join(categoryFolder, filename);
        const alternateExtension = extension === '.mdx' ? '.md' : '.mdx';
        const alternateFilePath = path.join(categoryFolder, `${baseFilename}${alternateExtension}`);

        removeLegacySyncedVariants(categoryFolder, page.id, baseFilename, extension);

        if (fs.existsSync(alternateFilePath)) {
          fs.unlinkSync(alternateFilePath);
        }

        const existingContents = readFileSafe(filePath) || readFileSafe(alternateFilePath);
        markdown = preserveMt21cSourceLink(existingContents, markdown, categoryFolder);
        fs.writeFileSync(filePath, frontmatter + imports + markdown, 'utf-8');

      } catch (e) {
        console.error(`❌ 에러: ${e.message}`);
        pageErrors.push(`${page.id}: ${e.message}`);
      }
    }

    await syncPianoDB();

    if (pageErrors.length > 0) {
      throw new Error(`페이지 변환 실패 ${pageErrors.length}건: ${pageErrors.join(' | ')}`);
    }
    
    console.log('\n✨ 동기화 완료!');

  } catch (error) {
    console.error('\n❌ 치명적 에러:', error.message);
    process.exitCode = 1;
  }
}

syncNotion();
