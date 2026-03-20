import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { syncPianoDB } from './sync-pianos.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const API_KEY = process.env.NOTION_API_KEY;
const DOCS_PATH = path.join(__dirname, '..', 'src', 'content', 'docs');
const IMAGES_PATH = path.join(__dirname, '..', 'public', 'images');



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


// ═══════════════════════════════════════════════════════════════
// 2. Notion API 호출
// ═══════════════════════════════════════════════════════════════

async function fetchNotion(endpoint, method = 'GET', body = null) {
  await new Promise(resolve => setTimeout(resolve, 50));
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) {
    if (response.status === 404) return { results: [], status: 404 };
    const err = await response.text();
    throw new Error(`API 오류 (${response.status}): ${err}`);
  }
  return response.json();
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

function richTextToHtml(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return "";

  return richTextArray.map(t => {
    // 인라인 수식
    if (t.type === 'equation') {
      return `$${t.equation.expression}$`;
    }

    let txt = t.plain_text || '';



    if (t.href) {
      txt = `<a href="${t.href}" target="_blank" style="color: inherit; text-decoration: underline;">${txt}</a>`;
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
  return name.replace(/[<>:"/\\|?*]/g, '').trim();
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

    for (const page of allPages) {
      try {
        const title       = page.properties['제목']?.title?.map(t => t.plain_text).join("") || 'Untitled';
        const category    = page.properties['카테고리']?.select?.name;
        const status      = page.properties['상태']?.status?.name;
        const createdTime = page.created_time;
        const lastEdited  = page.last_edited_time;

        // ✅ 순서 속성 가져오기 (값이 없으면 9999로 설정하여 맨 뒤로 보냄)
        const orderProp = page.properties['순서'];
        const order = (orderProp?.number !== undefined && orderProp?.number !== null) ? orderProp.number : 9999;

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

        if (status?.trim() !== '시작 전') continue;
        if (!category) continue;

        const categoryFolder = findFolderPath(DOCS_PATH, category);
        if (!categoryFolder) continue;

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

        fs.writeFileSync(filePath, frontmatter + imports + markdown, 'utf-8');

      } catch (e) {
        console.error(`❌ 에러: ${e.message}`);
      }
    }

    await syncPianoDB();
    
    console.log('\n✨ 동기화 완료!');

  } catch (error) {
    console.error('\n❌ 치명적 에러:', error.message);
  }
}

syncNotion();
