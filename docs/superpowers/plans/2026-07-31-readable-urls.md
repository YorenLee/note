# Readable Rspress URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace percent-encoded Chinese Rspress routes with stable English kebab-case URLs while keeping all visible labels and titles in Chinese.

**Architecture:** Rename the six routed content trees and every Markdown route file to English slugs, then update declarative navigation and relative links to match. Keep colocated assets with their articles, enable clean URLs, and use Rspress's full build plus browser checks as the dead-link and rendering gate.

**Tech Stack:** Rspress 2.0.19, Node.js, pnpm, Markdown, JSON navigation metadata, TypeScript config.

## Global Constraints

- Preserve article bodies except for internal link targets and missing display-title metadata.
- Keep Chinese navbar, sidebar, homepage, and article titles.
- Use lowercase kebab-case for every routed directory and Markdown filename.
- Remove numeric ordering prefixes from every routed directory and Markdown filename; `_meta.json` is the only source of display order.
- Do not rename `docs/superpowers/`; it is excluded from routes.
- Do not alter external URLs, heading anchors, fenced code examples, or the main workspace's `.obsidian/workspace.json`.
- Production verification requires `pnpm build` to exit with code 0.

---

### Task 1: Define and apply the complete route mapping

**Files:**
- Move: all routed files below `docs/01前端` through `docs/06书单`
- Create temporarily: `/tmp/rspress-route-map.tsv`

**Interfaces:**
- Produces: English-only route paths consumed by Rspress and metadata tasks.
- Produces: a two-column old/new mapping used to update links.

- [ ] **Step 1: Record the mapping**

Create `/tmp/rspress-route-map.tsv` with exact old and new paths:

