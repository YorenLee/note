---
date: 2026-05-25
---

# Entry：容易搞错的点
## 一、entry 是数组 ≠ 多入口
```js
entry: ['@babel/polyfill', './src/index.js']
```
第一反应容易以为这是"两个入口"，**错**。
数组形式叫 **multi-main entry**，本质上还是**一个入口**：数组里的所有文件按顺序加载，**最终被打到同一个 chunk 里**，输出一个 bundle。

> 想要"多入口（多个独立 bundle）"，得用对象形式。

**实际场景**：在主入口前注入 polyfill / 开发期工具，省得在 `index.js` 顶部手动 `import`。
## 二、用 entry 拆 vendor 是 webpack 3 时代的写法

老项目里经常看到这种写法：

```js
// ❌ webpack 4+ 不推荐
entry: {
  main: './src/app.js',
  vendor: ['react', 'lodash'],
}
```

webpack 3 时代这是配合 `CommonsChunkPlugin` 拆第三方库的标准操作。**webpack 4 起官方明确弃用这种做法**，改用 `optimization.splitChunks`：

```js
// ✅ 现在的写法
entry: './src/index.js',
optimization: {
  splitChunks: { chunks: 'all' },
}
```
**为什么换？**
- **概念上**：entry 的语义是"程序执行起点"，`react` 不是起点，是依赖。把依赖写成 entry 心智模型就是错的。
- **能力上**：splitChunks 能基于 chunk 体积、引用次数、是否来自 `node_modules` 等多维度自动拆分，比手写 vendor 列表精准得多。
- **维护上**：加新库不用改 entry 配置。
## 三、对象 entry 里的 `dependOn` 和 `runtime`（很少用但容易踩坑）
webpack 5 新增的两个字段，平时几乎用不到，但看到老仓库里出现别一脸懵：
```js
entry: {
  a: './a',
  b: { import: './b', dependOn: 'a' },
}
```
- **`dependOn`**：声明 `b` 依赖 `a`。打包时 `a` 的代码不会被重复打进 `b`，类似手动版 splitChunks。
- **`runtime`**：单独抽出 webpack 运行时代码到独立 chunk。
两个限制（容易出错）：
1. **`runtime` 和 `dependOn` 不能同时用**，会报错。
2. **`dependOn` 不能循环**，A 依赖 B、B 又依赖 A 会报错。
## 四、一句话备忘
| 形式                  | 真实语义                         |
| ------------------- | ---------------------------- |
| `entry: 'xxx'`      | 单入口，chunk 名默认叫 `main`        |
| `entry: ['a', 'b']` | **还是单入口**，a 和 b 合并成一个 bundle |
| `entry: { a, b }`   | 多入口，输出多个独立 bundle            |
> 拆 vendor → 用 `splitChunks`，不要写进 entry。
# Loader：执行顺序
## 一、规则：从右往左、从下往上
```js
{
  test: /\.scss$/,
  use: ['style-loader', 'css-loader', 'sass-loader'],
}
```
执行顺序是 **`sass-loader` → `css-loader` →`style-loader`**，反着来的。
数组写法是从右往左；如果用对象数组写成多行，就是**从下往上**。本质是同一件事。
# 插件
webpack 插件是一个带有 `apply` 方法的 JavaScript 对象。这个 `apply` 方法会被 webpack 编译器调用，从而让插件能够访问整个编译生命周期。
> A webpack plugin is a JavaScript object that has an apply method. This apply method is called by the webpack compiler, giving access to the entire compilation lifecycle.

# Module：解析规则

## 一、`import 'xxx'` 是怎么变成文件路径的

webpack 按这个顺序走：

1. **裸模块名**（`import 'lodash'`）→ 去 `resolve.modules` 配置的目录找（默认 `['node_modules']`）
   **相对路径**（`import './x'`）→ 直接拼当前目录
2. 路径指向**文件**：
   - 有后缀 → 直接打包
   - 没后缀 → 用 `resolve.extensions` 一个个试（默认 `['.js', '.json']`）
