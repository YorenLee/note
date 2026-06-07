---
date: 2026-06-04
---

# externals

externals 告诉打包工具：**这个包不要打包进 bundle，运行时从外部获取。**

---

## 一、为什么需要 externals

默认行为：`import React from 'react'` → 打包工具去 `node_modules` 找到 React 源码 → 整个塞进你的 bundle（+130KB）。

问题：
- bundle 体积大
- 用户已经缓存过 CDN 上的 React，这份缓存用不上
- 构建慢（要处理大量第三方源码）

externals 做的事：**遇到 `import React from 'react'` 时直接跳过，不打包。**

但"不打包"只是第一步，你还得告诉浏览器**去哪拿这个包**，否则白屏崩溃。

---

## 二、external 之后，浏览器怎么拿到依赖

### 2.1 裸模块名的问题

打包后如果产物里出现：

```js
import React from 'react'
```

浏览器会报错：

```
Uncaught TypeError: Failed to resolve module specifier "react".
Relative references must start with either "/", "./", or "../".
```

因为浏览器原生 import 只认**完整 URL** 或**相对路径**，不认识 `'react'` 这种裸模块名（Node.js 才认识）。

### 2.2 两种解决方案

#### 方案 A：`<script>` 标签 + 全局变量（UMD 模式）

```html
<!-- CDN 加载 React，挂到 window.React -->
<script src="https://cdn.xxx.com/react@18/react.production.min.js"></script>
```

```js
// 打包工具把 import 替换成读取全局变量
const React = window.React
```

适用于 UMD 格式的库（React、jQuery 等老牌库都有 UMD 版本）。

#### 方案 B：paths 替换成 CDN URL（ESM 模式）

```js
// 打包前
import { Scene } from 'three'

// 打包后（Rollup paths 替换）
import { Scene } from 'https://cdn.dp.tech/pkg/three/@0.153.0/index.js'
```

浏览器原生 `import` 支持完整 URL，直接从 CDN 加载 ESM 模块。

#### 对比

| | 方案 A：`<script>` + 全局变量 | 方案 B：paths + ESM import |
|---|---|---|
| 模块格式 | UMD（挂到 window） | ESM（原生 import） |
| 加载时机 | HTML 解析时就加载 | 代码执行到 import 时加载 |
| 需要 `<script>` 标签 | 是（手写或插件注入） | 不需要 |
| 适用库 | React、jQuery 等 UMD 库 | 有 ESM 版本的现代库 |

---

## 三、webpack 中的 externals 配置

### 3.1 基本语法

```js
// webpack.config.js
module.exports = {
  externals: {
    // key: import 的包名
    // value: 运行时从哪拿（默认是全局变量名）
    react: 'React',        // import React from 'react' → window.React
    jquery: 'jQuery',      // import $ from 'jquery' → window.jQuery
  },
}
```

### 3.2 指定获取方式（externalsType 前缀）

```js
externals: {
  react: 'React',                    // 默认 var → window.React
  lodash: 'commonjs lodash',         // → require('lodash')
  vue: 'module vue',                 // → import * as vue from 'vue'
}
```

### 3.3 多种写法

```js
// 字符串：单个 external
externals: 'jquery'

// 对象：多个 external（最常用）
externals: { react: 'React', jquery: 'jQuery' }

// 正则：匹配模式
externals: /^(jquery|\$)$/i

// 函数：动态判断
externals: [
  function ({ request }, callback) {
    if (/^@company\//.test(request)) {
      return callback(null, `commonjs ${request}`)
    }
    callback()
  },
]

// 混合使用
externals: [
  { react: 'React' },
  /^lodash/,
  function ({ request }, callback) { /* ... */ },
]
```

### 3.4 externalsType

全局设置 external 的默认获取方式：

| externalsType | 生成的代码 | 适用场景 |
|---|---|---|
| `'var'`（默认） | `const jq = jQuery` | CDN `<script>` 加载的全局变量 |
| `'commonjs'` | `const jq = require('jquery')` | Node.js 环境 |
| `'module'` | `import * as jq from 'jquery'` | ESM 环境 |
| `'import'` | `const jq = await import('jquery')` | 动态 import |
| `'script'` | 运行时插入 `<script>` 标签 | 自动从 CDN 加载 |
| `'module-import'` | 静态用 import，动态用 import() | 混合使用（5.94.0+） |

#### externalsType: 'script'（webpack 内置 CDN 方案）

```js
module.exports = {
  externalsType: 'script',
  externals: {
    lodash: ['https://cdn.jsdelivr.net/npm/lodash@4.17.19/lodash.min.js', '_'],
    //        CDN URL                                                      全局变量名
  },
}
```

