# bfcache (Back/Forward Cache)

> 学习笔记：先思考再展开。
> 起点：`01Navigator-sendBeacon.md` 第 6.3 节有简单介绍。

---

## 一、它是什么

一句话定义：

> bfcache（Back/Forward Cache，前进后退缓存）是浏览器的一种内存缓存机制——当你**离开页面但浏览器还活着**时，把**整个页面的运行时状态**（DOM、JS 上下文、滚动位置、表单数据……）原封不动地"冷冻"在内存里。下次后退/前进时，**毫秒级恢复**，连一行 JS 都不用重跑。

**思考问题：**
- 它是浏览器的功能还是 JS API？
- 它和 HTTP 缓存（Cache-Control）是同一个东西吗？

### 展开讲解

#### 核心心智模型：冷冻 vs 拆掉

继续用 sendBeacon 笔记里那个"楼-房间"的比喻：

- **普通页面卸载**：房间被**拆掉**，里面所有东西清理掉。下次回来要重新装修（重新加载、重新跑 JS、重新发请求……）
- **bfcache**：房间被**整个冷冻起来**——家具、电器、水杯里没喝完的水都在原位。下次回来一解冻就能继续用，连"我刚才滚动到哪儿了"都记得。

再精确一点，对比一下几种缓存到底缓存的是什么：

- **HTTP 缓存**：缓存"原材料"（HTML/JS/CSS/图片文件）。回来还要重新组装（解析 HTML、执行 JS、构建 DOM）。
- **Service Worker**：拦截网络请求自己决定怎么响应，本质还是缓存"响应"。页面本身仍然要重新执行。
- **bfcache**：缓存"成品 + 上下文"——已经组装好的页面 + JS 引擎里的**全部变量、闭包、定时器、事件监听器**。

这就是为什么 bfcache 后退**几乎瞬间完成**（< 50ms），而普通后退就算 HTTP 全命中也要几百毫秒——因为后者要重跑 JS。

#### bfcache vs 其他缓存（对比表）

| 维度 | bfcache | HTTP 缓存 | Service Worker | Memory Cache |
|---|---|---|---|---|
| 缓存对象 | 整个页面**运行时状态** | HTTP 响应（文件） | HTTP 响应（自定义） | 当前会话的资源 |
| 是否要重跑 JS | ❌ 不需要 | ✅ 需要 | ✅ 需要 | ✅ 需要 |
| 触发方式 | 后退/前进 | 任何请求 | 任何请求（被 SW 拦截） | 同会话再请求 |
| 控制者 | 浏览器（自动） | HTTP 头 | 开发者写 JS | 浏览器 |
| 持久化 | ❌ 关掉浏览器就丢 | ✅ 是 | ✅ 是 | ❌ 否 |

**关键结论**：bfcache 和 HTTP 缓存、Service Worker 是**完全不同维度**的东西，不是替代关系。它们经常配合工作——你后退到一个进了 bfcache 的页面，页面里再发的新请求依然走 HTTP/SW 缓存。

> 所以题目里那两个思考问题答案：bfcache 是**浏览器的能力**（不是 JS API，你只能"观察"它，不能"控制"它）；它和 HTTP 缓存**完全不是一个东西**。

---

## 二、为什么需要它（解决什么问题）

场景：用户在 A 页面 → 点链接到 B 页面 → 点浏览器后退按钮回 A。

**思考问题：**
- 没有 bfcache 时会发生什么？（重新发请求、重新执行 JS、滚动位置丢失……）
- 有了 bfcache 又是怎样的体验？

### 展开讲解

#### 没有 bfcache 时的代价

后退走"普通卸载 + 重新加载"的流程时，会发生**至少五件**用户能感受到的事：

1. **网络往返**：HTML 重新请求一次。即使 304 Not Modified 也要一个 RTT。
2. **JS 重新解析、编译、执行**：所有脚本从头跑。重型 SPA 这里能花几百毫秒。
3. **DOM 重新构建**：上次的 DOM 没了，要从 HTML 重新生成。
4. **数据请求重新发**：所有 `fetch` / SWR / React Query 都要重发，包括用户已经看过的列表。
5. **状态丢失**：滚动位置、表单输入、JS 内部状态全部归零。

