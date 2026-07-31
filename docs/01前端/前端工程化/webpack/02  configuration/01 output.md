---
date: 2026-05-31
---

# Output：产物写哪、叫什么、怎么加载

> `output` = 告诉 webpack「产物写哪、叫什么、浏览器怎么引用、异步 chunk 怎么加载」。
> 官方文档：[Output | webpack](https://webpack.js.org/configuration/output/)

---

## 一、必会四件套（90% 项目都会配）

### 1. 落盘三件套

| 配置 | 管什么 |
| --- | --- |
| `path` | 输出目录的**绝对路径**（如 `dist/`） |
| `filename` | **初始 chunk**（entry 首屏 JS）的文件名 |
| `chunkFilename` | **非初始 chunk**（懒加载 / splitChunks 拆出的 JS）的文件名 |

```js
output: {
  path: path.resolve(__dirname, 'dist'),
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].js',
}
```

**分工记忆**：

| 类型 | 什么时候加载 | 文件名由谁定 |
| --- | --- | --- |
| Initial chunk | 页面一打开就加载 | `filename` |
| Non-initial chunk | 运行时才加载（`import()`、splitChunks） | `chunkFilename` |

### 2. `publicPath` — 最容易配错

- **磁盘路径**（`path`）≠ **浏览器访问 URL**（`publicPath`）
- runtime 生成的所有 URL（懒加载 chunk、图片、字体）都会前缀 `publicPath`
- 默认 `web` target 下是 `'auto'`
- 记法：**从 HTML 页面视角看，资源 URL 的前缀是什么**

```js
// CDN
publicPath: 'https://cdn.example.com/assets/'

// 相对 HTML
publicPath: '/assets/'

// 运行时动态改（编译时 publicPath 不确定时）
__webpack_public_path__ = myRuntimePublicPath
```

### 3. 静态资源 & CSS 命名

| 配置 | 管什么 |
| --- | --- |
| `assetModuleFilename` | `type: 'asset/resource'` 输出的图片/字体等默认路径 |
| `cssFilename` | 初始 CSS 输出文件名 |
| `cssChunkFilename` | 按需 CSS chunk 文件名 |

```js
assetModuleFilename: 'images/[hash][ext][query]'
// rule 级 generator.filename 可覆盖全局默认值
```

### 4. `clean`

构建前清空 `output.path`：

```js
output: { clean: true }
```

---

## 二、模板占位符（filename 系列共用）

支持 `[占位符]` 拼文件名，也叫 Template strings。

| 占位符 | 含义 | 长缓存 |
| --- | --- | --- |
| `[name]` | entry / chunk 名 | — |
| `[id]` | chunk 数字 id | — |
| **`[contenthash]`** | **文件内容** hash | ✅ 生产首选 |
| `[chunkhash]` | 该 chunk hash（含 runtime） | 可用 |
| `[hash]` / `[fullhash]` | **整次编译** hash，任意文件改全变 | ❌ 不推荐生产 |

截断长度：`[contenthash:8]`，或全局 `hashDigestLength: 16`。

**`[name]` 坑**：chunk 没命名时只有 `[id]`，产物像 `792.js`。生产建议：

```js
// 魔法注释
import(/* webpackChunkName: "about" */ './About')

// 或 splitChunks 里给 cacheGroup 起名
optimization: {
  splitChunks: {
    cacheGroups: {
      vendors: { test: /node_modules/, name: 'vendors', chunks: 'all' },
    },
  },
}
```

---

## 三、代码分割 / 多 runtime（有懒加载或 MF 才重要）

| 配置 | 管什么 |
| --- | --- |
| `chunkLoading` | chunk 加载方式：`jsonp`（浏览器）、`import`（ESM）、`require`（Node） |
| `chunkLoadingGlobal` | JSONP 模式下挂到 `window/self` 的全局数组名 |
| `uniqueName` | 构建唯一标识，自动生成 `chunkLoadingGlobal` |
| `chunkLoadTimeout` | 懒加载 chunk 请求超时（默认 120s） |
| `crossOriginLoading` | 跨域加载 chunk 的 CORS：`'anonymous'` / `'use-credentials'` |
| `asyncChunks` | 是否创建按需 async chunk（默认 `true`） |

**`chunkLoadingGlobal` 机制**：懒加载 chunk 通过 JSONP 把模块 `push` 到全局数组，主 bundle 监听完成注册。

```js
self["webpackChunkmy_app"] = self["webpackChunkmy_app"] || [];
self["webpackChunkmy_app"].push([["chunk-about"], { /* 模块 */ }]);
```

**什么时候要改**：同一页面多个 webpack 构建（Module Federation、微前端）→ `uniqueName` 必须各不相同，否则 chunk 注册冲突、懒加载失败。

webpack 4 → 5：`jsonpFunction` 已废弃，改用 `uniqueName` + `chunkLoadingGlobal`。

---

## 四、打包成库（library）才用，业务 SPA 可跳过

| 配置 | 管什么 |
| --- | --- |
| `library.name` + `library.type` | 库怎么暴露（`umd` / `commonjs2` / `var` …） |
| `library.export` | 暴露哪个导出（如 `'default'`） |
| `auxiliaryComment` | UMD 包装层各分支里的注释（版权声明等） |
| `globalObject` | UMD 挂载的全局对象（`'this'` 兼容浏览器 + Node） |

`auxiliaryComment` 只在 UMD 库场景有意义，普通业务项目忽略。

---

## 五、特殊场景（按需查，平时不用记）

| 配置 | 什么时候碰 |
| --- | --- |
| `wasmLoading` | import `.wasm`；浏览器默认 `'fetch'`，Node 默认 `'async-node'` |
| `webassemblyModuleFilename` | `.wasm` 输出文件名（默认 `[hash].module.wasm`） |
| `workerWasmLoading` / `workerChunkLoading` / `workerPublicPath` | Web Worker 里加载 wasm / chunk |
| `hotUpdateChunkFilename` / `hotUpdateMainFilename` | HMR 热更新，几乎不改 |
| `trustedTypes` | CSP `require-trusted-types-for` 环境 |
| `devtoolModuleFilenameTemplate` | source map 里模块路径格式 |
| `environment` | 告诉 webpack runtime 能用哪些 ES 语法 |
| `iife` | 是否包 IIFE（默认 `true`） |
| `module` + `scriptType` | 输出 ESM 格式 bundle（实验特性） |

---

## 六、容易搞错的点

### 1. `filename` vs `chunkFilename` vs `assetModuleFilename`

| 配置 | 管什么 |
| --- | --- |
| `filename` | 首屏 JS |
| `chunkFilename` | 懒加载 JS |
| `assetModuleFilename` | 单独 emit 的静态资源（png、字体…） |

loader 产物的命名不走这三项，得看 loader 自己的 options。

### 2. 生产 hash 选 `[contenthash]`

改 `about.js` 时 ideally 只有 `about.[hash].js` 变，`main.js` / `vendors.js` hash 不变。`[hash]` / `[fullhash]` 任意文件改动会导致所有带 hash 的文件名全变。

配合 `optimization.runtimeChunk: 'single'` 避免 runtime manifest 变动牵连业务 chunk hash（见核心概念 Manifest 章节）。

### 3. `chunkFilename` 用 `[name]` 会增大 bundle

placeholder 映射表会打进 runtime，chunk 名变了还可能 invalidate 其他 bundle。生产仍建议用，但要给 chunk 命名（魔法注释或 splitChunks name）。

### 4. `path` 必须是绝对路径，且不能含 `!`

`!` 被 webpack 保留给 loader 内联语法。

---

## 七、一句话备忘

| 角色 | 重点 |
| --- | --- |
| 业务前端 | `path` `filename` `chunkFilename` `publicPath` `assetModuleFilename` `clean` `[contenthash]` |
| 微前端 / MF | 上面 + `uniqueName` `chunkLoadingGlobal` |
| 库作者 | 上面 + `library` 系列 |
| wasm / Worker | `wasmLoading` `webassemblyModuleFilename` `worker*` 系列 |

> 磁盘看 `path`，首屏 JS 看 `filename`，懒加载 JS 看 `chunkFilename`，浏览器 URL 看 `publicPath`，静态资源看 `assetModuleFilename`，生产 hash 用 `[contenthash]`。