3. 路径指向**文件夹**：
   - 看 `package.json` 的 `resolve.exportsFields`（默认 `exports`，webpack 5+）
   - 没匹配 → 看 `resolve.mainFields`（默认 `['module', 'main']`，**ESM 优先**）
   - 都没有 → 找 `resolve.mainFiles`（默认 `index`）
   - 最后再用 `resolve.extensions` 补后缀

## 二、resolve配置项备忘

| 配置项             | 作用                                           | 改动频率 |
| --------------- | -------------------------------------------- | ---- |
| `alias`         | 设别名，如 `'@': 'src/'`                          | 经常   |
| `extensions`    | 省略后缀。TS 项目必加 `.ts`、`.tsx`                    | 经常   |
| `mainFields`    | 包入口字段优先级，默认 `['module', 'main']`（ESM 优先 CJS） | 偶尔   |
| `modules`       | 找模块的目录列表                                     | 极少   |
| `exportsFields` | 读 `package.json` 的哪个字段做导出                    | 极少   |
| `mainFiles`     | 文件夹默认入口文件名                                   | 几乎不改 |

## 三、`mainFields` 的坑

默认 `['module', 'main']` = **优先用 ESM 版本，没有再用 CJS**。

- 老库只写了 `main`、没写 `module` → 改成 `['module']`（去掉 main）会报"找不到模块"
- 某个库 ESM 版本有 bug → 改成 `['main', 'module']` 强制用 CJS 绕过

> 这就是「同一个库，webpack 报错但 `<script>` 直接引能跑」的常见根因 —— 解析规则不一样。

# Manifest：四个同名概念别搞混

webpack 官方文档里讲的 manifest 只是其中一种。日常项目里 "manifest" 这个词被用在 4 个不同的地方，名字一样、含义完全不同。

| 名字 | 形态 | 给谁用 | 解决什么问题 |
| --- | --- | --- | --- |
| **Runtime Manifest** | JS 代码（在 bundle 里） | 浏览器运行时 | 模块 ID ↔ chunk 文件 的查找表，让 `__webpack_require__(id)` 能找到代码 |
| **Asset Manifest** | 独立 `manifest.json` | 后端 / CDN / SSR 框架 | 源文件名 ↔ 带 hash 的输出文件名 的映射 |
| **Records** | `records.json` | 下次 webpack 构建自己 | 持久化 module/chunk ID，稳定 hash |
| **Web App Manifest** | `manifest.webmanifest` | 浏览器 / 操作系统 | PWA「安装到桌面」，**和 webpack 无关** |

## 一、Runtime Manifest（官方文档讲的那个）

- **不是单独文件**，是被编译进 runtime chunk 里的一段 JS。
- 唯一能感知它的时刻：搞 contenthash 长缓存时 —— 业务代码没改，`main.[hash].js` 的 hash 却变了，因为每次构建 runtime manifest 都不一样，被一起打进去了。
- **解法**：`optimization.runtimeChunk: 'single'`，把它单独抽出来。

## 二、Asset Manifest（日常说的"manifest"基本都是这个）

- **webpack 不内置**，靠插件生成：`webpack-manifest-plugin`、CRA 的 `asset-manifest.json`、Next.js 的 `build-manifest.json`。
- 长这样：

```json
{ "main.js": "main.8a3f2c.js", "main.css": "main.b1e9d4.css" }
```

- 给**外部系统**查表用（后端模板渲染 HTML 时要知道当前 hash 文件名）。

## 三、Records（基本被淘汰）

webpack 5 默认 `chunkIds / moduleIds: 'deterministic'`，已经能稳定 ID，**`recordsPath` 现在基本不用配**。

## 四、PWA Web App Manifest（不是 webpack 的）

React 项目 `public/manifest.json` 是 PWA 用的，定义图标、主题色、启动方式，只是恰好同名。

## 一句话备忘

> Runtime Manifest 是「浏览器的电话簿」；Asset Manifest 是「后端要查的产物地图」；Records 是「webpack 给自己留的草稿」；Web App Manifest 跟 webpack 没关系，只是同名。

