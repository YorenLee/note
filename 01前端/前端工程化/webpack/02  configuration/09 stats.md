---
date: 2026-06-04
---

# stats

stats 控制 webpack 构建后的**终端输出信息**——显示多少、显示哪些、怎么排序。它不影响构建结果，只影响你看到的报告。

---

## 一、快捷预设

```js
module.exports = {
  stats: 'minimal',
}
```

| 预设 | 输出内容 | 适用场景 |
|---|---|---|
| `'none'` | 什么都不输出 | CI 中只关心是否成功 |
| `'errors-only'` | 只输出错误 | 生产构建 |
| `'errors-warnings'` | 错误 + 警告 | 生产构建 |
| `'minimal'` | 错误 + 警告 + 少量摘要 | 日常开发 |
| `'normal'` | 默认输出 | 一般场景 |
| `'detailed'` | 详细信息（chunk 关系、优化原因等） | 排查构建问题 |
| `'verbose'` | 所有能输出的信息 | 深度调试 |

---

## 二、细粒度配置

```js
stats: {
  assets: true,              // 产物文件列表
  modules: false,            // 模块详情（通常太多，关掉）
  errors: true,              // 错误信息
  warnings: true,            // 警告信息
  timings: true,             // 各阶段耗时
  colors: true,              // 终端彩色输出
  entrypoints: true,         // 入口信息
  chunks: false,             // chunk 详情
  hash: false,               // 构建 hash
}
```

### 排查类配置

| 配置 | 作用 | 排查什么问题 |
|---|---|---|
| `optimizationBailout: true` | 显示模块放弃优化的原因 | Tree Shaking 为什么失效 |
| `reasons: true` | 显示模块被引入的原因 | 某个模块为什么被打包了 |
| `providedExports: true` | 显示模块提供了哪些导出 | usedExports 分析是否正确 |
| `usedExports: true` | 显示哪些导出被实际使用 | Tree Shaking 是否生效 |
| `depth: true` | 显示模块在依赖树中的深度 | 依赖层级是否过深 |
| `moduleTrace: true` | 显示模块的引用链 | 追踪某个模块是从哪引入的 |

---

## 三、导出 stats JSON 用于分析

```bash
webpack --json=stats.json
```

生成的 `stats.json` 可以喂给可视化工具：

- **[webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)**：看每个模块占了多少体积（Treemap 图）
- **[Statoscope](https://statoscope.tech/)**：更强大的交互式分析工具
- **[webpack 官方分析](https://webpack.github.io/analyse/)**：上传 stats.json 在线查看

---

## 四、常见场景配置

### 开发环境（少输出，看关键信息）

```js
stats: 'minimal'
```

### CI 构建（只看错误）

```js
stats: 'errors-only'
```

### 排查 bundle 体积

```bash
webpack --json=stats.json
npx webpack-bundle-analyzer stats.json
```

### 排查 Tree Shaking 失效

```js
stats: {
  optimizationBailout: true,
  providedExports: true,
  usedExports: true,
}
```

### devServer 中单独配置

```js
devServer: {
  client: {
    logging: 'warn',  // 浏览器控制台的日志级别
  },
},
stats: 'minimal',      // 终端的输出级别
```

`devServer` 的日志和 `stats` 是两套东西：`stats` 管终端输出，`devServer.client.logging` 管浏览器控制台。

---

## 总结

| 要点 | 说明 |
|---|---|
| 作用 | 控制终端构建报告的详细程度 |
| 不影响 | 构建结果、产物内容、性能 |
| 快捷用法 | `stats: 'minimal'`（开发）/ `'errors-only'`（CI） |
| 排查体积 | `--json=stats.json` + webpack-bundle-analyzer |
| 排查 Tree Shaking | `optimizationBailout: true` |
