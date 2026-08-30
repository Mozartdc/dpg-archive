import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.NOTION_API_KEY;
const PIANO_DATABASE_ID = '30326dfbcd7980428fecc273e9b168c3';

export async function syncPianoDB() {
  console.log('\n🎹 피아노 스펙 DB 동기화 시작...');
  
  if (!API_KEY) {
    console.error('❌ NOTION_API_KEY가 없습니다.');
    return;
  }

  // 1단계: 노션 내보내기 CSV에서 컬럼 순서 학습
  let preferredOrder = [];
  const orderFilePath = path.join(__dirname, '..', 'public', 'data', 'notion-column-order.csv');
  
  if (fs.existsSync(orderFilePath)) {
    try {
      const orderCsv = fs.readFileSync(orderFilePath, 'utf-8');
      const firstLine = orderCsv.split('\n')[0];
      preferredOrder = firstLine
        .replace(/^\uFEFF/, '') // BOM 제거
        .split(',')
        .map(h => h.replace(/"/g, '').trim())
        .filter(Boolean);
      
      console.log(`📚 노션 순서 학습 완료 (${preferredOrder.length}개 컬럼)`);
    } catch (error) {
      console.log('⚠️  순서 파일 읽기 실패, API에서 자동 감지합니다.');
    }
  } else {
    console.log('💡 Tip: 노션에서 CSV를 내보내서 public/data/notion-column-order.csv에 저장하면');
    console.log('   노션 DB의 컬럼 순서를 자동으로 학습합니다!');
  }

  // 2단계: 데이터베이스 스키마 가져오기
  let columnNames = [];
  
  try {
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${PIANO_DATABASE_ID}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      const actualColumns = Object.keys(dbData.properties);
      
      if (preferredOrder.length > 0) {
        // 학습된 순서 사용
        const orderedColumns = preferredOrder.filter(col => actualColumns.includes(col));
        const newColumns = actualColumns.filter(col => !preferredOrder.includes(col)).sort();
        
        columnNames = [...orderedColumns, ...newColumns];
        
        if (newColumns.length > 0) {
          console.log(`🆕 새 컬럼 발견: ${newColumns.join(', ')}`);
          console.log(`💡 노션에서 CSV를 다시 내보내서 순서를 업데이트하세요.`);
        }
      } else {
        // 순서 정보 없음 - 알파벳순
        columnNames = actualColumns.sort();
        console.log('⚠️  컬럼 순서: 알파벳순 (노션 순서를 사용하려면 CSV를 저장하세요)');
      }
      
      console.log(`📋 컬럼 (${columnNames.length}개): ${columnNames.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ DB 스키마 조회 실패');
    return;
  }

  // 3단계: 데이터 가져오기
  const pianos = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${PIANO_DATABASE_ID}/query`, {
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
          
          const piano = {};
          for (const columnName of columnNames) {
            const value = getProperty(props, columnName);
            
            // 체크박스 → 이모지
            if (columnName === '오디오 I/F' && typeof value === 'boolean') {
              piano[columnName] = value ? '✅' : '❌';
            } else {
              piano[columnName] = value;
            }
          }
          
          pianos.push(piano);
        }
      }
      
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    } catch (error) {
      console.error('❌ 오류:', error.message);
      break;
    }
  }

  console.log(`✅ 총 ${pianos.length}개 모델 가져옴`);

  // 4단계: CSV 생성
  let csv = columnNames.join(',') + '\n';
  
  for (const piano of pianos) {
    const row = columnNames.map(col => escapeCsv(piano[col]));
    csv += row.join(',') + '\n';
  }

  // 5단계: 저장
  const dataDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const csvPath = path.join(dataDir, 'pianos.csv');
  fs.writeFileSync(csvPath, csv, 'utf-8');
  
  console.log(`💾 CSV 저장: ${csvPath}`);
  console.log('✨ 완료!\n');
}

function getProperty(props, name) {
  const prop = props[name];
  if (!prop) return '';
  
  switch (prop.type) {
    case 'title':
      return prop.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text':
      return prop.rich_text?.map(t => t.plain_text).join('') || '';
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map(o => o.name).join(', ') || '';
    case 'number':
      return prop.number || '';
    case 'checkbox':
      return prop.checkbox || false;
    case 'url':
      return prop.url || '';
    case 'status':
      return prop.status?.name || '';
    case 'date':
      return prop.date?.start || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'files':
      return prop.files?.[0]?.file?.url || prop.files?.[0]?.external?.url || '';
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
