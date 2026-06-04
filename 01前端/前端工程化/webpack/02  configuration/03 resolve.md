---
date: 2026-05-31
---

# Resolve：模块路径怎么解析

> `resolve` = `import 'xxx'` 怎么解析成磁盘上的真实文件路径；找到文件后交给 `module.rules` 处理。
> 官方文档：[Resolve | webpack](https://webpack.js.org/configuration/resolve/)

---

## 一、解析流程（心智模型）

webpack 按这个顺序走：

1. **裸模块名**（`import 'lodash'`）→ 去 `resolve.modules` 找（默认 `['node_modules']`）
   **相对路径**（`import './x'`）→ 拼当前目录
2. 路径指向**文件**：
   - 有后缀 → 直接打包
   - 没后缀 → `resolve.extensions` 逐个试（默认 `['.js', '.json', '.wasm']`）
3. 路径指向**文件夹**：
   - 看 `package.json` 的 `exports`（`exportsFields`，webpack 5+）
   - 没匹配 → 看 `mainFields`（web 默认 `['browser', 'module', 'main']`）
   - 都没有 → 找 `mainFiles`（默认 `index`）
   - 最后再用 `extensions` 补后缀

完整流水线：

```
import '@/components/Button'
  → resolve（alias、extensions、mainFields…）→ 绝对路径
  → module.rules（loader / type）→ 转换
  → output（filename、path）→ 写出
```

---

## 二、必会配置（经常改）

| 配置 | 干什么 | 典型值 |
| --- | --- | --- |
| **`alias`** | 路径别名 | `'@': path.resolve(__dirname, 'src')` |
| **`extensions`** | 省略后缀时试哪些扩展名 | `['.ts', '.tsx', '...']` |
| **`mainFields`** | 读 `package.json` 哪个字段当入口 | web 默认 `['browser', 'module', 'main']` |
| **`modules`** | 去哪些目录找模块 | `['node_modules']` 或前置 `src` |
| **`exportsFields`** | 读 `package.json` 的 exports | 默认 `['exports']` |
| **`conditionNames`** | `exports` 条件导出匹配什么环境 | 随 target / mode 自动生成 |
| **`fallback`** | Node 内置模块的浏览器 polyfill | `{ crypto: false }` 或指向 npm 包 |
| **`tsconfig`** (5.105+) | 读 `tsconfig paths`，可替代 tsconfig-paths 插件 | `tsconfig: true` |

### `alias` 写法备忘

| 写法 | 含义 |
| --- | --- |
| `'@': './src'` | 前缀匹配，`@/foo` → `src/foo` |
| `'@*': path.resolve(__dirname, 'src/*')` | 通配符，`@components/Button` → `src/components/Button` |
| `'xyz$': './file.js'` | **精确匹配**，只有 `import 'xyz'` 才替换 |
| `'mod': false` | 忽略该模块（webpack 5 替代 null-loader） |

`alias` **优先级高于**正常解析。

```js
resolve: {
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
}
```

### `extensions` 坑

直接写数组会**覆盖**默认 `.js` `.json` `.wasm`，要用 `'...'` 保留：

```js
extensions: ['.ts', '.tsx', '...']
```

TS 项目必加 `.ts`、`.tsx`。

### `mainFields` 坑

默认 ESM 优先（`module` 在 `main` 前面）。

- 老库只写了 `main`、没写 `module` → 去掉 `module` 会报「找不到模块」
- 某库 ESM 版本有 bug → 改成 `['main', 'module']` 强制 CJS

> 「同一个库，webpack 报错但 `<script>` 直接引能跑」—— 常见根因是解析规则不一样。

### `tsconfig` paths（webpack 5.105+）

```js
resolve: {
  tsconfig: true, // 或 './tsconfig.app.json'
}
```

配合 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

### `fallback`（webpack 5 不再自动 polyfill Node 内置模块）

```js
resolve: {
  fallback: {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    fs: false, // 明确不提供 polyfill
  },
}
```

---

## 三、特定场景才碰

| 配置 | 何时用 |
| --- | --- |
| **`fullySpecified`** | ESM 严格模式，必须写全后缀；TS 项目常在 rule 里设 `false` |
| **`symlinks`** | 默认 `true` 解析到真实路径；`npm link` 出问题可设 `false` |
| **`preferRelative`** | 优先相对路径，少用 `node_modules` |
| **`extensionAlias`** | 请求 `.js` 实际找 `.ts` |
| **`byDependency`** | 按 ESM / CJS 分别设 resolve 选项 |
| **`enforceExtension`** | `true` 时禁止省略后缀 |
| **`importsFields`** | 解析 package 内 `#` 开头的 internal import |

TS + ESM 常见：

```js
module: {
  rules: [{
    test: /\.m?js$/,
    resolve: { fullySpecified: false },
  }],
}
```

`Rule.resolve` 只影响**该 rule 匹配到的模块**，可覆盖全局 alias。

---

## 四、缓存相关（默认不用改）

和「解析缓存」相关的选项别混：

| 配置 | 层级 | 干什么 |
| --- | --- | --- |
| **`resolve.cache`** | resolve | 缓存**成功**的解析结果，支持 revalidate |
| **`resolve.cachePredicate`** | resolve | 函数：哪些请求进 cache |
| **`resolve.cacheWithContext`** | resolve | unsafeCache 时是否把 `context` 放进 cache key |
| **`resolve.unsafeCache`** | resolve | **激进**缓存，文件删了可能仍命中旧路径 |
| **`module.unsafeCache`** | module | 缓存模块请求解析（**另一层**，不是 resolve.cache） |

### `resolve.cache`

```js
resolve: { cache: true }
```

- 加速重复 resolve（同一 `import 'lodash'` 不用反复扫盘）
- 和 `cache: { type: 'filesystem' }`（构建级缓存）不是一回事
- **日常保持默认即可**

### `resolve.cache` vs `resolve.unsafeCache`

| | `resolve.cache` | `resolve.unsafeCache` |
| --- | --- | --- |
| 策略 | 较安全，可 revalidate | 激进，变更可能不感知 |
| 风险 | 低 | 删/移文件后偶发解析到旧路径 |

---

## 五、`resolveLoader`

loader 本身也是 npm 包，webpack 用 **`resolveLoader`** 找它们（和 `resolve` 选项同名，但作用对象不同）：

```js
resolveLoader: {
  modules: ['node_modules'],
  extensions: ['.js', '.json'],
  mainFields: ['loader', 'main'],
}
```

`conditionNames` 默认也不同：`['loader', 'require', 'node']`。

---

## 六、`conditionNames` 与 package exports

webpack 5 读 `package.json` 的 `exports` 时，按 `conditionNames` 匹配条件：

- 基础：`webpack` + `production`/`development`
- web target 追加：`browser`
- ESM import 追加：`import`、`module`、`module-sync`
- CJS require 追加：`require`

自定义条件可继承默认：`conditionNames: ['my-custom', '...']`

`exports` 里** key 顺序有优先级**，靠前的条件先匹配。

---

## 七、容易搞错的点

1. **`alias` 优先于一切** — 配错了会直接指向错误文件，不走正常 node_modules 解析。
2. **`extensions` 覆盖默认** — 忘了 `'...'` 会导致 `.json`、`.wasm` 解析失败。
3. **`symlinks: true`（默认）** — `test` / `exclude` 里的 `/node_modules/` 可能匹配不到 `npm link` 的包（走的是真实路径）。
4. **`resolve` vs `module.unsafeCache`** — 名字都有 cache，层级不同。
5. **`mainFields` web vs node 默认不同** — web 多一个 `browser` 字段，同样 `import 'pkg'` 可能解析到不同文件。
6. **TS paths 两套系统** — IDE 靠 `tsconfig paths`，webpack 需 `resolve.alias` 或 `resolve.tsconfig` 才能打包对齐。

---

## 八、配置项改动频率备忘

| 配置项 | 作用 | 改动频率 |
| --- | --- | --- |
| `alias` | 别名，`'@': 'src/'` | 经常 |
| `extensions` | 省略后缀，TS 必加 `.ts` `.tsx` | 经常 |
| `tsconfig` | 同步 tsconfig paths | 经常（TS 项目） |
| `mainFields` | 包入口优先级 | 偶尔 |
| `fallback` | Node polyfill | 偶尔 |
| `fullySpecified` | ESM 全后缀 | 偶尔 |
| `modules` | 模块搜索目录 | 极少 |
| `exportsFields` / `conditionNames` | exports 解析 | 极少 |
| `mainFiles` | 文件夹默认入口 | 几乎不改 |
| `cache` / `unsafeCache` | 解析缓存 | 几乎不改 |

---

## 九、一句话备忘

| 角色 | 重点 |
| --- | --- |
| 日常开发 | `alias` `extensions` `mainFields` `tsconfig` |
| 包导出 / ESM 问题 | `exportsFields` `conditionNames` `fullySpecified` |
| npm link 踩坑 | `symlinks: false` |
| 浏览器用 Node API | `fallback` |
| loader 找不到 | `resolveLoader` |
| **resolve.cache** | 解析性能优化，默认不用改 |

> **`resolve` 管「找文件」**；常改 `alias` / `extensions` / `mainFields`；和 `module.rules`（怎么处理）是上下游关系。
