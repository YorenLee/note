---
date: 2026-06-04
---

# dotenv

webpack 5.103.0+ 内置了 `.env` 文件加载能力，自动把环境变量注入到代码中。

---

## 一、解决什么问题

代码里需要根据环境切换配置：

```js
fetch(process.env.WEBPACK_API_URL + '/users')
```

开发环境打 `https://dev-api.xxx.com`，生产环境打 `https://api.xxx.com`。

**以前**：

- 方案 1：`DefinePlugin` 手动注入（webpack 内置，但要一个个写）
- 方案 2：`dotenv-webpack` 插件（第三方，自动读 `.env` 文件）
- 方案 3：`dotenv` + `DefinePlugin` 组合（先用 dotenv 库读文件，再手动传给 DefinePlugin）

```js
// 方案 1：DefinePlugin 手动注入（繁琐）
new webpack.DefinePlugin({
  'process.env.API_URL': JSON.stringify('https://api.xxx.com'),
  'process.env.DEBUG': JSON.stringify('true'),
  // 每加一个变量就要手动加一行...
})

// 方案 2：dotenv-webpack 插件（最常用）
const Dotenv = require('dotenv-webpack')
plugins: [
  new Dotenv({
    path: './.env',
    safe: true,       // 检查 .env.example 确保变量齐全
    systemvars: true,  // 也加载系统环境变量
  }),
]

// 方案 3：dotenv + DefinePlugin 组合
require('dotenv').config()
new webpack.DefinePlugin({
  'process.env': JSON.stringify(process.env),  // 全部注入（有安全风险）
})
```

**现在（5.103.0+）**：webpack 内置了，直接读 `.env` 文件，不需要第三方插件。

---

## 二、基本用法

```js
// webpack.config.js
module.exports = {
  dotenv: true, // 使用默认配置
}
```

```bash
# .env
WEBPACK_API_URL=https://api.xxx.com
WEBPACK_DEBUG=true
SECRET_KEY=abc123           # 不会暴露（没有 WEBPACK_ 前缀）
```

```js
// 你的代码
console.log(process.env.WEBPACK_API_URL)  // "https://api.xxx.com"
console.log(process.env.SECRET_KEY)       // undefined
```

---

## 三、前缀安全机制

默认只有 `WEBPACK_` 前缀的变量才会注入到代码中，防止数据库密码、API Key 等敏感信息被打包进前端产物。

```js
dotenv: {
  prefix: 'APP_',                  // 自定义前缀
  // 或多个前缀
  prefix: ['APP_', 'CONFIG_'],
}
```

| 工具 | 默认前缀 |
|---|---|
| webpack（内置） | `WEBPACK_` |
| Vite | `VITE_` |
| Create React App | `REACT_APP_` |

> ⚠️ 不允许设空字符串 `''` 作为前缀，否则所有环境变量都会暴露。

---

## 四、文件加载顺序

后加载的覆盖先加载的：

```
.env                    ← 所有环境都加载（优先级最低）
.env.local              ← 所有环境都加载，应 gitignore
.env.[mode]             ← 只在对应 mode 加载（如 .env.production）
.env.[mode].local       ← 只在对应 mode 加载，应 gitignore（优先级最高）
```

已设置的 `process.env` 环境变量优先级最高（不会被 .env 文件覆盖）。

和 Vite 的 `.env` 规则基本一致。

### 自定义模板

```js
dotenv: {
  dir: './config',                            // 从 ./config 目录加载
  template: ['.env', '.env.[mode]'],          // 只加载这两个文件
}
```

---

## 五、变量展开

支持 `dotenv-expand` 语法：

```bash
WEBPACK_API_BASE=https://api.xxx.com
WEBPACK_API_URL=${WEBPACK_API_BASE}/v1              # 引用其他变量
WEBPACK_PORT=${WEBPACK_PORT:-3000}                   # 有环境变量就用，没有就默认 3000
```

---

## 六、本质是编译时文本替换，不是运行时全局变量

**浏览器里不存在 `process.env`**。dotenv 底层用的是 `DefinePlugin`，在构建阶段做字符串替换：

```js
// 你写的
console.log(process.env.WEBPACK_API_URL)

// webpack 打包后变成（编译时已替换完）
console.log("https://api.xxx.com")
```

产物里根本没有 `process.env`，只有替换后的字面量字符串。

```js
console.log(process.env)                    // ❌ 运行时报错：process is not defined
console.log(process.env.WEBPACK_API_URL)    // ✅ 正常，因为整串已被替换成字符串
```

第一行崩，因为浏览器没有 `process` 对象。第二行能用，因为 webpack 把整个表达式替换掉了，运行时根本不会去读 `process`。

### 等价的 DefinePlugin 写法

```js
new webpack.DefinePlugin({
  'process.env.WEBPACK_API_URL': JSON.stringify('https://api.xxx.com'),
  'process.env.WEBPACK_DEBUG': JSON.stringify('true'),
})
```

**Vite 也是同样的原理**，只是用的是 `import.meta.env.VITE_XXX`。

---

## 七、.gitignore 配置

```bash
# .env 本地文件不要提交
.env.local
.env.*.local
```

---

## 总结

| 要点 | 说明 |
|---|---|
| 作用 | 从 `.env` 文件加载环境变量到代码中 |
| 版本要求 | webpack 5.103.0+ |
| 安全机制 | 只有指定前缀（默认 `WEBPACK_`）的变量才暴露 |
| 加载优先级 | `.env` < `.env.local` < `.env.[mode]` < `.env.[mode].local` < `process.env` |
| 本质原理 | 编译时文本替换（DefinePlugin），不是运行时全局变量 |
