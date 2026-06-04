---
date: 2026-06-04
---

# devtool & extends & target & watch

devtool 控制 Source Map 的生成方式，直接影响调试体验和构建速度。extends 允许配置继承和拆分，解决多环境配置重复的问题。target 告诉 webpack 产物要在什么环境运行，从而决定运行时代码的生成方式。

---

## 一、devtool（Source Map 配置）

### 1.1 Source Map 是什么

打包后的代码是压缩、合并过的，报错时你看到的是 `bundle.js:1:23456`，完全无法定位原始代码。Source Map 是一份**映射文件**，让浏览器 DevTools 能把打包后的位置还原到你写的源代码位置。

### 1.2 命名规则

devtool 的值看着很多，但其实是组合出来的：

```
[inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map
```

每个前缀的含义：

| 前缀 | 含义 |
|---|---|
| `eval-` | 每个模块用 `eval()` 包裹，Source Map 作为 DataUrl 附加。**重建最快** |
| `inline-` | Source Map 内联到 bundle 中（不生成单独 .map 文件） |
| `hidden-` | 生成 .map 文件，但不在 bundle 中添加引用注释（浏览器看不到） |
| `nosources-` | Source Map 中不包含源代码内容（只有映射关系） |
| `cheap-` | 只映射行号，不映射列号。**更快，但不能在一行中间打断点** |
| `module-` | 包含 loader 转换前的源码映射（看到的是你写的代码，不是 babel 转换后的） |

### 1.3 质量等级

从低到高：

| 质量 | 你看到的 | 说明 |
|---|---|---|
| `bundled` | 所有代码混在一坨 | 没有 devtool 时的默认状态 |
| `generated` | 按模块分开，但是 webpack 处理后的代码 | 能看到模块结构，但不是原始代码 |
| `transformed` | loader 转换后、webpack 处理前的代码 | 比如 babel 转译后的 ES5 |
| `original lines` | 原始代码，但只有行映射 | 不能在行内精确打断点 |
| `original` | 原始代码，行+列完整映射 | 最高质量，调试体验最好 |

### 1.4 开发环境推荐

| devtool | 首次构建 | 重建 | 质量 | 推荐场景 |
|---|---|---|---|---|
| `eval` | 最快 | 最快 | generated | **性能优先**，不需要精确调试时 |
| `eval-cheap-module-source-map` | 慢 | 快 | original lines | **平衡之选**，大多数项目用这个 |
| `eval-source-map` | 最慢 | 还行 | original | **质量优先**，需要精确调试时 |

```js
// 开发环境推荐配置
module.exports = {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
}
```

**为什么开发用 `eval-*`？** eval 把每个模块包在 `eval()` 中，重建时只需要重新执行变化的模块，不需要重新生成整个 Source Map 文件，所以增量构建特别快。

### 1.5 生产环境推荐

| devtool | 说明 | 适用场景 |
|---|---|---|
| `false`（不设置） | 不生成 Source Map | 追求最快构建、不需要线上调试 |
| `source-map` | 生成独立 .map 文件 | 需要线上调试，但 .map 文件要限制访问 |
| `hidden-source-map` | 生成 .map 文件但不引用 | 只用于错误上报（如 Sentry），不暴露给浏览器 |
| `nosources-source-map` | 有映射但不含源码 | 能还原堆栈但不暴露源代码 |

```js
// 生产环境推荐配置
module.exports = {
  mode: 'production',
  // 方案1：不需要调试
  devtool: false,
  // 方案2：错误上报用（配合 Sentry 等）
  devtool: 'hidden-source-map',
}
```

> ⚠️ 生产环境如果用 `source-map`，务必在服务器上限制 `.map` 文件的访问，否则任何人都能看到你的源代码。

### 1.6 按资源类型配置（5.105.0+）

```js
devtool: [
  { type: 'javascript', use: 'source-map' },
  { type: 'css', use: 'inline-source-map' },
]
```

可以给 JS 和 CSS 设置不同的 Source Map 策略。

### 1.7 常见问题

**Windows 上 eval-* 特别慢？** Windows Defender 会扫描 `eval()` 生成的代码，导致严重卡顿。解决方案：把项目目录加到 Windows Defender 排除列表。

**和 SourceMapDevToolPlugin 冲突？** 不要同时使用 `devtool` 和 `SourceMapDevToolPlugin`，`devtool` 内部已经添加了这个插件，同时用等于插件被应用两次。

---

## 二、extends（配置继承）

### 2.1 解决什么问题

项目通常有多套 webpack 配置（开发、生产、SSR...），它们有大量重复。传统做法是 `webpack-merge` 手动合并，而 `extends` 把这件事变成了内置能力。