最致命的是第 5 条——**用户最不能忍的就是"我刚才填到一半的搜索框空了"、"我刚滚到第 50 个商品的位置回到顶部了"**。

#### 有 bfcache 时的体验

把页面"挂起"在内存里，**用户感受是真正的"瞬间回到刚才"**：

- 后退耗时 < 50ms（视觉上几乎瞬间）
- 滚动位置在
- 表单内容在
- JS 状态在
- 视频从暂停处继续

#### Chrome 公开数据

来自 web.dev 上 Chrome 团队 2022 年的统计：

- 桌面 Chrome：~10% 的导航能命中 bfcache
- 移动 Chrome：~20% 的导航能命中 bfcache
- 命中时 **LCP 几乎为 0**，是常规导航的 10 倍以上速度

> 也就是说，能上 bfcache 的页面，其后退体验直接超越 99% 的"正常"页面。这是个低成本高回报的优化。

---

## 三、它是怎么工作的（心智模型）

**思考问题：**
- "冻结整个页面状态"具体冻结了哪些东西？DOM？JS 变量？定时器？网络连接？
- 为什么不是每个页面都能进 bfcache？

### 展开讲解

#### 心智模型："冷冻整间房间"

继续用比喻：

- JS 引擎、定时器、变量、事件监听器，全部**挂起**（不是销毁）
- 页面所有 task / microtask **暂停**
- 网络层面：未完成的请求会被取消；新的请求**不能发**（页面被冻住，没有"现在"）

还有个更日常的类比：**和操作系统的"睡眠"完全一样**。

- 普通卸载 = **关机**（关掉所有进程，下次开机要重启所有应用）
- bfcache 进入 = **睡眠**（合上笔记本盖子，内存里的数据保留，进程暂停）
- bfcache 恢复 = **唤醒**（打开盖子，瞬间回到刚才）
- 长时间没动 / 内存吃紧时 = **被强制关机**（被丢弃，下次后退走正常加载）

#### 哪些东西"冻住了"

| 类别 | 状态 | 说明 |
|---|---|---|
| DOM | ✅ 完整保留 | 包括动态生成的节点 |
| JS 变量 / 闭包 | ✅ 完整保留 | 整个 JS heap 都在 |
| 事件监听器 | ✅ 完整保留 | 解冻后继续生效 |
| 滚动位置 | ✅ 完整保留 | |
| 表单输入 | ✅ 完整保留 | input / textarea / select 都在 |
| `setTimeout` / `setInterval` | ⏸️ 暂停 | 解冻后**接着计时**（不是重置） |
| `Promise` | ⏸️ 暂停 | resolve/reject 的 then 回调在解冻后执行 |
| `requestAnimationFrame` | ⏸️ 暂停 | |
| 进行中的 fetch / XHR | ❌ 中断 | 进 bfcache 前会被取消 |
| WebSocket / WebRTC | ❌ 必须关 | 否则**页面进不了** bfcache |
| 媒体（video / audio） | ⏸️ 暂停 | 视频会暂停，恢复时停在原位 |

**关键点**：定时器和 Promise 是**挂起不是销毁**，所以一个"30 秒后做某事"的定时器，如果用户在第 10 秒进 bfcache、在第 5 分钟后退回来，那 30 秒的定时器**还要 20 秒**才会触发。

#### 容量与超时

各浏览器策略不同：

| 浏览器 | 最多同时缓存几个页面 | 单页超时 |
|---|---|---|
| Chrome | 6 个 | 10 分钟 |
| Safari | ~ | **30 秒**（最短） |
| Firefox | 5 个 | **30 分钟**（最长） |

> Safari 30 秒看起来很短，但其实跟 iOS 的内存压力管理有关。所以 iOS 上 bfcache 的命中率经常比桌面低。

超时后页面会被丢弃，下次后退走正常加载。

#### 为什么不是每个页面都能进

因为有些**运行时状态没法被"安全冻结"**：

- 你有一个开着的 WebSocket，冻起来对方服务器以为你还在线，但其实你的代码暂停了——**对方的消息你处理不了**。
- 你监听了 `unload` 事件，说明你自己声明"卸载时要做某些事"，浏览器不敢冻你（你想做的事不能再做了）。
- 你有未完成的 IndexedDB 事务——事务必须有头有尾，冻在中间可能导致死锁。

