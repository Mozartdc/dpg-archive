import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://dpg-archive.vercel.app',
  integrations: [
    starlight({
      title: '디지털 피아노 갤러리 아카이브',
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
      ],
    }),
  ],
});
