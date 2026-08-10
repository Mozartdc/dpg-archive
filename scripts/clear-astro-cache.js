import fs from 'fs';
import path from 'path';

const cachePaths = [
  path.resolve('.astro'),
  path.resolve('node_modules/.astro'),
];

for (const cachePath of cachePaths) {
  fs.rmSync(cachePath, { recursive: true, force: true });
}
console.log('🧹 Astro 콘텐츠 캐시 초기화 완료');
