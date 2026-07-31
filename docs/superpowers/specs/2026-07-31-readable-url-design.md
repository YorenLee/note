# Rspress 可读 URL 设计

## 目标

将由中文目录和文件名生成的百分号编码 URL 改为简洁、可分享的英文语义路径，同时保持站点导航、侧边栏和文章标题为中文。

示例：

```text
/01前端/02Css/01基础/选择器.html
→ /frontend/css/basics/selectors
```

## 路由策略

Rspress 使用文件系统生成路由，因此直接将用户内容目录和 Markdown 文件改为英文 kebab-case slug。一级分类固定映射为：

| 中文分类 | 路径 |
| --- | --- |
| 前端 | `frontend` |
| 后端 | `backend` |
| LLM | `llm` |
| 职场实践 | `workplace` |
| 运维 | `devops` |
| 书单 | `reading` |

深层目录采用常见技术名称或简短英文含义，例如：

- `前端工程化` → `engineering`
- `01基础` → `basics`
- `花里胡哨` → `creative`
- `02WebAPI` → `web-api`
- `01概述` → `overview`
- `02Modal IO` → `model-io`
- `03 chain` → `chains`
- `04memory` → `memory`
- `05tools` → `tools`
- `06agent` → `agents`
- `07Retrieval` → `retrieval`

文件名移除数字排序前缀，转换为能够描述内容的英文 kebab-case。技术专有名词使用社区常见拼写，例如 `bfcache`、`send-beacon`、`prompt-template`、`docker`、`redis`。

## 中文显示名称

文件与目录名称只负责 URL。以下内容继续使用中文：

- Markdown 的 H1 或 frontmatter `title`
- `_nav.json` 的顶部导航标签
- `_meta.json` 的侧边栏标签
- 首页分类卡片

缺少 H1 的既有文章补充 frontmatter `title`，不为了路由重写正文。

## 链接与资源

- 更新 `_nav.json`、所有 `_meta.json` 和分类首页中的站内链接。
- 扫描全部 Markdown 标准链接，更新指向被重命名文件的相对路径。
- 文章同目录 `assets/` 随所属目录移动；图片文件本身仅在名称含中文或空格时改为 kebab-case。
- 外部 URL、标题锚点与代码示例不改动。
- `docs/superpowers/` 为内部资料且已排除路由，不参与 slug 重命名。

## Clean URL

在 `rspress.config.ts` 中设置：

```ts
route: {
  cleanUrls: true,
  exclude: ['**/superpowers/**'],
}
```

本地开发访问路径不再包含 `.html`。部署目标必须支持把 `/foo` 映射到 `/foo.html`；如果未来托管平台不支持该行为，应关闭 `cleanUrls`，英文 slug 本身仍然保留。

## 验证

1. 重命名前生成旧路径到新路径的完整映射表。
2. 批量移动后检查不存在中文或空格形式的用户页面路径。
3. 运行 `pnpm build`，要求退出码为 0，依靠 Rspress 的死链检查发现遗漏引用。
4. 检查产物包含代表性路由：
   - `frontend/css/basics/selectors.html`
   - `frontend/engineering/webpack/core-concepts.html`
   - `llm/langchain/retrieval/retrieval.html`
   - `devops/docker.html`
5. 本地浏览器检查首页导航、深层侧边栏、前后页跳转、搜索结果和本地图片。
6. 确认主工作区的 `.obsidian/workspace.json` 未被修改或提交。

## 非目标

- 不为旧中文 URL 增加重定向。
- 不翻译文章正文或中文标题。
- 不更改外部链接。
- 不在本次变更中配置具体部署平台。
