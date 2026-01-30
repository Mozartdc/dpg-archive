import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const API_KEY = process.env.NOTION_API_KEY;
const DOCS_PATH = path.join(__dirname, 'src', 'content', 'docs');
const IMAGES_PATH = path.join(__dirname, 'public', 'images');

// 1. [폴더 찾기]
function findFolderPath(startPath, targetFolderName) {
  if (!fs.existsSync(startPath)) return null;
  const files = fs.readdirSync(startPath, { withFileTypes: true });

  for (const file of files) {
    if (file.isDirectory()) {
      if (file.name === targetFolderName) return path.join(startPath, file.name);
      if (['node_modules', '.git', 'public', '.astro'].includes(file.name)) continue;
      const foundPath = findFolderPath(path.join(startPath, file.name), targetFolderName);
      if (foundPath) return foundPath;
    }
  }
  return null;
}

// 2. Notion API 호출
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

// 3. [동기화 블록] 추적 로직
async function fetchAllChildren(blockId, depth = 0) {
  let allResults = [];
  let cursor = undefined;
  if (depth > 5) return [];

  do {
    const endpoint = `/blocks/${blockId}/children` + (cursor ? `?start_cursor=${cursor}` : "");
    const response = await fetchNotion(endpoint, 'GET');
    
    if (response.status === 404) {
        console.log(`      🚫 [접근 불가] 블록(${blockId}) 권한 없음.`);
        return [];
    }
    
    if (!response.results) break;
    
    for (const block of response.results) {
      if (block.type === 'synced_block') {
        const syncedFrom = block.synced_block.synced_from;
        if (syncedFrom && syncedFrom.block_id) {
           const originalChildren = await fetchAllChildren(syncedFrom.block_id, depth + 1);
           allResults.push(...originalChildren);
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

// [뮤즈스코어 높이 조회]
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

// [헬퍼] RichText -> HTML (표 안에서도 스타일 유지 위해 사용)
function richTextToHtml(richTextArray) {
    if (!richTextArray || richTextArray.length === 0) return "";
    
    return richTextArray.map(t => {
        let txt = t.plain_text || '';
        
        // 링크
        if (t.href) return `<a href="${t.href}" target="_blank" style="color: inherit; text-decoration: underline;">${txt}</a>`;
        if (txt.trim().length === 0) return txt;

        // 스타일
        if (t.annotations.code) txt = `<code style="background: rgba(135,131,120,0.15); color: #EB5757; padding: 2px 5px; border-radius: 3px;">${txt}</code>`;
        if (t.annotations.bold) txt = `<strong>${txt}</strong>`;
        if (t.annotations.italic) txt = `<em>${txt}</em>`;
        if (t.annotations.strikethrough) txt = `<del>${txt}</del>`;
        if (t.annotations.color && t.annotations.color !== 'default') {
             txt = `<span class="notion-color-${t.annotations.color}">${txt}</span>`;
        }
        return txt;
    }).join("");
}

// 4. [마크다운 변환] 표는 MD문법으로, 나머지는 HTML 태그 유지
async function convertToMarkdown(blocks, indent = "") {
  let output = [];
  
  for (const block of blocks) {
    const type = block.type;
    const content = block[type];
    
    // 기본 텍스트 처리
    let text = "";
    if (content.rich_text) {
        text = richTextToHtml(content.rich_text);
    }

    // 재귀 호출 (표 내부 처리는 switch문 안에서 따로 함)
    const childrenMd = (type !== 'table') && block.children_content 
        ? await convertToMarkdown(block.children_content, indent + "  ") 
        : "";

    switch (type) {
      case 'paragraph': output.push(`${indent}<p style="margin-bottom: 1em;">${text}</p>\n\n`); break;
      case 'heading_1': output.push(`\n# ${text}\n\n`); break;
      case 'heading_2': output.push(`\n## ${text}\n\n`); break;
      case 'heading_3': output.push(`\n### ${text}\n\n`); break;
      case 'bulleted_list_item': output.push(`${indent}- ${text}\n${childrenMd}`); break;
      case 'numbered_list_item': output.push(`${indent}1. ${text}\n${childrenMd}`); break;
      case 'quote': output.push(`> ${text}\n\n`); break;
      
      case 'callout': 
        const icon = block.callout.icon?.emoji || '💡';
        output.push(`
<div style="background-color: #F1F1EF; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; margin: 20px 0; color: #37352f; border: 1px solid #e5e7eb;">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <div style="font-size: 24px; line-height: 1.2; margin-top: -2px;">${icon}</div>
    <div style="flex: 1; min-width: 0; line-height: 1.6;">
      ${text}
    </div>
  </div>
  ${childrenMd ? `<div style="margin-top: 10px; width: 100%; display: flex; flex-direction: column; gap: 10px;">${childrenMd}</div>` : ''}
</div>\n\n`); 
        break;

      // [핵심 수정] 표를 순수 마크다운 문법(|---|)으로 변환
      case 'table':
        const rows = block.children_content; // table_row 블록들
        if (!rows || rows.length === 0) break;

        let tableMd = "\n";
        rows.forEach((row, idx) => {
            if (row.type !== 'table_row') return;
            
            // 각 셀의 내용을 가져와서 파이프(|)와 줄바꿈(\n)을 이스케이프 처리
            const cells = row.table_row.cells.map(cell => {
                let cellHtml = richTextToHtml(cell);
                return cellHtml.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
            });

            // 행 생성: | 내용 | 내용 |
            tableMd += `| ${cells.join(' | ')} |\n`;

            // 첫 번째 행(헤더) 바로 밑에 구분선(|---|) 추가
            if (idx === 0) {
                tableMd += `| ${cells.map(() => '---').join(' | ')} |\n`;
            }
        });
        output.push(tableMd + "\n");
        break;

      // table_row는 table 안에서 처리했으므로 개별 출력 금지
      case 'table_row': 
        break;

      case 'image':
        const imgUrl = content.type === 'external' ? content.external.url : content.file.url;
        const caption = content.caption?.map(t => t.plain_text).join("") || "";
        output.push(`<img src="${imgUrl}" alt="${caption}" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />\n\n`);
        break;

      case 'video':
      case 'embed':
        let rawUrl = content.url || (content.external ? content.external.url : content.file?.url);
        
        if (rawUrl && rawUrl.includes('musescore.com')) {
            const match = rawUrl.match(/(musescore\.com\/user\/\d+\/scores\/\d+(\/s\/[\w-]+)?)/);
            if (match) {
                const embedUrl = `https://${match[0]}/embed`;
                const realHeight = await getMusescoreHeight(rawUrl);
                // [요청 반영] Notion API는 높이를 안 주므로, MuseScore 서버에서 가져온 높이를 쓴다.
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

      case 'bookmark':
        const bUrl = content.url;
        const bTitle = text || bUrl; 
        output.push(`
<a href="${bUrl}" target="_blank" style="display: flex; border: 1px solid #e5e7eb; border-radius: 6px; text-decoration: none; color: inherit; margin: 16px 0; overflow: hidden; background: white; transition: background 0.1s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
  <div style="padding: 12px 16px; flex: 1; min-width: 0;">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111827;">${bTitle}</div>
    <div style="font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bUrl}</div>
  </div>
  <div style="width: 48px; background: #f9fafb; display: flex; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb; color: #9ca3af;">
    <span style="font-size: 20px;">🔗</span>
  </div>
</a>\n\n`);
        break;

      case 'divider': output.push(`---\n\n`); break;
      case 'code': output.push(`\`\`\`${content.language}\n${text}\n\`\`\`\n\n`); break;
      case 'toggle':
        output.push(`\n<details>\n<summary>${text}</summary>\n\n${childrenMd}\n</details>\n\n`);
        break;
      default: if(text) output.push(`${indent}${text}\n\n`);
    }
  }
  return output.join("");
}

// [SVG 지원 이미지 다운로더 복구]
async function downloadImage(url, filepathWithoutExt) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    // 1. 헤더에서 확장자 감지
    const contentType = response.headers.get('content-type');
    let ext = '.png'; 

    if (contentType) {
        if (contentType.includes('svg')) ext = '.svg';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('png')) ext = '.png';
        else if (contentType.includes('gif')) ext = '.gif';
    } else {
        // 2. URL에서 확장자 감지
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

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

async function syncNotion() {
  try {
    console.log('🚀 Notion 동기화 시작 (Markdown 표 + SVG 복구)...');

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
      process.stdout.write(`.`); 
    } while (cursor);

    console.log(`\n✅ 총 ${allPages.length}개의 페이지 발견.\n`);

    for (const page of allPages) {
      try {
        const title = page.properties['제목']?.title?.map(t => t.plain_text).join("") || 'Untitled';
        const category = page.properties['카테고리']?.select?.name;
        const status = page.properties['상태']?.status?.name;

        if (status?.trim() !== '시작 전') continue;
        if (!category) continue;

        const categoryFolder = findFolderPath(DOCS_PATH, category);
        if (!categoryFolder) continue;

        console.log(`   📄 [변환] "${title}"`);

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
            // 확장자는 downloadImage 내부에서 결정되므로 이름만 전달
            const baseImagePath = path.join(IMAGES_PATH, `${safeTitleForImage}-${imageIndex}`);
            const savedFilename = await downloadImage(imageUrl, baseImagePath);
            
            if (savedFilename) {
                newMarkdown = newMarkdown.replace(imageUrl, `/images/${savedFilename}`);
                imageIndex++;
            }
        }
        markdown = newMarkdown;

        const frontmatter = `---\ntitle: ${title}\n---\n\n`;
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