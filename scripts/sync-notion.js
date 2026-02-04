import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const API_KEY = process.env.NOTION_API_KEY;
const DOCS_PATH = path.join(__dirname, '..', 'src', 'content', 'docs');
const IMAGES_PATH = path.join(__dirname, '..', 'public', 'images');


// ═══════════════════════════════════════════════════════════════
// Notion 색상 맵 (팬톤 '올해의 컬러' 에디션)
// ═══════════════════════════════════════════════════════════════

// annotations.color 값 → 글자색 (가독성을 위해 투명도 1)
// 1. 글자색: 검은 배경에서 잘 보이도록 '명도'를 확 높임
const TEXT_COLOR_MAP = {
  gray:   'rgba(220, 220, 220, 1)', // 밝은 회색
  brown:  'rgba(235, 180, 160, 1)', // 옅은 흙색 -> 살구빛으로 변경
  orange: 'rgba(255, 180, 140, 1)', // 진한 주황 -> 밝은 오렌지
  yellow: 'rgba(255, 240, 140, 1)', // 개나리색 -> 레몬색
  teal:   'rgba(140, 230, 210, 1)', // 청록색 -> 민트색
  blue:   'rgba(150, 200, 255, 1)', // 남색 -> 하늘색
  purple: 'rgba(210, 180, 255, 1)', // 보라색 -> 라벤더
  pink:   'rgba(255, 180, 220, 1)', // 진분홍 -> 베이비핑크
  red:    'rgba(255, 160, 160, 1)', // 빨강 -> 연한 장미색
};

// 2. 하이라이트 배경: 형광펜 느낌 (투명도 0.2~0.3)
const HIGHLIGHT_BG_MAP = {
  gray:   'rgba(200, 200, 200, 0.2)',
  brown:  'rgba(235, 180, 160, 0.2)',
  orange: 'rgba(255, 180, 140, 0.2)',
  yellow: 'rgba(255, 240, 140, 0.2)', 
  teal:   'rgba(140, 230, 210, 0.2)',
  blue:   'rgba(150, 200, 255, 0.2)',
  purple: 'rgba(210, 180, 255, 0.2)',
  pink:   'rgba(255, 180, 220, 0.2)',
  red:    'rgba(255, 160, 160, 0.2)',
};

