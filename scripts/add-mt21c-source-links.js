import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const docsRoot = path.join(
  projectRoot,
  'src',
  'content',
  'docs',
  '음악 이론',
  '21세기 음악이론 한글판',
);
const sourceIndexPath = process.argv[2];

if (!sourceIndexPath) {
  throw new Error('사용법: node scripts/add-mt21c-source-links.js /path/to/MusicTheory.html');
}

const sourceIndex = fs.readFileSync(sourceIndexPath, 'utf8');
const sourceBySection = new Map();
const tocLinkPattern = /<a href="([^"#]+\.html)(?:#[^"]*)?" class="internal"><span class="codenumber">([^<]+)<\/span>/g;

for (const match of sourceIndex.matchAll(tocLinkPattern)) {
  const [, href, section] = match;
  if (!sourceBySection.has(section)) sourceBySection.set(section, href);
}

function collectDocuments(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectDocuments(entryPath, output);
    else if (/\.mdx?$/i.test(entry.name)) output.push(entryPath);
  }
  return output;
}

function insertBeforeTrailingDivider(markdown, block) {
  const trailingDivider = /\n---\s*$/;
  if (trailingDivider.test(markdown)) {
    return markdown.replace(trailingDivider, `\n\n${block}\n\n---\n`);
  }
  return `${markdown.trimEnd()}\n\n${block}\n`;
}

let updated = 0;
const missingSections = [];

for (const documentPath of collectDocuments(docsRoot)) {
  const markdown = fs.readFileSync(documentPath, 'utf8');
  const title = markdown.match(/^title:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
  const section = title?.match(/^(\d+(?:\.\d+)+)/)?.[1];
  if (!section) continue;

  const sourceFile = sourceBySection.get(section);
  if (!sourceFile) {
    missingSections.push(`${section}\t${path.relative(docsRoot, documentPath)}`);
    continue;
  }

  const sourceUrl = `https://musictheory.pugetsound.edu/mt21c/${sourceFile}`;
  if (markdown.includes(sourceUrl)) continue;

  const sourceCard = `<a href="${sourceUrl}" target="_blank" class="mt21c-source-link">\n  <strong>🔗 원문 ${section}</strong>\n  <span>${sourceUrl}</span>\n</a>`;
  fs.writeFileSync(documentPath, insertBeforeTrailingDivider(markdown, sourceCard));
  updated += 1;
}

console.log(`원문 링크 추가: ${updated}개`);
if (missingSections.length) {
  console.log(`원문 목차에서 찾지 못함: ${missingSections.length}개`);
  console.log(missingSections.join('\n'));
}
