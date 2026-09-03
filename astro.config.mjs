import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { starlightKatex } from 'starlight-katex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug as githubSlug } from 'github-slugger';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const purchaseGuideRoot = path.join(
  projectRoot,
  'src',
  'content',
  'docs',
  '디지털 피아노',
  '디지털 피아노 구매 · 추천 가이드',
);
const purchaseGuideRouteRoot = `/디지털-피아노/${githubSlug('디지털 피아노 구매 · 추천 가이드')}`;
const brandReviewRoot = path.join(
  purchaseGuideRoot,
  '5. 브랜드별 스펙 및 리뷰',
);
const brandReviewRouteRoot = `${purchaseGuideRouteRoot}/${githubSlug('5. 브랜드별 스펙 및 리뷰')}`;

function purchaseGuideDocument(section, filename, label = filename) {
  return {
    label,
    link: `${purchaseGuideRouteRoot}/${githubSlug(section)}/${githubSlug(filename)}/`,
  };
}

function collectBrandReviewRedirects(directory = brandReviewRoot, redirects = {}) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectBrandReviewRedirects(entryPath, redirects);
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name)) continue;

    const relativeDocumentPath = path
      .relative(brandReviewRoot, entryPath)
      .replace(/\.mdx?$/i, '');
    const routeSuffix = relativeDocumentPath
      .split(path.sep)
      .map((segment) => githubSlug(segment.normalize('NFC')))
      .filter(Boolean)
      .join('/');

    const target = `${brandReviewRouteRoot}/${routeSuffix}`;
    redirects[`/디지털-피아노/디지털피아노-추천/브랜드별-스펙-및-리뷰/${routeSuffix}`] = target;
    redirects[`/디지털-피아노/브랜드별-스펙-및-리뷰/${routeSuffix}`] = target;
  }
  return redirects;
}

const brandReviewRedirects = collectBrandReviewRedirects();

function collectPurchaseGuideRedirects(directory = purchaseGuideRoot, redirects = {}) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectPurchaseGuideRedirects(entryPath, redirects);
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name)) continue;

    const routeSuffix = path
      .relative(purchaseGuideRoot, entryPath)
      .replace(/\.mdx?$/i, '')
      .split(path.sep)
      .map((segment) => githubSlug(segment.normalize('NFC')))
      .filter(Boolean)
      .join('/');

    redirects[`/디지털-피아노/${routeSuffix}`] = `${purchaseGuideRouteRoot}/${routeSuffix}`;
  }
  return redirects;
}

const purchaseGuideRedirects = collectPurchaseGuideRedirects();

const theoryChapterRelocations = [
  ['08장. 세븐스 코드', '08장. 7화음'],
  ['13장. 프레이즈의 결합', '13장. 악구의 결합'],
  ['16장. 피겨드 베이스', '16장. 통주저음'],
  ['17장. 세컨더리 도미넌트 코드', '17장. 세컨더리 도미넌트 화음'],
  ['18장. 세컨더리 디미니시드 코드', '18장. 세컨더리 디미니시드 화음'],
  ['19장. 모드 믹스처', '19장. 장단조 병용'],
  ['33장. 집합 이론', '33장. 집합이론'],
];

function collectTheoryChapterRedirects() {
  const redirects = {};
  const theoryRoot = path.join(projectRoot, 'src', 'content', 'docs', '음악 이론', '21세기 음악이론 한글판');

  for (const [oldChapter, newChapter] of theoryChapterRelocations) {
    const chapterRoot = path.join(theoryRoot, newChapter);
    for (const entry of fs.readdirSync(chapterRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.mdx?$/i.test(entry.name)) continue;
      const pageSlug = githubSlug(entry.name.replace(/\.mdx?$/i, '').normalize('NFC'));
      const oldRoute = `/음악-이론/open-music-theory/${githubSlug(oldChapter)}/${pageSlug}`;
      const newRoute = `/음악-이론/21세기-음악이론-한글판/${githubSlug(newChapter)}/${pageSlug}`;
      redirects[oldRoute] = newRoute;
    }
  }
  return redirects;
}

const theoryChapterRedirects = collectTheoryChapterRedirects();