```text
docs/01前端	docs/frontend
docs/01前端/01Html	docs/frontend/html
docs/01前端/01Html/01.Svg.md	docs/frontend/html/svg.md
docs/01前端/02Css	docs/frontend/css
docs/01前端/02Css/01.基础.md	docs/frontend/css/index.md
docs/01前端/02Css/01基础	docs/frontend/css/basics
docs/01前端/02Css/01基础/滚动条.md	docs/frontend/css/basics/scrollbars.md
docs/01前端/02Css/01基础/选择器.md	docs/frontend/css/basics/selectors.md
docs/01前端/02Css/花里胡哨	docs/frontend/css/creative
docs/01前端/02Css/花里胡哨/Scrollytelling.md	docs/frontend/css/creative/scrollytelling.md
docs/01前端/03JavaScript	docs/frontend/javascript
docs/01前端/03JavaScript/02WebAPI	docs/frontend/javascript/web-api
docs/01前端/03JavaScript/02WebAPI/01Navigator-sendBeacon.md	docs/frontend/javascript/web-api/send-beacon.md
docs/01前端/03JavaScript/02WebAPI/02bfcache.md	docs/frontend/javascript/web-api/bfcache.md
docs/01前端/05TypeScript	docs/frontend/typescript
docs/01前端/05TypeScript/readme.md	docs/frontend/typescript/index.md
docs/01前端/05TypeScript/01 基础.md	docs/frontend/typescript/basics.md
docs/01前端/05TypeScript/02 泛型.md	docs/frontend/typescript/generics.md
docs/01前端/05TypeScript/03 装饰器.md	docs/frontend/typescript/decorators.md
docs/01前端/前端工程化	docs/frontend/engineering
docs/01前端/前端工程化/monorepo架构.md	docs/frontend/engineering/monorepo.md
docs/01前端/前端工程化/编译和构建.md	docs/frontend/engineering/compilation-and-build.md
docs/01前端/前端工程化/webpack/README.md	docs/frontend/engineering/webpack/index.md
docs/01前端/前端工程化/webpack/01核心概念.md	docs/frontend/engineering/webpack/core-concepts.md
docs/01前端/前端工程化/webpack/02  configuration	docs/frontend/engineering/webpack/configuration
docs/01前端/前端工程化/webpack/02  configuration/01 output.md	docs/frontend/engineering/webpack/configuration/output.md
docs/01前端/前端工程化/webpack/02  configuration/02 module.md	docs/frontend/engineering/webpack/configuration/module.md
docs/01前端/前端工程化/webpack/02  configuration/03 resolve.md	docs/frontend/engineering/webpack/configuration/resolve.md
docs/01前端/前端工程化/webpack/02  configuration/04 optimazation.md	docs/frontend/engineering/webpack/configuration/optimization.md
docs/01前端/前端工程化/webpack/02  configuration/05 cache.md	docs/frontend/engineering/webpack/configuration/cache.md
docs/01前端/前端工程化/webpack/02  configuration/06 devtool & extends & target & watch.md	docs/frontend/engineering/webpack/configuration/devtool-extends-target-watch.md
docs/01前端/前端工程化/webpack/02  configuration/07 externals.md	docs/frontend/engineering/webpack/configuration/externals.md
docs/01前端/前端工程化/webpack/02  configuration/08 dotenv.md	docs/frontend/engineering/webpack/configuration/dotenv.md
docs/01前端/前端工程化/webpack/02  configuration/09 stats.md	docs/frontend/engineering/webpack/configuration/stats.md
docs/02后端	docs/backend
docs/02后端/ElasticSearch.md	docs/backend/elasticsearch.md
docs/02后端/Nacos.md	docs/backend/nacos.md
docs/02后端/Redis.md	docs/backend/redis.md
docs/03LLM	docs/llm
docs/03LLM/LangChain	docs/llm/langchain
docs/03LLM/LangChain/01入门.md	docs/llm/langchain/getting-started.md
docs/03LLM/LangChain/01概述	docs/llm/langchain/overview
docs/03LLM/LangChain/01概述/01架构设计.md	docs/llm/langchain/overview/architecture.md
docs/03LLM/LangChain/01概述/02应用开发场景.md	docs/llm/langchain/overview/use-cases.md
docs/03LLM/LangChain/01概述/03核心组件.md	docs/llm/langchain/overview/core-components.md
docs/03LLM/LangChain/02Modal IO	docs/llm/langchain/model-io
docs/03LLM/LangChain/02Modal IO/01调用模型1.md	docs/llm/langchain/model-io/calling-models-1.md
docs/03LLM/LangChain/02Modal IO/02调用模型2.md	docs/llm/langchain/model-io/calling-models-2.md
docs/03LLM/LangChain/02Modal IO/03PromptTemplate.md	docs/llm/langchain/model-io/prompt-template.md
docs/03LLM/LangChain/02Modal IO/04ChatPromptTemplate.md	docs/llm/langchain/model-io/chat-prompt-template.md
docs/03LLM/LangChain/02Modal IO/05 输出解析器.md	docs/llm/langchain/model-io/output-parsers.md
docs/03LLM/LangChain/02模版工程.md	docs/llm/langchain/template-project.md
docs/03LLM/LangChain/03 chain	docs/llm/langchain/chains
docs/03LLM/LangChain/03 chain/01chains使用.md	docs/llm/langchain/chains/usage.md
docs/03LLM/LangChain/03 chain/02传统chain的使用.md	docs/llm/langchain/chains/legacy-chains.md
docs/03LLM/LangChain/03 chain/03 基于LCEL构建的chains.md	docs/llm/langchain/chains/lcel.md
docs/03LLM/LangChain/03记忆系统与对话管理.md	docs/llm/langchain/memory-and-conversation.md
docs/03LLM/LangChain/04 Callback机制与事件驱动架构.md	docs/llm/langchain/callbacks.md
docs/03LLM/LangChain/04memory	docs/llm/langchain/memory
docs/03LLM/LangChain/04memory/01基本Memory使用.md	docs/llm/langchain/memory/basics.md
docs/03LLM/LangChain/04memory/02其他Memory模块.md	docs/llm/langchain/memory/other-modules.md
docs/03LLM/LangChain/05tools	docs/llm/langchain/tools
docs/03LLM/LangChain/05tools/01tools.md	docs/llm/langchain/tools/usage.md
docs/03LLM/LangChain/06Vector向量化技术与语义搜索.md	docs/llm/langchain/vector-search.md
docs/03LLM/LangChain/06agent	docs/llm/langchain/agents
docs/03LLM/LangChain/06agent/agent概念以及基础使用.md	docs/llm/langchain/agents/basics.md
docs/03LLM/LangChain/07Retrieval	docs/llm/langchain/retrieval
docs/03LLM/LangChain/07Retrieval/01Retrieval.md	docs/llm/langchain/retrieval/retrieval.md
docs/04职场实践	docs/workplace
docs/04职场实践/大型 MR 拆分指南：为什么以及怎么做.md	docs/workplace/splitting-large-merge-requests.md
docs/04职场实践/Next.js 容器镜像选择规范.md	docs/workplace/nextjs-container-image-guidelines.md
docs/05运维	docs/devops
docs/05运维/Linux.md	docs/devops/linux.md
docs/05运维/Docker.md	docs/devops/docker.md
docs/05运维/CICD.md	docs/devops/ci-cd.md
docs/06书单	docs/reading
docs/06书单/00 待看书单.md	docs/reading/reading-list.md
docs/06书单/01软技能：代码之外的生存指南.md	docs/reading/soft-skills.md
```

Top-level `index.md`, `_meta.json`, and `assets/` paths follow their renamed parent directory. Image filenames already use safe ASCII names except `adf1b5dd-7ccd-4158-ac8f-4cb8f5dcd387.png`, which remains unchanged.

- [ ] **Step 2: Apply leaf-first moves**

Use a small shell loop that reads the mapping in reverse order, creates each target parent, and runs `mv "$old" "$new"` only when the source exists. File mappings run before directory mappings so no target is resolved against a path already moved.

- [ ] **Step 3: Verify filenames**

Run:

