---
date: 2026-06-03
---

# optimization

webpack 会根据 `mode` 自动应用优化策略，但所有选项都可以手动配置和覆盖。

optimization 核心解决三个问题：**Tree Shaking（去除无用代码）、Code Splitting（拆分代码块）、缓存稳定性（ID 确定性）**。

---

## 一、代码体积优化（Tree Shaking 链路）

Tree Shaking 的完整链路：`providedExports` → `usedExports` → `sideEffects` → `minimize`
### minimize

是否启用代码压缩（production 默认 `true`）。

```js
optimization: {
  minimize: true
}
```

### minimizer

自定义压缩插件，默认使用 TerserPlugin。

```js
optimization: {
  // 用 '...' 保留默认 minimizer，同时新增 CSS 压缩
  minimizer: [new CssMinimizer(), '...']
}
```

### usedExports（Tree Shaking 核心）

分析每个模块中哪些 export 被实际使用了，未使用的 export 会被标记，供压缩工具删除。

```js
optimization: {
  usedExports: true  // production 默认开启
}
```

### sideEffects（Tree Shaking 核心）

识别 `package.json` 中的 `"sideEffects": false` 标记，直接跳过整个未使用的模块。

- `true`：完整分析（production 默认）
- `'flag'`：只看 package.json 标记，不分析源码（development 默认）

```json
// 第三方库的 package.json
{
  "sideEffects": false
}
```

### providedExports

分析模块提供了哪些导出，为 `usedExports` 和 `concatenateModules` 提供信息。默认开启。

### innerGraph

深层分析模块内部的导出依赖关系，让 Tree Shaking 更精准。production 默认开启。

### concatenateModules（Scope Hoisting）

将多个模块合并到同一个作用域中，减少函数闭包的数量，缩小体积并提升运行速度。

```js
optimization: {
  concatenateModules: true  // production 默认开启
}
```

### mangleExports

缩短导出变量名。`'deterministic'` 保证名称稳定（利于缓存），`'size'` 追求最小体积。

---

## 二、代码分割

### splitChunks

控制公共模块抽取策略，webpack 4+ 默认对动态导入模块自动拆分。

webpack 决定是否拆分时，**所有条件同时检查**，全部满足才拆：

```js
splitChunks: {
  chunks: 'all',           // 对哪些 chunk 生效：'all' | 'async' | 'initial'

  // 体积相关
  minSize: 20000,          // 模块最小多大才值得拆（默认 20KB）
  maxSize: 0,              // 拆出来的 chunk 最大多大，超过会尝试再拆（0 = 不限）

  // 引用次数
  minChunks: 1,            // 被多少个 chunk 引用才拆（默认 1）

  // 请求数限制
  maxAsyncRequests: 30,    // 按需加载时最多并行请求数
  maxInitialRequests: 30,  // 入口点最多并行请求数
}
```

#### 参数详解

- **minSize**：太小的不拆。一个公共模块只有 2KB，拆成单独文件多一次 HTTP 请求的开销 > 重复 2KB 的代价，不如让它重复存在。
- **maxSize**：太大的再拆。如果拆出的 chunk 超过此值，webpack 尝试进一步拆分（模块本身不可拆则无效）。HTTP/2 环境下可以大胆设置此值。
- **minChunks**：被引用次数不够不拆。设为 2 表示"至少被 2 个入口引用才提取为公共 chunk"。
- **maxAsyncRequests / maxInitialRequests**：即使满足所有拆分条件，超出请求数限制时会放弃优先级低的拆分。

> minSize 优先级高于 maxSize。如果模块 30KB，maxSize 想拆但拆出的每块不满足 minSize，则不拆。

#### 判断流程

```
模块体积 >= minSize ?
       ↓ 是
被引用次数 >= minChunks ?
       ↓ 是
拆完后请求数 <= maxAsyncRequests / maxInitialRequests ?
       ↓ 是
→ 拆！
       ↓
拆出来的 chunk > maxSize ?
       ↓ 是
→ 尝试继续拆成更小的 chunk
```

#### cacheGroups 示例

```js
splitChunks: {
  chunks: 'all',
  minSize: 20000,
  maxSize: 250000,
  minChunks: 1,
  maxAsyncRequests: 30,
  maxInitialRequests: 30,

  cacheGroups: {
    // React 单独拆（不管多小都拆）
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
      name: 'react',
      priority: 20,
      minSize: 0,
    },
    // 其他第三方库
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      priority: 10,
      maxSize: 200000,
    },
    // 业务公共代码（至少被 2 个入口引用）
    common: {
      minChunks: 2,
      name: 'common',
      priority: 5,
      minSize: 10000,
    }
  }
}
```

### runtimeChunk

将 webpack 的运行时代码抽离为单独 chunk，避免业务代码不变时因运行时变化导致缓存失效。

```js
optimization: {
  // 所有入口共享一个 runtime chunk
  runtimeChunk: 'single'
}
```

- `'single'`：所有入口共用一个 runtime 文件
- `true` / `'multiple'`：每个入口各自生成 runtime 文件

> ⚠️ 多入口页面建议用 `'single'`，否则模块会被多次初始化。

### mergeDuplicateChunks

合并包含相同模块的 chunk（默认 `true`）。

### removeEmptyChunks

移除空的 chunk（默认 `true`）。

### flagIncludedChunks

标记"子集 chunk"，当父 chunk 已加载时跳过子集加载。production 默认开启。

---

## 三、长期缓存优化

### moduleIds

模块 ID 的生成算法：

| 值 | 说明 |
|---|---|
| `'natural'` | 按使用顺序编号 |
| `'named'` | 可读路径名（方便调试） |
| `'deterministic'` | 短数字 hash，内容不变则 ID 不变（production 默认） |
| `'size'` | 按体积优化编号 |

### chunkIds

chunk ID 的生成算法（选项同上）。production 默认 `'deterministic'`。

### realContentHash

基于文件真实内容生成 hash，确保内容不变时文件名 hash 也不变。production 默认开启。

---

## 四、其他配置

| 配置项 | 作用 |
|---|---|
| `emitOnErrors` | 编译出错时是否仍输出文件（development 默认 `true`） |
| `checkWasmTypes` | 检查 WASM 模块的类型兼容性 |
| `nodeEnv` | 通过 DefinePlugin 设置 `process.env.NODE_ENV` |
| `removeAvailableModules` | 移除父 chunk 中已有的模块（会影响构建性能，默认 `false`） |
| `avoidEntryIife` | 避免入口模块被包裹在 IIFE 中（5.95.0+，production 默认开启） |
| `portableRecords` | 生成可移植的 records（使用相对路径） |
| `mangleWasmImports` | 缩短 WASM 导入名称 |

---

## 总结：mode 的默认行为

| 优化项 | production | development |
|---|---|---|
| minimize | ✅ | ❌ |
| usedExports | ✅ | ❌ |
| sideEffects | ✅ (true) | 'flag' |
| concatenateModules | ✅ | ❌ |
| moduleIds / chunkIds | deterministic | named |
| mangleExports | ✅ | ❌ |
| innerGraph | ✅ | ❌ |
| realContentHash | ✅ | ❌ |

大多数情况下只需要设置 `mode: 'production'`，webpack 就会自动启用所有优化。手动配置通常用于排查问题（如 Tree Shaking 失效、缓存命中率低）。