所以浏览器有一长串"如果你做了 X 就不冻你"的清单，下一节详细列。

---

## 四、什么情况下页面**不会**进 bfcache

按"常见到罕见"重新分类。

### 4.1 一定不会进（高频踩坑）

| 条件 | 根本原因 |
|---|---|
| 监听了 `unload` 事件 | 你声明"卸载时要做事"，浏览器不敢冻你，必须真卸载 |
| 监听了 `beforeunload` 事件 | 同上（Chrome 新版部分情况例外，但 Firefox/Safari 一律不冻） |
| 有未关闭的 `WebSocket` 连接 | 冻住意味着 socket 假死，无法处理对方消息 |
| 有未关闭的 `WebRTC` 连接 | 同上，实时连接不能冻 |
| 有进行中的 IndexedDB 事务 | 事务冻在中间 = 死锁风险 |
| 有进行中的 `fetch` / XHR（未完成） | 网络层挂着未 resolve 的请求 |
| 顶级 frame 在下载文件 | 用户已经在下东西，不能冻 |

### 4.2 服务端配置导致

| 条件 | 根本原因 |
|---|---|
| 主资源 `Cache-Control: no-store` | 服务端明确说"不要缓存我"，bfcache 也尊重这个 |
| 跨域 iframe 用了 `no-store` | 顶层页也会被连累 |
| HTTPS 证书错误 | 安全问题，不冻 |

### 4.3 各浏览器各自的策略

| 条件 | 哪些浏览器 |
|---|---|
| 用了 `BroadcastChannel` 且未关闭 | Chrome |
| 用了 WebUSB / WebBluetooth / 屏幕共享 | 多家 |
| 页面被另一个 tab 用 `window.opener` 持有 | 部分浏览器 |
| `Cache-Control: no-cache`（注意不是 `no-store`！） | Firefox 会阻止 |

### 4.4 实战判断方法

绝大多数情况下，**最常见的"杀手"就是 `unload` 事件监听器**。优化 bfcache 命中率的第一步：

1. 全局搜代码：`addEventListener('unload'` 和 `onunload =`
2. 别忘了**第三方 SDK**：旧版 Google Analytics、某些埋点 SDK、客服 widget、广告脚本都可能偷偷监听 `unload`
3. 用 Chrome DevTools 跑一次"测试 bfcache"（第八节会讲），它会直接告诉你哪个事件监听器在作怪

> 经验法则：项目里凡是出现 `unload`，先假设它是错的，改成 `pagehide`。

---

## 五、如何检测页面是否进了 bfcache

### 5.1 两个关键事件

| 事件 | 触发时机 | 用途 |
|---|---|---|
| `pagehide` | 页面被隐藏时——**普通卸载和进 bfcache 都会触发** | 在这里做"离开前"的清理 |
| `pageshow` | 页面被显示时——**首次加载和从 bfcache 恢复都会触发** | 在这里判断是不是从 bfcache 恢复 |

它们各自有一个 `persisted` 属性，**这是判断"是否进/出 bfcache"的唯一可靠开关**。

### 5.2 完整生命周期图

三种场景的事件触发顺序：

**场景 A：首次加载页面**

```
打开页面
  → DOMContentLoaded
  → load
  → pageshow { persisted: false }   ← 注意首次加载也触发，但 persisted 是 false
```

**场景 B：跳走但被阻止进 bfcache（例如监听了 unload）**

```
用户点链接
  → pagehide { persisted: false }   ← false 表示"我要被真正卸载了"
  → unload（如果有监听）
  → [页面被销毁]
```

**场景 C：跳走 + 进 bfcache + 后退回来（理想情况）**

```
用户点链接
  → pagehide { persisted: true }    ← true 表示"我要被冻起来了"
  → [页面被冻在内存里]
  ...
用户点后退
  → pageshow { persisted: true }    ← true 表示"我从 bfcache 复活"
```

注意：场景 C 里**完全没有触发 `unload` 和 `load`**。这是它和场景 B 的本质区别。

### 5.3 标准检测代码