webpack 运行时**自动插入 `<script>` 标签加载**，不需要手写 HTML。但加载是运行时才发生的，首屏会慢一些。

### 3.5 externalsPresets（快捷预设）

```js
module.exports = {
  externalsPresets: {
    node: true, // 自动排除所有 Node 内置模块（fs, path, vm...）
  },
}
```

不用一个个写 `externals: { fs: 'commonjs fs', path: 'commonjs path' }`。

---

## 四、Vite/Rollup 中的 externals

Vite 底层用 Rollup，配置方式不同但原理相同。

### 4.1 rollupOptions.external + paths（ESM 方案）

```js
// vite.config.js
build: {
  rollupOptions: {
    external: ['three', 'katex', 'mathjs'],
    output: {
      paths: {
        three: 'https://cdn.dp.tech/pkg/three/@0.153.0/index.js',
        katex: 'https://cdn.dp.tech/pkg/katex/@0.16.10/index.js',
        mathjs: 'https://cdn.dp.tech/pkg/mathjs/@12.3.0/index.1.esm.js',
      },
    },
  },
}
```

Rollup 在输出阶段把裸模块名替换成 CDN URL：

```js
// 替换前
import { Scene } from 'three'
// 替换后
import { Scene } from 'https://cdn.dp.tech/pkg/three/@0.153.0/index.js'
```

### 4.2 vite-plugin-cdn-import（UMD 方案）

```js
import cdn from 'vite-plugin-cdn-import'

plugins: [
  cdn({
    modules: [
      {
        name: 'react',
        var: 'React',
        path: 'https://cdn.dp.tech/pkg/react/@18.2.0/react.production.min.js',
      },
    ],
  }),
]
```

这个插件同时做三件事：
1. 设置 external（不打包 react）
2. 往 HTML 注入 `<script>` 标签
3. 产物中用 `window.React` 替代 import

### 4.3 globals

```js
output: {
  globals: {
    react: 'React',           // window.React
    'react-dom': 'ReactDOM',  // window.ReactDOM
  },
}
```

告诉 Rollup：当需要引用 react 时，对应的全局变量名是 `React`。配合 cdn 插件的 `<script>` 注入使用。

### 4.4 三者的协作关系

```
external 列表里的每个包，必须在 paths 或 globals+cdn插件 中二选一：

                external: ['react', 'three', 'katex']
		                     │         │         │
		                     ▼         ▼         ▼
		                  globals    paths     paths
		                  + cdn插件
		                     │         │         │
		                     ▼         ▼         ▼
		               <script>标签  替换URL   替换URL
		                     │         │         │
		                     ▼         ▼         ▼
		              window.React  import    import
		                            from CDN  from CDN
```

---

## 五、实际项目中的分类策略

### 哪些走 `<script>` + globals（UMD）

- 只有 UMD 版本的库（React CDN 版区分 dev/prod）
- 需要最先加载的核心库
- 多个微前端应用需要共享的库

### 哪些走 paths（ESM）

- 有 ESM 版本的现代库（three、lodash-es、zustand...）
- 按需加载的大型库
- 不需要挂全局变量的库

### 哪些不该 external

- 体积很小的工具库（externalize 后多一次网络请求，得不偿失）
- 你深度定制过的库（CDN 版本和你用的版本不一致会出 bug）
- 没有可靠 CDN 源的库

---

## 六、external vs splitChunks

| | external（CDN） | splitChunks（拆包） |
|---|---|---|
| 代码在哪 | CDN 服务器 | 你自己的服务器 |
| 版本控制 | CDN URL 锁定版本 | package.json 锁定版本 |
| 首次加载 | 可能命中用户浏览器缓存（其他网站加载过同一 CDN） | 首次必须下载 |
| CDN 挂了 | 网站挂了 | 不受影响 |
| 适合 | 通用大型库（React、lodash） | 业务代码、不通用的库 |

---

## 总结

| 概念 | 作用 |
|---|---|
| `external` | 声明"不打包"的包清单 |
| `paths` | 把裸模块名替换成 CDN URL（ESM 方案） |
| `globals` | 映射全局变量名（UMD 方案） |
| `externalsType` | webpack 中设置默认的 external 获取方式 |
| `externalsPresets` | 快捷排除 Node 内置模块等 |
| cdn 插件 | 自动注入 `<script>` + 设置 external + globals |

核心流程：**external（不打包）→ paths 或 globals（告诉浏览器去哪拿）→ 浏览器加载成功。三步缺一不可。**
