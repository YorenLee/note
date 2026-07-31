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
   - `frontend`
   - `backend`
   - `llm`
   - `workplace`
   - `devops`
   - `reading`
2. 使用小写英文 kebab-case 新建 Markdown 文件，例如 `core-concepts.md`；不要再添加 `01`、`02` 等排序前缀。
3. 使用中文一级标题或 frontmatter `title` 控制页面显示名称。
4. 图片放在文章同级或分类内的 `assets/` 目录，使用相对路径引用。
5. 页面顺序和侧边栏显示名称统一由相应目录的 `_meta.json` 管理。

站点顶部导航由 `docs/_nav.json` 管理，全局配置位于 `rspress.config.ts`，主题样式位于 `styles/index.css`。
