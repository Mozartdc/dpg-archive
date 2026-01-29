import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: '디지털 피아노 갤러리 아카이브', // 사이드바 상단에 표시될 사이트 제목
      sidebar: [
        {
          label: '카테고리 전체', // 메뉴 묶음의 대표 이름
          autogenerate: { directory: '' }, // docs 폴더 내 모든 하위 폴더를 자동으로 메뉴화
        },
      ],
    }),
  ],
});