```js
window.addEventListener('pagehide', (event) => {
  if (event.persisted) {
    console.log('要进 bfcache 了，做最后清理')
  } else {
    console.log('真的卸载了')
  }
})

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('从 bfcache 复活，可能要刷新数据')
  } else {
    console.log('首次加载或正常导航')
  }
})
```

**思考问题：**
- `pagehide` 事件的 `persisted` 字段呢？两个有什么区别？

> 答案：
> - `pagehide.persisted = true`：我**即将**被冻起来
> - `pageshow.persisted = true`：我**刚刚**从 bfcache 醒过来
>
> 一个用于"离开前的预告"，一个用于"回来后的通知"。

### 5.4 常见误区

❌ **误区 1：用 `load` 事件做"每次进入页面要做的事"**

`load` 事件**不会**在 bfcache 恢复时触发（页面没"加载"过，只是醒过来）。
想在"每次回到页面时"做事，必须用 `pageshow`。

❌ **误区 2：以为 `pageshow` 只在 bfcache 恢复时触发**

实际上每次进入页面都会触发（包括首次加载）。**必须判断 `event.persisted` 才能区分**。

❌ **误区 3：以为 `pagehide` 等价于 `unload`**

不是。`pagehide` 同时覆盖"卸载"和"进 bfcache"两种情况。这正是它的好处——**写一份代码处理两种离开**。

---

## 六、对开发有什么影响

### 6.1 埋点上报

直接看 `01Navigator-sendBeacon.md` 第六节。一句话总结：

> 用 `pagehide` + `visibilitychange` 配 `navigator.sendBeacon`，**绝对不要用 `unload` 和 `beforeunload`**——后者会让你整个站的 bfcache 都进不去。

### 6.2 实时数据要不要刷新

**典型场景**：

```
用户列表页 → 详情页里改了某条数据 → 后退 → 看到的是 bfcache 里的旧列表
```

判断标准：

| 数据类型 | 要不要在 bfcache 恢复时刷新 |
|---|---|
| 用户列表、订单列表（用户可能在别处改了） | ✅ 要刷新 |
| 商品详情、文章内容（变化频率低） | ⚠️ 看业务，通常不用 |
| 实时数据（股票、聊天） | ✅ 必须刷新 |
| 纯静态展示（关于我们页） | ❌ 不用 |

实战代码：

```js
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    refreshList()
  }
})
```

### 6.3 定时器：要小心"冻结期"

定时器在 bfcache 里**只是暂停**，不会重置。这件事**经常被忽略，但很危险**。

具体例子：

```js
// 用户打开页面 10:00:00，设了 30 秒后续 token 的定时器
setTimeout(refreshToken, 30 * 60 * 1000)  // 30 分钟

// 10:05:00 用户跳到别的页面 → 进 bfcache
// 11:00:00 用户后退回来 → 解冻
// 你以为：token 早就续过了（基于"实际时间"算）
// 实际上：定时器只走了 5 分钟，还要再过 25 分钟才触发！
// 结果：token 已经过期 N 分钟，但代码还没续，所有请求都 401
```

**正确做法**：在 `pageshow` 里**显式校验和重设**关键定时器。

```js
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    checkTokenExpiry()
    resetHeartbeatTimer()
  }
})
```

### 6.4 全局状态（Redux / Zustand / Context）

**好消息**：全局状态在 bfcache 里**完全保留**，跟普通 JS 变量一样冻起来——这正是 bfcache 厉害的地方。

**坏消息**：保留的可能是**过期数据**。常见处理：

```js
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    store.dispatch(invalidateStaleData())
  }
})
```

或者更精细地，标记每个 slice "上次更新时间"，恢复时按数据新鲜度决定是否刷新。

### 6.5 视频 / 音频

`<video>` 和 `<audio>` 在 bfcache 里会**暂停**。如果你做的是视频网站：

- 用户离开视频页 → 进 bfcache → 视频暂停在某秒
- 用户后退 → 解冻 → 视频还停在那一秒（不会自动播放）

通常这就是用户想要的行为，但如果你想"恢复时自动续播"，要在 `pageshow` 里手动 `video.play()`。

---

## 七、React / Next.js 项目里要注意什么

这节很重要，因为很多人以为"我用的是 SPA，bfcache 跟我没关系"——**这是个常见误解**。

