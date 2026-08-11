import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const DIST_PATH = path.resolve('dist');
const DIST_IMAGES_PATH = path.join(DIST_PATH, 'images');
const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walk(directoryPath, output = []) {
  if (!fs.existsSync(directoryPath)) return output;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) walk(entryPath, output);
    else output.push(entryPath);
  }
  return output;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function decodeUrlComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildSafeImageMap() {
  if (!fs.existsSync(DIST_IMAGES_PATH)) return new Map();

  const imageMap = new Map();
  let renamed = 0;
  let deduplicated = 0;

  for (const filename of fs.readdirSync(DIST_IMAGES_PATH)) {
    const sourcePath = path.join(DIST_IMAGES_PATH, filename);
    if (!fs.statSync(sourcePath).isFile() || !IMAGE_EXTENSIONS.test(filename)) continue;

    const isServerSafe = /^[A-Za-z0-9._-]+$/.test(filename);
    const extension = path.extname(filename).toLowerCase();
    const safeFilename = isServerSafe
      ? filename
      : `image-${sha256(sourcePath).slice(0, 24)}${extension}`;
    const normalizedKey = filename.normalize('NFC');
    const previousTarget = imageMap.get(normalizedKey);

    if (previousTarget && previousTarget !== safeFilename) {
      throw new Error(`서로 다른 이미지가 같은 유니코드 파일명으로 정규화됨: ${filename}`);
    }
    imageMap.set(normalizedKey, safeFilename);

    if (safeFilename === filename) continue;

    const targetPath = path.join(DIST_IMAGES_PATH, safeFilename);
    if (fs.existsSync(targetPath)) {
      if (sha256(sourcePath) !== sha256(targetPath)) {
        throw new Error(`이미지 해시 파일명 충돌: ${filename}`);
      }
      fs.rmSync(sourcePath);
      deduplicated += 1;
    } else {
      fs.renameSync(sourcePath, targetPath);
      renamed += 1;
    }
  }

  console.log(`🧹 빌드 이미지 안전 파일명 변환 완료 (변경 ${renamed}개, 중복 제거 ${deduplicated}개)`);
  return imageMap;
}

function rewriteBuiltImageReferences(imageMap) {
  let rewrittenFiles = 0;
  let rewrittenReferences = 0;
  const referenceRegex = /\/images\/([^"'“”\s<>]+)/g;

  for (const filePath of walk(DIST_PATH).filter((file) => /\.(?:css|html|js|json|xml)$/i.test(file))) {
    const source = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    const rewritten = source.replace(referenceRegex, (full, encodedReference) => {
      const decodedReference = decodeUrlComponent(decodeHtmlEntities(encodedReference));
      const extensionMatch = decodedReference.match(/^(.*\.(?:avif|gif|jpe?g|png|svg|webp))([?#].*)?$/i);
      if (!extensionMatch) return full;

      const [, filename, suffix = ''] = extensionMatch;
      const safeFilename = imageMap.get(filename.normalize('NFC'));
      if (!safeFilename || safeFilename === filename) return full;

      changed = true;
      rewrittenReferences += 1;
      return `/images/${safeFilename}${suffix}`;
    });

    if (changed) {
      fs.writeFileSync(filePath, rewritten);
      rewrittenFiles += 1;
    }
  }

  console.log(`🔗 빌드 이미지 참조 변경 완료 (${rewrittenFiles}개 파일, ${rewrittenReferences}개 참조)`);
}

function verifyBuiltImageReferences() {
  const missing = new Set();
  const referenceRegex = /\/images\/([^"'“”\s<>]+)/g;

  for (const filePath of walk(DIST_PATH).filter((file) => /\.(?:css|html|js|json|xml)$/i.test(file))) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(referenceRegex)) {
      const decodedReference = decodeUrlComponent(decodeHtmlEntities(match[1]));
      const extensionMatch = decodedReference.match(/^(.*\.(?:avif|gif|jpe?g|png|svg|webp))(?:[?#].*)?$/i);
      if (!extensionMatch) continue;

      const filename = extensionMatch[1];
      if (!fs.existsSync(path.join(DIST_IMAGES_PATH, filename))) missing.add(filename);
    }
  }

  if (missing.size) {
    throw new Error(
      `빌드 결과에서 이미지 ${missing.size}개를 찾을 수 없음:\n${[...missing].slice(0, 20).join('\n')}`,
    );
  }

  console.log('✅ 빌드 이미지 참조 검증 완료');
}

const imageMap = buildSafeImageMap();
rewriteBuiltImageReferences(imageMap);
verifyBuiltImageReferences();
