---
date: 2026-06-04
---

# cache

webpack 构建很慢，每次都要重新编译所有模块。cache 的作用是：**把编译过的模块和 chunk 缓存起来，下次构建时直接复用，跳过重复编译。**

---

## 一、两种缓存模式

| 类型 | 存储位置 | 生命周期 | 适用场景 |
|---|---|---|---|
| `memory` | 内存 | 当前进程存活期间（关掉就没了） | dev-server 的 watch 模式 |
| `filesystem` | 磁盘文件 | 跨进程持久化（关了再开还在） | CI/CD、冷启动加速 |

默认行为由 `mode` 决定：

| mode | 默认 cache |
|---|---|
| `development` | `{ type: 'memory' }` |
| `production` | `false` |
| `none` | `false` |

```js
// 关闭缓存
cache: false

// 等价于 { type: 'memory' }
cache: true
```

**`memory` 只在 dev-server 的增量编译中有效**——进程一关缓存就没了。**`filesystem` 才是跨构建持久缓存的核心**，也是大多数配置项存在的原因。

---

## 二、cache.type: 'filesystem' 核心配置

### 2.1 buildDependencies（缓存失效的关键）

**作用**：告诉 webpack "哪些文件变了，就必须丢弃整个缓存重新构建"。

```js
cache: {
  type: 'filesystem',
  buildDependencies: {
    config: [__filename],
    // webpack 自身和 loaders 默认已包含
  },
}
```

**为什么需要它？** 如果你改了 `webpack.config.js`（比如加了一个 loader），但缓存还是旧的编译结果，就会出错。把配置文件加到 `buildDependencies` 后，webpack 会对配置文件及其所有依赖做 hash，**配置一变，缓存自动失效**。

### 2.2 cacheDirectory / cacheLocation（缓存存哪）

```js
cache: {
  type: 'filesystem',
  // 基础目录，默认 node_modules/.cache/webpack
  cacheDirectory: path.resolve(__dirname, '.temp_cache'),
  // 最终位置 = cacheDirectory + name
  // 或者直接指定完整路径
  cacheLocation: path.resolve(__dirname, '.test_cache'),
}
```

最终缓存位置 = `cacheDirectory` + `cache.name`，除非你直接用 `cacheLocation` 覆盖。

### 2.3 name（多配置隔离）

```js
cache: {
  type: 'filesystem',
  // 默认是 ${config.name}-${config.mode}
  name: 'AppBuildCache',
}
```

不同的 name 会生成独立的缓存目录。当你有多份 webpack 配置（如 client/server）需要独立缓存时使用。

### 2.4 version（手动失效）

```js
cache: {
  type: 'filesystem',
  version: 'v1',
}
```

当你的构建环境发生了 `buildDependencies` 无法感知的变化时（比如环境变量改了、某个外部工具升级了），手动改 version 就能强制缓存失效。

---

## 三、内存管理配置

filesystem 缓存在磁盘上，但 webpack 也会在内存中保留一份热数据以加速访问。以下配置控制内存中的缓存行为：

### maxMemoryGenerations（filesystem 模式下的内存缓存策略）

| 值 | 行为 |
|---|---|
| `0` | 不使用内存缓存，序列化后就从内存移除，下次从磁盘读。**最省内存，但更慢** |
| `1` | 序列化后且一次编译未使用就移除。**平衡内存和性能** |
| `> 1` | 允许在内存中保留更多代。**更快，但更吃内存** |
| `Infinity` | 永不清理 |

| mode | 默认值 |
|---|---|
| `development` | `5` |
| `production` | `Infinity` |

### maxGenerations（memory 模式下的缓存寿命）

只在 `type: 'memory'` 时有效。

| 值 | 行为 |
|---|---|
| `1` | 一次编译未使用就清除 |
| `Infinity` | 永远保留 |

### allowCollectingMemory

```js
cache: {
  type: 'filesystem',
  allowCollectingMemory: true, // development 默认 true
}
```

反序列化时回收未使用的内存。会拷贝数据到更小的 buffer，有一定性能代价。

---

## 四、磁盘缓存细节

### maxAge（缓存过期时间）

```js
cache: {
  type: 'filesystem',
  maxAge: 5184000000, // 默认 60 天（毫秒）
}
```

超过这个时间未被使用的缓存条目，会在下次构建时被清理。

### compression（压缩缓存文件）

```js
cache: {
  type: 'filesystem',
  compression: 'gzip', // false | 'gzip' | 'brotli'
}
```

压缩可以减少磁盘占用，但序列化/反序列化会变慢。适合磁盘空间紧张的 CI 环境。

### store

```js
cache: {
  type: 'filesystem',
  store: 'pack', // 目前唯一支持的模式
}
```

`'pack'` 表示在编译器空闲时，将所有缓存项打包为单个文件写入磁盘。

### idleTimeout 系列（写入时机）

| 配置 | 默认 | 含义 |
|---|---|---|
| `idleTimeout` | 60000ms | 编译完成后等多久才写入缓存 |
| `idleTimeoutForInitialStore` | 5000ms | 首次构建完成后等多久写入 |
| `idleTimeoutAfterLargeChanges` | 1000ms | 大量变更后等多久写入 |

这些延迟是为了避免在编译器还在忙时执行耗时的磁盘写入。

### readonly（只读模式）

```js
cache: {
  type: 'filesystem',
  store: 'pack',
  readonly: true, // 5.85.0+
}
```

只读取缓存，不写入。适合 CI 中的并行构建：主构建负责生成缓存，子构建只读取。

### profile