> webpack v5.82.0+ / webpack-cli v5.1.0+

### 2.2 基本用法

```js
// base.webpack.config.js — 公共配置
export default {
  module: {
    rules: [
      { test: /\.js$/, use: 'babel-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
}
```

```js
// webpack.config.js — 继承并扩展
export default {
  extends: path.resolve(__dirname, './base.webpack.config.js'),
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
}
```

### 2.3 合并规则

`extends` 内部使用 `webpack-merge`，合并规则是：

| 字段类型 | 行为 |
|---|---|
| 基本类型（string、boolean） | **覆盖**：子配置覆盖父配置 |
| 数组（rules、plugins） | **拼接**：子配置追加到父配置后面 |

```js
// base: rules 有 babel-loader, plugins 有 DefinePlugin
// child: rules 加 css-loader, plugins 加 HMR

// 合并结果：
// rules = [babel-loader, css-loader]   ← 拼接
// plugins = [DefinePlugin, HMR]        ← 拼接
// output.filename = child 的值         ← 覆盖
```

### 2.4 多配置继承

```js
export default {
  extends: [
    path.resolve(__dirname, './js.webpack.config.js'),
    path.resolve(__dirname, './css.webpack.config.js'),
  ],
  entry: './src/index.js',
}
```

多个配置**从右往左合并**：右边的先合并进来，左边的后合并。

### 2.5 从 npm 包加载配置

```js
export default {
  extends: import.meta.resolve('webpack-config-foo'),
  entry: './src/index.js',
}
```

团队可以把公共配置发布为 npm 包，各项目通过 `extends` 继承。

### 2.6 限制

- **不支持 Node API**：只有通过 webpack-cli 运行时 `extends` 才生效。如果你用 `webpack()` 编程方式调用，`extends` 会被忽略。
- 此时需要自己用 `webpack-merge` 手动合并。

### 2.7 实际项目结构示例

```
config/
  base.webpack.config.js    ← 公共 rules、plugins
  dev.webpack.config.js     ← extends base, 加 devServer + devtool
  prod.webpack.config.js    ← extends base, 加 optimization + 压缩
```

```js
// dev.webpack.config.js
export default {
  extends: path.resolve(__dirname, './base.webpack.config.js'),
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  devServer: { hot: true, port: 3000 },
}

// prod.webpack.config.js
export default {
  extends: path.resolve(__dirname, './base.webpack.config.js'),
  mode: 'production',
  devtool: 'hidden-source-map',
  optimization: { splitChunks: { chunks: 'all' } },
}
```

```bash
# 使用
webpack --config config/dev.webpack.config.js
webpack --config config/prod.webpack.config.js
```

---

## 三、target（构建目标环境）

### 3.1 解决什么问题

webpack 打包出来的代码要在哪里运行？浏览器？Node.js？Electron？不同环境支持的 API 不同（浏览器有 `document`，Node 有 `fs`），webpack 需要知道目标环境才能生成正确的**运行时代码**（chunk 加载方式、模块包裹方式等）。

> **注意**：target 只影响 webpack 生成的运行时代码（如 chunk 加载器），不会转译你的业务代码。要把箭头函数转成 ES5，仍然需要 Babel。

### 3.2 默认值

- 如果项目有 `browserslist` 配置（package.json 或 .browserslistrc）→ 默认 `'browserslist'`
- 没有 browserslist → 默认 `'web'`

### 3.3 常用 target 值

| target | 运行环境 | 典型场景 |
|---|---|---|
| `'web'` | 浏览器 | 前端 SPA（默认） |
| `'browserslist'` | 根据 browserslist 配置推断 | 有 .browserslistrc 时自动使用 |
| `'node'` / `'node18'` | Node.js | SSR、CLI 工具、后端服务 |
| `'electron-main'` | Electron 主进程 | 桌面应用主进程 |
| `'electron-renderer'` | Electron 渲染进程 | 桌面应用页面 |
| `'webworker'` | Web Worker | 后台线程 |
| `'esX'`（如 `'es2020'`） | 指定 ES 版本 | 控制运行时代码使用的语法特性 |

### 3.4 指定 Node 版本

```js
module.exports = {
  target: 'node18.0',
}
```

webpack 会根据 Node 18 支持的特性来生成运行时代码（比如可以用 ESM、可以用 `??=` 等）。

### 3.5 组合 target

```js
// 生成在浏览器中运行、但只用 ES5 语法的运行时代码
module.exports = {
  target: ['web', 'es5'],
}
```