### 7.1 SPA 路由 vs 浏览器导航（根本区别）

先搞清楚：bfcache **只在浏览器真正导航**（浏览器层面的页面跳转）时起作用。SPA 内部跳路由**不触发** bfcache。

| 行为 | 是不是浏览器导航？ | 会触发 bfcache？ |
|---|---|---|
| React Router 内部跳转（`<Link to="/foo">`） | ❌ 不是 | ❌ 不触发——没真正离开页面 |
| Next.js `<Link>` 跳同域路由 | ❌ 不是 | ❌ 不触发 |
| `window.location.href = '/foo'` | ✅ 是 | ✅ 可能触发 |
| 点链接跳到外站，再后退 | ✅ 是 | ✅ 会触发 |
| 地址栏改 URL，再后退 | ✅ 是 | ✅ 会触发 |
| `router.push('/foo')`（Next.js） | 看实现：App Router 是 SPA 跳转 | ❌ 不触发 |

**结论**：

- 纯 SPA 内部跳来跳去，bfcache 帮不上忙（也不需要——你本来就没销毁页面）
- 但用户**跳出去再回来**的场景，bfcache 仍然非常重要
- 也就是说，**bfcache 是优化"出站再回来"，不是优化"站内跳转"**

### 7.2 Next.js App Router 注意点

- App Router 默认是 SPA 路由（`<Link>` 不触发浏览器导航）
- 跳出域名再后退时，整个应用状态从 bfcache 恢复——**包括 React 内部的 hook state**
- **但 SSR 数据可能过期**：用户离开时服务端渲染的内容，回来时已是几分钟前的快照