```js
cache: {
  type: 'filesystem',
  profile: true,
}
```

输出每个缓存项的详细耗时信息，用于排查缓存性能问题。

---

## 五、cacheUnaffected / memoryCacheUnaffected

```js
// memory 模式
cache: {
  type: 'memory',
  cacheUnaffected: true,
}

// filesystem 模式
cache: {
  type: 'filesystem',
  memoryCacheUnaffected: true,
}
```

**需要同时开启 `experiments.cacheUnaffected: true`**。

作用：对于**没有变化、且只引用了没有变化的模块**，直接跳过重新计算。这是更激进的缓存优化，能加速增量编译。

---

## 六、CI/CD 中使用 filesystem 缓存

filesystem 缓存最大的价值在 CI/CD：让每次构建不用从零开始。

**前提条件**：
1. CI 系统支持跨构建共享缓存目录
2. 构建必须在**相同的绝对路径**下执行（缓存文件中存储了绝对路径）

### GitLab CI/CD

```yaml
variables:
  CACHE_FALLBACK_KEY: main

build-job:
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - node_modules/.cache/webpack/
```

### GitHub Actions

```yaml
- uses: actions/cache@v3
  with:
    path: node_modules/.cache/webpack/
    key: ${{ GITHUB_REF_NAME }}-webpack-build
    restore-keys: |
      main-webpack-build
```

> ⚠️ 注意不要在同一个 job 中执行 `npm ci`，否则它会清理 `node_modules` 中的缓存文件。

---

## 七、实际推荐配置

### 开发环境（默认即可）

```js
// development 模式自动启用 memory 缓存，无需额外配置
module.exports = {
  mode: 'development',
  // cache: { type: 'memory' } 已自动生效
}
```

### 开发环境（加速冷启动）

```js
module.exports = {
  mode: 'development',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
}
```

### 生产环境 + CI

```js
module.exports = {
  mode: 'production',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
    compression: 'gzip',    // CI 环境节省磁盘
    name: `prod-${process.env.NODE_ENV}`,
  },
}
```

---

## 八、cache 不一定更快：用 trace 文件定量分析

filesystem 缓存有序列化/反序列化开销。**当这个开销超过了重新编译的时间时，cache 反而拖慢构建。**

典型场景：Next.js 默认开启了 webpack filesystem 缓存，但项目较小时缓存读写可能比直接编译还慢。

### 什么时候 cache 反而有害

| 场景 | 原因 |
|---|---|
| 项目小、模块少 | 编译本身很快，缓存的序列化开销占比反而大 |
| CI 单次构建（无缓存复用） | 每次都是首次构建，白白多了序列化成本 |
| 磁盘 I/O 慢（Docker 挂载卷） | 读写缓存文件本身成了瓶颈 |
| 缓存膨胀/失效频繁 | 大量时间花在反序列化后又发现失效 |

### 生成 trace 文件

```bash
# Next.js
NEXT_WEBPACK_PROFILING=1 next build

# 原生 webpack（CLI）
webpack --profile --json=stats.json
```

```js
// 原生 webpack（配置文件）
module.exports = {
  profile: true,
  cache: {
    type: 'filesystem',
    profile: true,  // 额外输出每个缓存项的耗时
  },
}
```

### 分析 trace 文件

1. 打开 Chrome → 地址栏输入 `chrome://tracing`
2. 点 **Load** 加载生成的 `.trace` 文件
3. 查看火焰图中各阶段耗时

### 火焰图中关注的阶段

| 阶段 | 含义 | 常见问题 |
|---|---|---|
| `cache deserialize` | 从磁盘读取缓存 | 耗时长说明缓存文件太大或磁盘慢 |
| `cache serialize` | 将编译结果写入磁盘 | 首次构建的额外开销 |
| `build module` | 编译模块 | 某个 loader 太慢 |
| `seal` | 模块封装/优化 | splitChunks 规则过于复杂 |
| `code generation` | 代码生成 | 模块数量过多 |
| `optimization` | Tree shaking 等优化 | 可关闭不需要的优化项 |

### 如何判断 cache 是否拖慢了构建

如果 trace 中看到这种模式：

```
cache deserialize  ████████████████████  耗时很长
build modules      ████                  耗时很短
cache serialize    ██████████████████    耗时很长
```

缓存读写时间远超实际编译时间 → cache 是负优化，应该关闭或换成 memory。

### Next.js 中调整 cache 策略

```js
// next.config.js
module.exports = {
  webpack: (config) => {
    // 关闭 filesystem 缓存，退回内存缓存
    config.cache = { type: 'memory' }

    // 或者完全关闭
    config.cache = false

    return config
  },
}
```

> 建议先用 trace 做对比测试：开 cache vs 关 cache 的实际构建时间，用数据决策。

---

## 总结

| 问题 | 解决方案 |
|---|---|
| dev-server 增量编译慢 | `type: 'memory'`（默认已开启） |
| 冷启动慢（关了 dev-server 再开） | `type: 'filesystem'` |
| CI/CD 每次全量构建太慢 | `type: 'filesystem'` + CI 缓存目录 |
| 改了配置但缓存没更新 | `buildDependencies.config: [__filename]` |
| 环境变了需要手动失效 | 修改 `version` |
| 内存占用太高 | 调低 `maxMemoryGenerations` |
| 多份 webpack 配置互相污染 | 设置不同的 `name` |
| 怀疑 cache 拖慢构建 | 生成 trace 文件，用 `chrome://tracing` 分析 |
| 确认 cache 是负优化 | 关闭 filesystem 缓存或退回 memory |