export default defineConfig({
  site: 'https://www.dpinside.org',
  redirects: {
    ...purchaseGuideRedirects,
    ...brandReviewRedirects,
    ...theoryChapterRedirects,
  },
  integrations: [
    react(),
    starlight({
      title: '디지털 피아노 갤러리 아카이브',
      locales: {
        root: {
          label: '한국어',
          lang: 'ko-KR',
        },
      },
      plugins: [starlightKatex()],
      components: {
        Head: './src/components/Head.astro',
        Pagination: './src/components/Pagination.astro',
      },
      customCss: [
        './src/styles/global.css',
      ],
      sidebar: [
        {
          label: '디지털 피아노',
          collapsed: true,
          items: [
            {
              label: '디지털 피아노 구매 / 추천 가이드',
              collapsed: true,
              items: [
                {
                  label: '1. 디지털 피아노와 그랜드 피아노',
                  items: [
                    {
                      label: '1). 디지털 피아노의 타건감',
                      items: [
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '그랜드 피아노의 해머액션'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '1. 건반 무게와 타건감'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '2. 건반의 전체 길이  피벗 길이와 타건감', '2. 건반의 전체 길이 / 피벗 길이와 타건감'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '3. 디지털 피아노의 해머 액션과 타건감'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '4. 키베드의 구조와 타건감'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '5. 센서의 구조와 타건감'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '6. 음원, 인지와 타건감'),
                      ],
                    },
                    {
                      label: '2) 디지털 피아노의 음원',
                      items: [
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '1. 디지털 피아노 음원 제작 방식'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '2. 배음(harmonics)'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '3. 공명(resonance)'),
                        purchaseGuideDocument('1. 디지털 피아노와 그랜드 피아노', '4. 샘플링과 모델링 믹싱'),
                      ],
                    },
                  ]
                },
                {
                  label: '2. 디지털 피아노와 키보드',
                  autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/2. 디지털 피아노와 키보드' }
                },
                {
                  label: '3. 디지털 피아노의 형태',
                  autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/3. 디지털 피아노의 형태' }
                },
                {
                  label: '4. 타건감과 음원 외 디지털 피아노 선택 요소',
                  autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/4. 타건감과 음원 외 디지털 피아노 선택 요소' }
                },
                {
                  label: '5. 브랜드별 스펙 및 리뷰',
                  items: [
                    purchaseGuideDocument('5. 브랜드별 스펙 및 리뷰', '브랜드 모델별 디지털 피아노 비교'),
                    {
                      label: '카시오',
                      autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/5. 브랜드별 스펙 및 리뷰/카시오' },
                    },
                    {
                      label: '코르그',
                      autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/5. 브랜드별 스펙 및 리뷰/코르그' },
                    },
                    {
                      label: '야마하',
                      autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/5. 브랜드별 스펙 및 리뷰/야마하' },
                    },
                    {
                      label: '롤랜드',
                      autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/5. 브랜드별 스펙 및 리뷰/롤랜드' },
                    },
                    {
                      label: '가와이',
                      autogenerate: { directory: '디지털 피아노/디지털 피아노 구매 · 추천 가이드/5. 브랜드별 스펙 및 리뷰/가와이' },
                    },
                  ]
                },
              ]
            },
            {
              label: '연결 및 홈 스튜디오 구성',
              autogenerate: { directory: '디지털 피아노/디지털 피아노 연결흐름과 개념' }
            },
            {
              label: '매뉴얼 모음',
              autogenerate: { directory: '디지털 피아노/매뉴얼 모음' }
            },
            {
              label: '디지털 피아노 찾기',
              link: '/디지털-피아노/piano-finder/'
            },
          ]
        },
        {
          label: '가상 악기',
          collapsed: true,
          autogenerate: { directory: '가상 악기' }
        },
        {
          label: '음악 이론',
          collapsed: true,
          autogenerate: { directory: '음악 이론' }
        },
        {
          label: '피아노 연습',
          collapsed: true,
          autogenerate: { directory: '피아노 연습' }
        },
        {
          label: '음악 이야기',
          collapsed: true,
          autogenerate: { directory: '음악 이야기' }
        },
        {
          label: '개인정보 및 추적 기술 안내',
          link: '/privacy/'
        },
      ],
    }),
  ],
});
