import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { starlightKatex } from 'starlight-katex';

export default defineConfig({
  site: 'https://www.dpinside.org',
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
          autogenerate: { directory: '디지털 피아노' }
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