多个 target 取**交集**：使用所有目标都支持的特性。

> ⚠️ 不是所有组合都有效。`['web', 'node']` 会报错，webpack 目前不支持通用 target。

### 3.6 关闭 target

```js
module.exports = {
  target: false,
}
```

设为 `false` 不应用任何预设插件，你需要自己手动添加。不提供任何环境信息时，webpack 默认使用 ES2015。

### 3.7 browserslist 集成

browserslist 配置同时影响两件事：
1. webpack 运行时代码使用什么 ES 特性
2. 推断运行环境（`last 2 node versions` 等价于 `target: 'node'`）

```js
// 使用自动解析的 browserslist 配置
target: 'browserslist'

// 指定 browserslist 的 environment
target: 'browserslist:modern'

// 直接传查询条件（忽略配置文件）
target: 'browserslist:last 2 versions'
```

### 3.8 target vs Babel/SWC

| 工具 | 转译什么 |
|---|---|
| `target` | webpack 自己生成的**运行时代码**（chunk 加载、模块注册） |
| Babel / SWC | **你写的业务代码**（箭头函数、可选链、class 等） |

两者各管各的。设了 `target: 'es5'` 不代表你的 `const` 会变成 `var`——那是 Babel 的事。

---

## 四、watch（文件监听）

### 4.1 解决什么问题

每次改一行代码都要手动跑 `webpack` 重新构建——太慢了。watch 让 webpack **一直盯着你的文件，保存即自动重编译**。

```js
module.exports = {
  watch: true,
}
```

### 4.2 和 dev-server 的关系

```
webpack --watch      → 监听变化 → 重编译 → 输出到磁盘
webpack-dev-server   → 监听变化 → 重编译 → 输出到内存 + 刷新浏览器
```

**dev-server 内部已经自动开了 watch**，不需要手动配。

watch 单独使用的场景：不需要 dev-server 但想自动重编译（写 Node.js 项目、写库）。

### 4.3 watchOptions

#### aggregateTimeout（防抖）

```js
watchOptions: {
  aggregateTimeout: 200, // 默认 20ms
}
```

保存文件后不会立刻编译，而是等一段时间看有没有其他文件也变了，**攒在一起只编译一次**。本质是 debounce。

#### ignored（排除监听）

```js
watchOptions: {
  ignored: /node_modules/,
  // 或
  ignored: ['**/node_modules', '**/dist'],
}
```

`node_modules` 几万个文件，监听它们极其浪费 CPU 和内存，**必须排除**。

#### poll（轮询兜底）

```js
watchOptions: {
  poll: 1000, // 每秒检查一次文件变化
}
```

正常情况下 webpack 用操作系统的文件事件（Linux inotify、macOS fsevents）检测变化，零 CPU 开销。

但某些环境下文件事件不工作，只能退回到轮询：

| 环境 | 文件事件为什么失效 |
|---|---|
| Docker 挂载卷 | 宿主机改文件，容器收不到事件 |
| WSL | Windows 和 Linux 文件系统事件不互通 |
| NFS 网络文件系统 | 远程文件变化没有本地通知 |
| VirtualBox 共享目录 | 同 Docker 原因 |

> 轮询的代价是吃 CPU，配合 `ignored` 排除大目录来降低开销。

### 4.4 常见坑

| 问题 | 原因 | 解决 |
|---|---|---|
| 保存了但没重编译 | Docker/WSL 文件事件丢失 | 开 `poll: 1000` |
| watch 吃满 CPU | 监听了 node_modules | 加 `ignored: /node_modules/` |
| Linux 大项目 watch 失败 | 系统 watcher 上限太低 | `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf` |
| macOS 偶尔漏变化 | fsevents bug | 重建项目目录 |
| Vim 保存不触发 | 先写临时文件再替换，原文件没变 | `:set backupcopy=yes` |
| WebStorm 保存不触发 | safe write 机制 | 关闭 Settings → System Settings → Back up files before saving |

---

## 总结

| 配置 | 核心作用 | 关键决策 |
|---|---|---|
| `devtool` | 控制 Source Map 生成方式 | 开发用 `eval-cheap-module-source-map`，生产用 `false` 或 `hidden-source-map` |
| `extends` | 配置继承，消除重复 | 拆分 base/dev/prod 三套配置，通过 extends 继承公共部分 |
| `target` | 指定产物运行环境 | 浏览器用 `'web'`/`'browserslist'`，Node 用 `'node'`，注意它不转译业务代码 |
| `watch` | 文件监听 + 自动重编译 | dev-server 已内置；独立使用时关注 `ignored`（排除）和 `poll`（轮询兜底） |