// 3. 콜아웃 박스 배경: 은은한 빛 효과 (투명도 0.15)
// ★ 핵심: 배경색의 '원색'을 밝은 색으로 써야 검은 배경에서 칙칙해지지 않음
const CALLOUT_BG_MAP = {
  default_background:  'rgba(200, 200, 200, 0.15)',
  gray_background:     'rgba(200, 200, 200, 0.15)',
  brown_background:    'rgba(235, 180, 160, 0.15)',
  orange_background:   'rgba(255, 180, 140, 0.15)',
  yellow_background:   'rgba(255, 240, 140, 0.15)',
  teal_background:     'rgba(140, 230, 210, 0.15)',
  blue_background:     'rgba(150, 200, 255, 0.15)',
  purple_background:   'rgba(210, 180, 255, 0.15)',
  pink_background:     'rgba(255, 180, 220, 0.15)',
  red_background:      'rgba(255, 160, 160, 0.15)',
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
  try {
    const oembedUrl = `https://musescore.com/services/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return 450;
    const data = await res.json();
    return data.height || 450;
  } catch (e) {
    return 450;
  }
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
// 7. RichText → HTML
//    annotations.color:
//      "gray", "pink" 등           → 글자색 변경
//      "gray_background" 등        → 백그라운드 하이라이트(mark)
// ═══════════════════════════════════════════════════════════════

function richTextToHtml(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return "";

  return richTextArray.map(t => {
    let txt = t.plain_text || '';

    if (t.href) {
      txt = `<a href="${t.href}" target="_blank" style="color: inherit; text-decoration: underline;">${txt}</a>`;
    }
    if (txt.trim().length === 0) return txt;

    if (t.annotations.code) {
      txt = `<code style="background: rgba(135,131,120,0.15); color: #EB5757; padding: 2px 5px; border-radius: 3px;">${txt}</code>`;
    }
    if (t.annotations.bold)          txt = `<strong>${txt}</strong>`;
    if (t.annotations.italic)        txt = `<em>${txt}</em>`;
    if (t.annotations.strikethrough) txt = `<del>${txt}</del>`;

    // color 처리
    const color = t.annotations.color;
    if (color && color !== 'default') {
      if (color.endsWith('_background')) {
        // 백그라운드 하이라이트
        const key = color.replace('_background', '');
        const bg = HIGHLIGHT_BG_MAP[key] || 'rgba(240,239,237,1)';
        txt = `<mark style="background: ${bg}; padding: 0.1em 0.2em; border-radius: 2px;">${txt}</mark>`;
      } else {
        // 글자색
        const c = TEXT_COLOR_MAP[color];
        if (c) txt = `<span style="color: ${c};">${txt}</span>`;
      }
    }

    return txt;
  }).join("");
}


// ═══════════════════════════════════════════════════════════════
// 8. 블럭 단위 color → 스타일 문자열
//    heading 등의 블럭 자체에 color 속성이 붙는 경우
// ═══════════════════════════════════════════════════════════════

function getBlockColorStyle(content) {
  const color = content?.color;
  if (!color || color === 'default') return '';

  if (color.endsWith('_background')) {
    const key = color.replace('_background', '');
    const bg = HIGHLIGHT_BG_MAP[key] || '';
    return bg ? `background: ${bg}; padding: 0.2em 0.4em; border-radius: 3px;` : '';
  } else {
    const c = TEXT_COLOR_MAP[color];
    return c ? `color: ${c};` : '';
  }
}


// ═══════════════════════════════════════════════════════════════
// 9. 마크다운 변환
// ═══════════════════════════════════════════════════════════════

async function convertToMarkdown(blocks, indent = "") {
  let output = [];

  for (const block of blocks) {
    const type = block.type;
    const content = block[type];

    let text = "";
    if (content && content.rich_text) {
      text = richTextToHtml(content.rich_text);
    }

    const childrenMd = (type !== 'table') && block.children_content
      ? await convertToMarkdown(block.children_content, indent + "  ")
      : "";

    const blockColorStyle = content ? getBlockColorStyle(content) : '';

    switch (type) {
      // ── paragraph ──
      case 'paragraph':
        output.push(`${indent}<p style="margin-bottom: 1em;${blockColorStyle ? ' ' + blockColorStyle : ''}">${text}</p>\n\n`);
        break;

      // ── heading ──
      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const level = type.slice(-1);
        if (blockColorStyle) {
          output.push(`\n<h${level} style="${blockColorStyle}">${text}</h${level}>\n\n`);
        } else {
          output.push(`\n${'#'.repeat(Number(level))} ${text}\n\n`);
        }
        break;
      }

      case 'bulleted_list_item':  output.push(`${indent}- ${text}\n${childrenMd}`); break;
      case 'numbered_list_item':  output.push(`${indent}1. ${text}\n${childrenMd}`); break;
      case 'quote':               output.push(`> ${text}\n\n`); break;

      // ── callout ──
      case 'callout': {
        const icon = block.callout?.icon?.emoji || null;
        const calloutColor = block.callout?.color || 'default_background';
        const bgColor = CALLOUT_BG_MAP[calloutColor] || CALLOUT_BG_MAP['default_background'];

        if (icon) {
          output.push(`
<div style="background-color: ${bgColor}; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; margin: 20px 0; color: #37352f; border: 1px solid #e5e7eb;">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <div style="font-size: 24px; line-height: 1.2; margin-top: -2px;">${icon}</div>
    <div style="flex: 1; min-width: 0; line-height: 1.6;">
      ${text}
    </div>
  </div>
  ${childrenMd ? `<div style="margin-top: 10px; width: 100%; display: flex; flex-direction: column; gap: 10px;">${childrenMd}</div>` : ''}
</div>\n\n`);
        } else {
          output.push(`
<div style="background-color: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; color: #37352f; border: 1px solid #e5e7eb; line-height: 1.6;">
  ${text ? `<div>${text}</div>` : ''}
  ${childrenMd ? `<div style="${text ? 'margin-top: 10px; ' : ''}display: flex; flex-direction: column; gap: 10px;">${childrenMd}</div>` : ''}
</div>\n\n`);
        }
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
        output.push(`<img src="${imgUrl}" alt="${caption}" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />\n\n`);
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
            const realHeight = await getMusescoreHeight(rawUrl);
            output.push(`\n<iframe src="${embedUrl}" style="width:100%; height:${realHeight}px !important; border:none; display: block;" frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe>\n\n`);
          } else {
            output.push(`\n[🔗 악보 링크](${rawUrl})\n\n`);
          }
        }
        else if (rawUrl && (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be'))) {
          if (rawUrl.includes('watch?v=')) rawUrl = rawUrl.replace('watch?v=', 'embed/');
          else if (rawUrl.includes('youtu.be/')) rawUrl = rawUrl.replace('youtu.be/', 'youtube.com/embed/');
          output.push(`
<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;">
  <iframe src="${rawUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>\n\n`);
        }
        else {
          output.push(`\n<iframe src="${rawUrl}" width="100%" height="450" frameborder="0"></iframe>\n\n`);
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
</a>\n\n`);
        } else {
          output.push(`
<a href="${bUrl}" target="_blank" style="display: flex; border: 1px solid #e5e7eb; border-radius: 6px; text-decoration: none; color: inherit; margin: 16px 0; overflow: hidden; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
  <div style="padding: 12px 16px; flex: 1; min-width: 0;">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111827;">${bTitle}</div>
    ${bDescription ? `<div style="font-size: 12px; color: #6b7280; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 6px;">${bDescription}</div>` : ''}
    <div style="font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bUrl}</div>
  </div>
  <div style="width: 48px; background: #f9fafb; display: flex; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb; color: #9ca3af;">
    <span style="font-size: 20px;">🔗</span>
  </div>
</a>\n\n`);
        }
        break;
      }

      case 'divider': output.push(`---\n\n`); break;
      case 'code':    output.push(`\`\`\`${content.language}\n${text}\n\`\`\`\n\n`); break;
      case 'toggle':
        output.push(`\n<details>\n<summary>${text}</summary>\n\n${childrenMd}\n</details>\n\n`);
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

function buildFrontmatter(title, tags, createdTime, lastEditedTime, order) {
  let fm = `---\ntitle: "${title.replace(/"/g, '\\"')}"\n`;

  if (createdTime) {
    fm += `date: ${createdTime.slice(0, 10)}\n`;
  }
  if (lastEditedTime) {
    fm += `lastEdited: ${lastEditedTime.slice(0, 10)}\n`;
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
        let markdown = await convertToMarkdown(blocks);

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

        // ✅ Frontmatter 생성 시 order 전달
        const frontmatter = buildFrontmatter(title, tags, createdTime, lastEdited, order);
        const filename = `${sanitizeName(title)}.md`;
        fs.writeFileSync(path.join(categoryFolder, filename), frontmatter + markdown, 'utf-8');

      } catch (e) {
        console.error(`❌ 에러: ${e.message}`);
      }
    }
    console.log('\n✨ 동기화 완료!');

  } catch (error) {
    console.error('\n❌ 치명적 에러:', error.message);
  }
}

syncNotion();