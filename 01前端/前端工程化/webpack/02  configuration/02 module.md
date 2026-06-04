---
date: 2026-05-31
---

# Module：文件怎么匹配、转换、输出

> `module` = 模块处理规则中心：`rules` 决定「哪些文件 → 走哪条 pipeline」，`type` 决定内置处理方式，`parser` / `generator` 微调解析和输出。
> 和 `output` 互补——`output` 管产物放哪，`module` 管文件怎么处理。
> 官方文档：[Module | webpack](https://webpack.js.org/configuration/module/)

---

## 一、必会：`module.rules`（90% 配置全在这）

每条 Rule 分三块：

| 部分 | 作用 | 常用字段 |
| --- | --- | --- |
| **Conditions（条件）** | 匹配哪些文件 | `test` `include` `exclude` `resource` `issuer` `resourceQuery` |
| **Results（结果）** | 匹配后怎么处理 | `use` / `loader` `type` `parser` `generator` |
| **Nested Rules** | 父规则匹配后再细分 | `rules` `oneOf` |

### 两个匹配对象（容易混）

- **resource**：被 import 的文件绝对路径（如 `/path/to/style.css`）
- **issuer**：发起 import 的文件（如 `/path/to/app.js`）

```js
// app.js 里 import './style.css'
// resource = style.css 的路径，issuer = app.js 的路径
```

### 最常用 Rule 字段

| 字段 | 干什么 |
| --- | --- |
| **`test`** | 正则匹配文件（如 `/\.tsx$/`） |
| **`include` / `exclude`** | 限定目录（比 test 更精确） |
| **`use`** | loader 链（**从右到左执行**） |
| **`type`** | 不用 loader，走 webpack 内置模块类型 |
| **`oneOf`** | 多条子规则，**只取第一个匹配的** |
| **`enforce: 'pre' \| 'post'`** | loader 阶段：pre → normal → post |
| **`sideEffects`** | 标记是否有副作用，影响 tree shaking |

典型 rule：

```js
module: {
  rules: [
    { test: /\.tsx?$/, use: 'ts-loader' },
    { test: /\.png$/, type: 'asset/resource' },
    {
      test: /\.css$/,
      oneOf: [
        { resourceQuery: /module/, use: ['css-loader'], type: 'css/module' },
        { use: ['css-loader'], type: 'css' },
      ],
    },
  ],
}
```

---

## 二、`Rule.type` — webpack 5 内置模块类型

替代部分 loader，不用装 file-loader / url-loader / raw-loader。

| type | 等价老 loader | 行为 |
| --- | --- | --- |
| **`asset/resource`** | file-loader | 输出独立文件，import 得 URL |
| **`asset/inline`** | url-loader（全 inline） | base64 嵌进 JS |
| **`asset/source`** | raw-loader | 导出源码字符串 |
| **`asset`** | url-loader（带阈值） | 小文件 inline，大文件 emit |
| **`javascript/auto`** | — | 自动识别 ESM/CJS |
| **`json`** | — | 内置 JSON 解析 |
| **`css` / `css/module` / `css/auto`** | css-loader 部分能力 | 需 `experiments.css: true` |

**坑**：设了 `type: 'json'` 后内置解析生效；要用自定义 loader 处理 JSON，需设 `type: 'javascript/auto'` 绕过默认行为。

### Asset Modules 配套选项

| 层级 | 字段 | 作用 |
| --- | --- | --- |
| rule 级 | `generator.filename` | 覆盖 `output.assetModuleFilename` |
| rule 级 | `parser.dataUrlCondition.maxSize` | `type: 'asset'` 时 inline 阈值 |
| 全局 | `module.generator` / `module.parser` | 按模块类型统一配置 |

```js
{
  test: /\.png$/,
  type: 'asset',
  parser: {
    dataUrlCondition: { maxSize: 8 * 1024 }, // < 8KB inline
  },
  generator: {
    filename: 'images/[hash][ext]',
  },
}
```

---

## 三、loader 机制

### 执行顺序：从右往左、从下往上

```js
use: ['style-loader', 'css-loader', 'sass-loader']
// 实际：sass-loader → css-loader → style-loader
```

### `Rule.enforce` 与两阶段

loader 两阶段：

1. **Pitching**：`post → inline → normal → pre`
2. **Normal（真正转换）**：`pre → normal → inline → post`

| enforce | 类别 |
| --- | --- |
| `'pre'` | pre-loader（如 eslint-loader） |
| 默认 | normal loader |
| `'post'` | post-loader |

`import` 前缀可跳过 loader（非标准，少见）：

- `!` 跳过 normal
- `-!` 跳过 pre + normal
- `!!` 跳过全部

### `Rule.use` 可以是函数

按模块信息动态决定 loader 链（条件编译、多环境等）。

---

## 四、进阶匹配条件（按需查）

| 字段 | 用途 |
| --- | --- |
| **`resourceQuery`** | 匹配 import 的 query（`foo.css?inline`） |
| **`issuer`** | 只对「被谁 import」生效 |
| **`mimetype`** | 匹配 data URI（`data:application/json,...`） |
| **`assert`** | 匹配 import assertion（`import x assert { type: 'json' }`） |
| **`layer`** | 给模块分层，配合 splitChunks / entry |
| **`Rule.resolve`** | 单条 rule 内的 resolve 覆盖（如 TS 项目 `fullySpecified: false`） |

`oneOf` 示例：

```js
{
  test: /\.css$/,
  oneOf: [
    { resourceQuery: /inline/, type: 'asset/inline' },   // foo.css?inline
    { resourceQuery: /external/, type: 'asset/resource' },
  ],
}
```

---

## 五、顶层 module 选项（少改）

| 配置 | 干什么 | 何时碰 |
| --- | --- | --- |
| **`module.parser`** | 全局 parser 配置（JS/CSS/asset/json） | CSS Modules 命名、禁用 `require.ensure` 等 |
| **`module.generator`** | 全局 generator 配置 | CSS `localIdentName`、`exportsConvention` |
| **`module.defaultRules`** | webpack 内置默认规则，`"..."` 引用/扩展 | 禁用某条内置规则 |
| **`module.noParse`** | 跳过 AST 解析（大库提速） | jquery 等预打包库；**文件里不能再有 import** |
| **`module.unsafeCache`** | 缓存模块路径解析 | 性能调优 |

CSS Modules 全局配置示例：

```js
module: {
  parser: {
    'css/module': { namedExports: true },
  },
  generator: {
    'css/module': {
      exportsConvention: 'camel-case-only',
      localIdentName: '[uniqueName]-[id]-[local]',
    },
  },
}
```

---

## 六、和 `resolve` 的分工

| 配置 | 管什么 |
| --- | --- |
| **`resolve`** | `import 'lodash'` **怎么找到文件** |
| **`module.rules`** | 找到文件后 **怎么转换/处理** |

`module.rules` 里的 `resolve` 只影响**该 rule 匹配到的模块**的解析行为。

和 output 的流水线：

```
import './logo.png'
  → module.rules 匹配
  → type: asset/resource
  → generator.filename 命名
  → output.path 落盘
  → output.publicPath 浏览器 URL
```

---

## 七、容易搞错的点

1. **`test` 匹配的是 resolved 绝对路径**，symlink 走真实路径；`npm link` 时 `/node_modules/` 可能匹配不到。
2. **`include` / `exclude` 与 `resource` 互斥**，不能和 `test` + `resource` 混用同一套。
3. **`oneOf` 只走第一条命中**，顺序很重要。
4. **`type` 和 `use` 可以组合**：`type: 'css/auto'` + `use: 'less-loader'` = less 先编译，再走 css 管道。
5. **`sideEffects: false`** 在 rule 上标记该模块可安全 tree-shake（配合 `package.json` 的 `sideEffects` 字段）。
6. **设 `type` 会绕过 defaultRules**：想自定义处理某类型文件，记得显式设 `javascript/auto` 等。

---

## 八、一句话备忘

| 角色 | 重点 |
| --- | --- |
| 日常开发 | `rules` + `test` / `use` / `type` + asset modules |
| CSS Modules / 原生 CSS | `type: css/*` + `module.parser` / `module.generator` |
| 性能调优 | `noParse` `sideEffects` `unsafeCache` |
| 精细控制 | `oneOf` `issuer` `resourceQuery` `enforce` |

> **`module.rules` 是主角**：条件匹配文件 → `use` 走 loader 链 → `type` 走内置类型 → `parser`/`generator` 微调；和 `resolve`（找文件）是上下游关系。