```bash
find docs/frontend docs/backend docs/llm docs/workplace docs/devops docs/reading \
  -type f -name '*.md' -print |
grep -E '[[:space:]]|[一-龥]'
```

Expected: no output.

Also run:

```bash
find docs/frontend docs/backend docs/llm docs/workplace docs/devops docs/reading \
  -mindepth 1 \( -type d -o -name '*.md' \) -print |
grep -E '/[0-9]{2}([._ -]|[A-Z])'
```

Expected: no output; numeric ordering is represented only in `_meta.json`.

### Task 2: Restore Chinese navigation and update internal links

**Files:**
- Modify: `docs/_nav.json`
- Modify: all six top-level `_meta.json` files
- Modify: category `index.md` files
- Modify only when matched: Markdown files with relative links to renamed pages
- Modify: `rspress.config.ts`

**Interfaces:**
- Consumes: English filesystem paths from Task 1.
- Produces: Chinese UI labels and extensionless route links.

- [ ] **Step 1: Update top navigation**

Use these route links while keeping the existing Chinese `text` values:

```json
[
  { "text": "首页", "link": "/" },
  { "text": "前端", "link": "/frontend/" },
  { "text": "后端", "link": "/backend/" },
  { "text": "LLM", "link": "/llm/" },
  { "text": "职场实践", "link": "/workplace/" },
  { "text": "运维", "link": "/devops/" },
  { "text": "书单", "link": "/reading/" }
]
```

- [ ] **Step 2: Rewrite sidebar metadata**

Update every `_meta.json` `name` field to its actual English basename while preserving or improving its Chinese `label`. Create nested `_meta.json` files for `frontend`, `llm/langchain`, and their child directories where automatic labels would otherwise display English slugs.

- [ ] **Step 3: Update Markdown links**

Use the mapping to replace category-index relative links with their new targets. Inventory all other local Markdown links:

```bash
grep -RIn --include='*.md' -E '\]\((\./|\.\./|/)[^)]+\.md([)#?]|$)' \
  docs/frontend docs/backend docs/llm docs/workplace docs/devops docs/reading
```

For each match, resolve the old target against the source file, find its new path in the mapping, and replace only the link destination. Do not edit external links or fenced examples.

- [ ] **Step 4: Enable clean URLs**

Add `cleanUrls: true` beside the existing `route.exclude` in `rspress.config.ts`.

- [ ] **Step 5: Ensure display titles**

For routed Markdown files without an H1 or frontmatter `title`, add a Chinese `title` in frontmatter. Do not add duplicate visible H1 headings.

### Task 3: Build and repair route integrity

**Files:**
- Modify only: metadata or Markdown files named by build errors.

**Interfaces:**
- Consumes: renamed routes and updated links from Tasks 1–2.
- Produces: a zero-error production build.

- [ ] **Step 1: Run the complete build**

Run: `pnpm build`

Expected: exit 0. If dead-link or metadata errors name a file, correct only that exact path and rerun the full build.

- [ ] **Step 2: Verify representative products**

Run:

```bash
test -f doc_build/frontend/css/basics/selectors.html
test -f doc_build/frontend/engineering/webpack/core-concepts.html
test -f doc_build/llm/langchain/retrieval/retrieval.html
test -f doc_build/devops/docker.html
find doc_build/static/image -type f -name 'cache-stack*' -o -name 'langchain*'
```

Expected: every route file and both representative image families exist.

- [ ] **Step 3: Verify no encoded user routes remain**

Run:

```bash
find doc_build -type f -name '*.html' |
grep -E '/(01前端|02后端|03LLM|04职场实践|05运维|06书单)/'
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add docs rspress.config.ts
git commit -m "refactor: use readable English documentation URLs"
```

### Task 4: Browser verification and documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: a documented English-slug authoring convention and visual evidence.

- [ ] **Step 1: Update authoring guidance**

Change README category paths to `docs/frontend`, `docs/backend`, `docs/llm`, `docs/workplace`, `docs/devops`, and `docs/reading`. State that filenames must use lowercase English kebab-case while visible titles remain Chinese.

- [ ] **Step 2: Start the local server**

Run: `pnpm dev --host 127.0.0.1`

Expected: server is ready on `http://127.0.0.1:3000/`.

- [ ] **Step 3: Verify in browser**

Check:

- Homepage nav targets `/frontend/`, `/backend/`, `/llm/`, `/workplace/`, `/devops/`, `/reading/`.
- `/frontend/css/basics/selectors` renders Chinese content and sidebar labels.
- `/llm/langchain/retrieval/retrieval` renders its image/content.
- `/devops/docker` renders local images without broken resources.
- Search returns a result whose URL uses an English slug.

- [ ] **Step 4: Run final verification and commit**

Run:

```bash
pnpm build
git diff --check
git status --short
```

Expected: build exits 0; only README is uncommitted before the final commit.

Commit:

```bash
git add README.md
git commit -m "docs: document readable URL conventions"
```
