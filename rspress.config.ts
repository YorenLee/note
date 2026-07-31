import { defineConfig } from '@rspress/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'docs',
  lang: 'zh',
  title: 'Yoren 的技术笔记',
  description: '记录前端、后端、LLM、工程实践与运维知识',
  globalStyles: path.join(dirname, 'styles/index.css'),
  route: {
    exclude: ['**/superpowers/**'],
  },
  themeConfig: {
    enableContentAnimation: true,
    enableAppearanceAnimation: true,
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/YorenLee/note',
      },
    ],
  },
});
