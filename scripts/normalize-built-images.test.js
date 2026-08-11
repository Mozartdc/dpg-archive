import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const normalizeScript = path.join(projectRoot, 'scripts', 'normalize-built-images.js');
const verifyScript = path.join(projectRoot, 'scripts', 'verify-built-images.js');

function run(scriptPath, distPath) {
  return spawnSync(process.execPath, [scriptPath, '--dist', distPath], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function createDist() {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dpg-image-paths-'));
  const distPath = path.join(rootPath, 'dist');
  fs.mkdirSync(path.join(distPath, 'images'), { recursive: true });
  return { rootPath, distPath };
}

test('NFD 이미지 파일명과 NFC 참조를 같은 안전한 경로로 변환함', (context) => {
  const { rootPath, distPath } = createDist();
  context.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));

  const nfcFilename = '피아노.png';
  const nfdFilename = nfcFilename.normalize('NFD');
  fs.writeFileSync(path.join(distPath, 'images', nfdFilename), 'not-a-real-png');
  fs.writeFileSync(
    path.join(distPath, 'index.html'),
    `<img src="/images/${nfcFilename}"><img src="/images/${encodeURIComponent(nfcFilename)}">`,
  );

  const normalized = run(normalizeScript, distPath);
  assert.equal(normalized.status, 0, normalized.stderr);

  const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
  const references = [...html.matchAll(/\/images\/([^"']+)/g)].map((match) => match[1]);
  assert.equal(references.length, 2);
  assert.equal(new Set(references).size, 1);
  assert.match(references[0], /^image-[a-f0-9]{24}\.png$/);
  assert.deepEqual(fs.readdirSync(path.join(distPath, 'images')), [references[0]]);

  const verified = run(verifyScript, distPath);
  assert.equal(verified.status, 0, verified.stderr);
});

test('존재하지 않는 이미지 참조가 있으면 검사를 실패시킴', (context) => {
  const { rootPath, distPath } = createDist();
  context.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));

  fs.writeFileSync(path.join(distPath, 'images', 'present.png'), 'not-a-real-png');
  fs.writeFileSync(path.join(distPath, 'index.html'), '<img src="/images/missing.png">');

  const verified = run(verifyScript, distPath);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /존재하지 않는 이미지 참조 1개/);
});

test('참조되지 않아도 비 ASCII 이미지 파일명이 남으면 검사를 실패시킴', (context) => {
  const { rootPath, distPath } = createDist();
  context.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));

  fs.writeFileSync(path.join(distPath, 'images', '한글.png'), 'not-a-real-png');
  fs.writeFileSync(path.join(distPath, 'index.html'), '<p>image fixture</p>');

  const verified = run(verifyScript, distPath);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /서버에 안전하지 않은 이미지 파일명 1개/);
});
