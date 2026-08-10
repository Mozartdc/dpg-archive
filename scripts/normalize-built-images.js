import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const DIST_PATH = path.resolve('dist');
const DIST_IMAGES_PATH = path.join(DIST_PATH, 'images');

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizeBuiltImageNames() {
  if (!fs.existsSync(DIST_IMAGES_PATH)) return;

  let renamed = 0;
  for (const filename of fs.readdirSync(DIST_IMAGES_PATH)) {
    const normalizedFilename = filename.normalize('NFD');
    if (normalizedFilename === filename) continue;

    const sourcePath = path.join(DIST_IMAGES_PATH, filename);
    const targetPath = path.join(DIST_IMAGES_PATH, normalizedFilename);

    if (fs.existsSync(targetPath)) {
      const sourceStat = fs.statSync(sourcePath);
      const targetStat = fs.statSync(targetPath);

      // macOS 파일 시스템에서는 NFC와 NFD 경로가 같은 파일을 가리킬 수 있다.
      if (sourceStat.dev === targetStat.dev && sourceStat.ino === targetStat.ino) continue;
      if (sha256(sourcePath) !== sha256(targetPath)) {
        throw new Error(`이미지 파일명 정규화 충돌: ${filename}`);
      }
      fs.rmSync(sourcePath);
    } else {
      fs.renameSync(sourcePath, targetPath);
    }
    renamed++;
  }

  console.log(`🧹 빌드 이미지 파일명 정규화 완료 (${renamed}개)`);
}

function collectHtmlFiles(directoryPath, output = []) {
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(entryPath, output);
    else if (entry.name.endsWith('.html')) output.push(entryPath);
  }
  return output;
}

function verifyBuiltImageReferences() {
  const missing = new Set();
  // Astro는 파일명의 `&`를 HTML 속성에서 `&#x26;`로 직렬화한다.
  // `#`를 URL fragment 시작으로 간주해 중간에서 자르면 정상 파일을 누락으로 오인한다.
  const imageReferenceRegex = /\/images\/([^"'“”\s<>?]+)/g;

  for (const htmlPath of collectHtmlFiles(DIST_PATH)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    for (const match of html.matchAll(imageReferenceRegex)) {
      let filename = match[1]
        .replace(/&#x26;|&#38;|&amp;/gi, '&')
        .replace(/&#x27;|&#39;/gi, "'")
        .replace(/&quot;/gi, '"');
      try {
        filename = decodeURIComponent(filename);
      } catch {
        // 잘못 인코딩된 URL은 원문 그대로 검사한다.
      }
      if (!/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(filename)) continue;
      const normalizedFilename = filename.normalize('NFD');
      if (!fs.existsSync(path.join(DIST_IMAGES_PATH, normalizedFilename))) {
        missing.add(filename);
      }
    }
  }

  if (missing.size) {
    throw new Error(
      `빌드 결과에서 이미지 ${missing.size}개를 찾을 수 없음:\n${[...missing].slice(0, 20).join('\n')}`,
    );
  }

  console.log('✅ 빌드 이미지 참조 검증 완료');
}

normalizeBuiltImageNames();
verifyBuiltImageReferences();
