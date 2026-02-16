import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.NOTION_API_KEY;
const CHORDS_DATABASE_ID = '30926dfbcd7980668651c25ccaae5b7b'; // 노션 코드 DB ID

export async function syncChordsDB() {
  console.log('\n🎹 피아노 코드 DB 동기화 시작...');
  
  if (!API_KEY) {
    console.error('❌ NOTION_API_KEY가 없습니다.');
    return;
  }

  const chords = [];
  let hasMore = true;
  let startCursor = undefined;

  // 데이터 가져오기
  while (hasMore) {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${CHORDS_DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ start_cursor: startCursor, page_size: 100 })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.results) {
        for (const page of data.results) {
          const props = page.properties;
          
          const chord = {
            Code_name: getProperty(props, 'Code_name', 'title'),
            'Code-sub_name': getProperty(props, 'Code-sub_name', 'rich_text'),
            'Code_name_1': getProperty(props, 'Code_name 1', 'rich_text'),
            R: getProperty(props, 'R', 'rich_text'),
            alt: getProperty(props, 'alt', 'rich_text'),
            alternate: getProperty(props, 'alternate', 'rich_text'),
            alternate_S: getProperty(props, 'alternate_S', 'rich_text'),
            finger: getProperty(props, 'finger', 'rich_text'),
            fundamental: getProperty(props, 'fundamental', 'rich_text'),
            fundamental_S: getProperty(props, 'fundamental_S', 'rich_text'),
            key: getProperty(props, 'key', 'rich_text')
          };
          
          chords.push(chord);
        }
      }
      
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    } catch (error) {
      console.error('❌ 오류:', error.message);
      break;
    }
  }

  console.log(`✅ 총 ${chords.length}개 코드 가져옴`);

  // CSV 생성 (노션 순서대로)
  const headers = ['Code_name', 'Code-sub_name', 'Code_name 1', 'R', 'alt', 'alternate', 'alternate_S', 'finger', 'fundamental', 'fundamental_S', 'key'];
  let csv = headers.join(',') + '\n';
  
  for (const chord of chords) {
    const row = [
      escapeCsv(chord.Code_name),
      escapeCsv(chord['Code-sub_name']),
      escapeCsv(chord.Code_name_1),
      escapeCsv(chord.R),
      escapeCsv(chord.alt),
      escapeCsv(chord.alternate),
      escapeCsv(chord.alternate_S),
      escapeCsv(chord.finger),
      escapeCsv(chord.fundamental),
      escapeCsv(chord.fundamental_S),
      escapeCsv(chord.key)
    ];
    csv += row.join(',') + '\n';
  }

  // public/data 폴더에 저장
  const dataDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const csvPath = path.join(dataDir, 'chords.csv');
  fs.writeFileSync(csvPath, csv, 'utf-8');
  
  console.log(`💾 CSV 저장: ${csvPath}`);
  console.log('✨ 완료!\n');
}

function getProperty(props, name, type) {
  const prop = props[name];
  if (!prop) return '';
  
  switch (type) {
    case 'title':
      return prop.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text':
      return prop.rich_text?.map(t => t.plain_text).join('') || '';
    default:
      return '';
  }
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}