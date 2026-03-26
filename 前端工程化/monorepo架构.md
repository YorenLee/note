
## npm 存在的问题

### 1. 幽灵依赖（Phantom Dependencies）

npm 采用扁平化（flat）安装策略，会把子依赖提升（hoist）到顶层 `node_modules`：

```json
// package.json 只声明了 A
{ "dependencies": { "A": "1.0.0" } }
```

```
// A → B → C，安装后 C 被提升到顶层
node_modules/
 A/
 B/
 C/ ← 未声明，但可以直接 import
```

项目代码可以直接 `import C`，但 C 并不在 `package.json` 里。一旦 A 升级后不再依赖 C，项目就会莫名报错。
### 2. node_modules 体积巨大
- 每个项目维护一份**完整的** `node_modules` 副本
- 项目之间**不共享缓存**，同一个包在不同项目中重复存储
- 磁盘占用随项目数量线性增长
### 3. 安装速度慢
- 依赖**串行下载**，无法充分利用网络带宽
## yarn 的改进与局限
### 解决了什么
| 问题 | yarn 的解法 |
|------|------------|
| 安装慢 | **并行下载** + **本地缓存**（缓存的是已解压文件，直接复用，无需再解压） |
| 版本不确定 | **yarn.lock** 精确锁定每个依赖及其子依赖的版本（npm 的 lock 对子依赖解析逻辑较宽松） |
### 没解决什么
- 依然采用**扁平化** `node_modules`，**幽灵依赖问题依旧存在**
## pnpm 的突破

### 1. 解决幽灵依赖 → 严格隔离依赖
pnpm 的 `node_modules` **不是扁平化的**，而是采用 **严格嵌套 + 虚拟符号链接（symlink）** 结构：

```
node_modules/
.pnpm/ ← 所有包的真实存放位置（虚拟存储）
	 react@18/
	  node_modules/
	   react/ → 硬链接到全局 store
	 lodash@4/
	   node_modules/
		lodash/ → 硬链接到全局 store
	react/ → 符号链接到 .pnpm/react@18/node_modules/react
```

未在 `package.json` 中声明的包，在顶层 `node_modules` 中**找不到**，从根本上杜绝了幽灵依赖。
### 2. 全局 Store + 硬链接 → 省空间、速度快

| 特性       | 说明                                |
| -------- | --------------------------------- |
| 全局 Store | 所有下载过的包统一存储在全局 `~/.pnpm-store/`   |
| 硬链接      | 项目中的包通过**硬链接**指向全局 Store，不占额外磁盘空间 |
| 多项目复用    | 10 个项目用同一个 `react@18`，磁盘上只存一份     |
| 并行安装     | 结合并行下载，安装速度极快                     |

## 四、Monorepo 架构
### 什么是 Monorepo
将多个相关项目（包）放在**同一个仓库**中管理，共享依赖、工具链和配置。
### 配置入口：pnpm-workspace.yaml

`pnpm-workspace.yaml` 是 monorepo 的入口配置，声明哪些目录是工作区包：

```yaml
packages:
- './bohrium-shared'
- './bohrium-domains'
- './bohrium-space'
- './bohrium-next-app'
```
### 项目结构

```
my-repo/
├── pnpm-workspace.yaml ← monorepo 入口配置
├── package.json ← 根 package.json（定义 workspaces）
├── bohrium-shared/ ← 可复用 UI 组件库
│ └── package.json
├── bohrium-domains/ ← 共享业务逻辑
│ └── package.json
├── bohrium-space/ ← Vite + React SPA
│ └── package.json
└── bohrium-next-app/ ← Next.js SSR 应用
└── package.json
```
### 包间依赖：workspace 协议

在 monorepo 中，包之间的引用使用 `workspace:*` 协议，pnpm 会自动解析为本地包的符号链接：

```json

{
"dependencies": {
"@bohrium/domains": "workspace:*",
"@bohrium/shared": "workspace:*"
}
}

```
- `workspace:*` 表示：始终使用本地工作区中的版本
- 无需发布到 npm，修改即时生效，开发体验无缝
### 依赖流向
```

bohrium-next-app ──┐

├──→ bohrium-domains ──→ bohrium-shared

bohrium-space ──┘

```
两个应用（next-app / space）共享 `domains` 业务逻辑，`domains` 又依赖 `shared` 组件库。