推荐写法：从 bfcache 恢复时调用 `router.refresh()`，**重新请求服务端组件**但不丢客户端状态：

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function BfcacheRefresh() {
  const router = useRouter()

  useEffect(() => {
    const handler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh()
      }
    }
    window.addEventListener('pageshow', handler)
    return () => window.removeEventListener('pageshow', handler)
  }, [router])

  return null
}
```

把这个组件挂在 root layout 里，应用级生效。

### 7.3 SWR / React Query 怎么配合 bfcache

好消息：**它们都内置支持**。

**SWR**：

- 默认开启 `revalidateOnFocus` 和 `revalidateOnReconnect`
- 从 bfcache 恢复时，页面变 visible，会自动重新校验所有 key
- 一般不需要特别处理

**React Query**：

- `refetchOnWindowFocus`（默认 true）会在恢复时触发
- 行为类似 SWR

**但要小心**：如果某个 key 你设了 `revalidateOnFocus: false`（比如缓存策略），从 bfcache 恢复后**不会**自动刷新。需要手动加 `pageshow` 监听。

### 7.4 useEffect 不会重跑（坑）

这是新手最容易踩的坑：

```jsx
useEffect(() => {
  fetchData()
}, [])
```

- 页面进 bfcache 再恢复，组件**没有重新挂载**
- 所以 `useEffect` **不会重新执行**
- 你以为"每次进入页面都会拉数据"，其实只在挂载时拉一次

**对照一下传统 MPA**：每次进页面 JS 重新跑，`useEffect` 自然也跑。但 bfcache 让"再次进入页面"变成了"从睡眠中唤醒"，组件根本没死过。

**正确做法**：

- 用 SWR / React Query（自动处理）
- 或者在 `pageshow` 里手动 trigger 数据刷新

### 7.5 路由守卫别用 `beforeunload`

很多教程教的"未保存提示"长这样：

```js
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault()
    e.returnValue = ''
  }
})
```

这会**阻止整个站点进 bfcache**——你只是想在用户离开未保存表单时提醒一下，结果连累其他所有页面的后退性能。

**推荐做法**：

- 用框架内置的路由拦截（React Router 的 `useBlocker`、Next.js 的 `useBeforeUnload` 等）
- 或者**只在真正有未保存内容时**才**临时**添加 `beforeunload`，离开编辑态立刻移除

```tsx
useEffect(() => {
  if (!hasUnsavedChanges) return

  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [hasUnsavedChanges])
```

这样只在编辑期间临时阻止 bfcache，其他时间不影响。

---

## 八、如何调试

### 8.1 Chrome DevTools

最直接的方法：

1. 打开 DevTools → **Application** 面板
2. 侧边栏：**Background services** → **Back/forward cache**
3. 点击 **Test back/forward cache** 按钮（浏览器会自动跳到 about:blank 再回来）
4. 看结果：
   - ✅ **Restored**：成功进了 bfcache
   - ❌ **Not restored**：被阻止了，下面列出**所有原因**（NotRestoredReasons）

### 8.2 常见 NotRestoredReasons 翻译

| 错误码 | 含义 | 怎么修 |
|---|---|---|
| `UnloadHandler` | 监听了 `unload` | 删掉，改用 `pagehide` |
| `BeforeUnloadHandler` | 监听了 `beforeunload` | 只在必要时临时加 |
| `WebSocket` | 有打开的 WebSocket | 在 `pagehide` 里 close |
| `MainResourceHasCacheControlNoStore` | 主资源响应头是 `no-store` | 改 Cache-Control |
| `HasActiveIndexedDBConnection` | 有活跃 IDB 连接 | 在 `pagehide` 里关 |
| `BroadcastChannel` | 有打开的 BroadcastChannel | 在 `pagehide` 里 close |
| `ContentWithMacAddressOrigin` | 安全策略相关 | 通常是浏览器内部决定 |
| `OutstandingNetworkRequestFetch` | 有未完成的 fetch | 在 `pagehide` 里取消 |

### 8.3 Lighthouse

Lighthouse 报告里有一项叫 **"Page prevented back/forward cache restoration"**，会扫出阻止 bfcache 的所有原因。

CI 里加上这个检查能防止新代码倒退。

### 8.4 用 PerformanceObserver 上报命中率

如果你想统计自家站的 bfcache 命中率：

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.type === 'back_forward') {
      // 这次导航是从 bfcache 来的
      reportToAnalytics({
        type: 'bfcache_hit',
        duration: entry.duration,
      })
    }
  }
}).observe({ type: 'navigation', buffered: true })
```

`PerformanceNavigationTiming.type === 'back_forward'` 是判断"这次页面进入是不是 bfcache 恢复"的另一种方式。

### 8.5 浏览器差异要记得测

- Chrome / Firefox / Safari 的 bfcache 实现各有差异
- 同一个页面在 Chrome 上能进，在 Safari 上可能进不去
- **必须三家都测**，特别是涉及 WebSocket、IndexedDB 的页面

---

## 九、一句话总结

> **bfcache 是浏览器把整个页面"冷冻"在内存里的能力**，让后退/前进变成秒开。
>
> - 最大的杀手：`unload` 和 `beforeunload` 监听器
> - 最佳实践：用 `pagehide` 代替 `unload`，用 `pageshow` 的 `event.persisted` 判断是否从 bfcache 恢复
> - 恢复后要做的事：刷新可能过期的数据、校验 token、重置关键定时器
> - React/Next.js 项目同样需要关心，特别是"用户跳出去再回来"的场景

---

## 十、延伸阅读

- web.dev 完整指南：https://web.dev/articles/bfcache
- MDN bfcache 词条：https://developer.mozilla.org/en-US/docs/Glossary/bfcache
- Chrome 团队的测试指南：https://developer.chrome.com/docs/web-platform/back-forward-cache-testing
- NotRestoredReasons 完整列表：https://developer.mozilla.org/en-US/docs/Web/API/NotRestoredReasons
- Page Lifecycle API（关联概念）：https://developer.chrome.com/blog/page-lifecycle-api

---

## 十一、和其他主题的关联

- → `01Navigator-sendBeacon.md` 第 6.3 节：bfcache 是为什么不能用 `unload` 做埋点的根本原因
- → **Page Visibility API**：`visibilitychange` 是 bfcache 友好的"页面隐藏"信号，和 `pagehide` 配合使用
- → **Service Worker**：和 bfcache 不冲突，分别缓存"网络响应"和"运行时状态"
- → **HTTP Cache**：完全不同维度，但响应头（如 `Cache-Control: no-store`）会影响 bfcache 是否启用
- → **React Router / Next.js Router**：理解 SPA 路由和浏览器导航的区别，是判断 bfcache 何时生效的前提
- → 性能优化主题：bfcache 是少数"几乎免费的大幅性能优化"
