# Yoren 的技术笔记

基于 [Rspress](https://rspress.dev/) 构建的个人技术知识库，内容覆盖前端、后端、LLM、职场实践、运维与书单。

## 环境要求

- Node.js 20.19+、22.12+ 或更高版本
- pnpm 10

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器启动后，按终端输出的地址访问文档站。

## 构建与预览

```bash
pnpm build
pnpm preview
```

生产构建产物位于 `doc_build/`。

## 添加笔记

1. 在 `docs/` 下选择对应分类：
   - `01前端`
   - `02后端`
   - `03LLM`
   - `04职场实践`
   - `05运维`
   - `06书单`
2. 新建 Markdown 文件并使用清晰的一级标题。
3. 图片放在文章同级或分类内的 `assets/` 目录，使用相对路径引用。
4. Rspress 默认根据目录自动生成页面；需要控制侧边栏顺序或显示名称时，修改相应目录的 `_meta.json`。

站点顶部导航由 `docs/_nav.json` 管理，全局配置位于 `rspress.config.ts`，主题样式位于 `styles/index.css`。
