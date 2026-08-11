import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const TEXT_EXTENSIONS = /\.(?:css|html|js|json|xml)$/i;
const SAFE_IMAGE_PATH = /^[A-Za-z0-9._/-]+$/;

function readDistPath() {
  const distArgumentIndex = process.argv.indexOf('--dist');
  if (distArgumentIndex === -1) return path.resolve('dist');

  const distPath = process.argv[distArgumentIndex + 1];
  if (!distPath) throw new Error('--dist 뒤에 빌드 디렉터리 경로가 필요함');
  return path.resolve(distPath);
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

const distPath = readDistPath();
const imagesPath = path.join(distPath, 'images');

if (!fs.existsSync(distPath)) throw new Error(`빌드 디렉터리를 찾을 수 없음: ${distPath}`);
if (!fs.existsSync(imagesPath)) throw new Error(`빌드 이미지 디렉터리를 찾을 수 없음: ${imagesPath}`);

const unsafeFiles = [];
for (const filePath of walk(imagesPath).filter((file) => IMAGE_EXTENSIONS.test(file))) {
  const relativePath = path.relative(imagesPath, filePath).split(path.sep).join('/');
  if (!SAFE_IMAGE_PATH.test(relativePath)) unsafeFiles.push(relativePath);
}

const unsafeReferences = new Set();
const missingReferences = new Set();
const escapedReferences = new Set();
let referenceCount = 0;
const referenceRegex = /\/images\/([^"'“”\s<>]+)/g;

for (const filePath of walk(distPath).filter((file) => TEXT_EXTENSIONS.test(file))) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(referenceRegex)) {
    const decodedReference = decodeUrlComponent(decodeHtmlEntities(match[1]));
    const imageMatch = decodedReference.match(/^(.*\.(?:avif|gif|jpe?g|png|svg|webp))(?:[?#].*)?$/i);
    if (!imageMatch) continue;

    referenceCount += 1;
    const imageReference = imageMatch[1];
    if (!SAFE_IMAGE_PATH.test(imageReference)) unsafeReferences.add(imageReference);

    const resolvedImagePath = path.resolve(imagesPath, imageReference);
    const relativeImagePath = path.relative(imagesPath, resolvedImagePath);
    if (relativeImagePath.startsWith('..') || path.isAbsolute(relativeImagePath)) {
      escapedReferences.add(imageReference);
    } else if (!fs.existsSync(resolvedImagePath)) {
      missingReferences.add(imageReference);
    }
  }
}

const errors = [];
if (unsafeFiles.length) {
  errors.push(`서버에 안전하지 않은 이미지 파일명 ${unsafeFiles.length}개:\n${unsafeFiles.slice(0, 20).join('\n')}`);
}
if (unsafeReferences.size) {
  errors.push(`서버에 안전하지 않은 이미지 참조 ${unsafeReferences.size}개:\n${[...unsafeReferences].slice(0, 20).join('\n')}`);
}
if (missingReferences.size) {
  errors.push(`존재하지 않는 이미지 참조 ${missingReferences.size}개:\n${[...missingReferences].slice(0, 20).join('\n')}`);
}
if (escapedReferences.size) {
  errors.push(`images 디렉터리를 벗어난 참조 ${escapedReferences.size}개:\n${[...escapedReferences].slice(0, 20).join('\n')}`);
}
if (errors.length) throw new Error(errors.join('\n\n'));

console.log(`✅ 독립 이미지 무결성 검사 완료 (${referenceCount}개 참조)`);
