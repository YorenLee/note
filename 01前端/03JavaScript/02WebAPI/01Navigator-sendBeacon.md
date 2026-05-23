# Navigator.sendBeacon()

> 学习笔记骨架：自己填内容，理解才会扎实。
> 每一节下面的「思考问题」都先自己回答，再去查 MDN 验证。

---

## 一、它是什么

navigator.sendBeacon() 方法可用于通过 HTTP POST 将**少量数据 异步** 传输到 Web 服务器，属于浏览器提供的能力


## 二、为什么需要它（解决什么问题）

场景：用户关闭页面前，我想上报一条"用户在这个页面停留了 30 秒"的埋点。

**思考问题：**
- 如果我用 `fetch('/log', {...})`，在 `beforeunload` 或 `pagehide` 里调用，会发生什么？
- 浏览器为什么会"中途取消"这个请求？
- 用 `XMLHttpRequest` 的 **同步模式**（`async = false`）能解决吗？带来什么副作用？
- `sendBeacon` 是怎么绕开这些问题的？

### 展开讲解

#### 核心心智模型：页面是怎么"死掉"的

把浏览器想成一栋楼：

- 每个标签页 = 一个**房间**（一个独立的渲染进程 / 执行环境）
- 房间里住着：JS 引擎、DOM、定时器、网络请求……
- **关闭标签页 / 跳转 = 房间被拆掉**，里面的所有东西都被强制清理
- 而**浏览器本身**（楼的管理处）一直运行，不会因为某个房间被拆而消失

记住这个模型，下面就好理解了。

#### 1. 用 `fetch` 在 `pagehide` 里发请求，会发生什么？

直觉写法：

```js
window.addEventListener('pagehide', () => {
  fetch('/log', { method: 'POST', body: JSON.stringify({ stay: 30 }) })
})
```

看起来没毛病，但**实际上经常发不出去**，尤其是用户点链接跳走时。

原因：`fetch` 是异步的，它做的事情是：

1. 把请求"挂"在当前页面的执行环境（房间）里
2. 立即 `return`
3. 真正的网络 IO 后续才慢慢发生

第 2 步刚结束，浏览器就开始**拆房间**了。请求还没真正发到网络上，承载它的环境已经没了 → 请求被中断。

> 比喻：你退房时跟前台说"麻烦把发票寄给我"，然后转身就走。前台被叫去办下一位客人的入住，你的发票还没打印就被搁置 —— 因为你这个"上下文"已经不存在了。

**最坑的地方**：不是 100% 失败，而是**不稳定**。本地测试可能没事，线上数据莫名其妙就少 20%。

#### 2. 浏览器为什么"中途取消"这个请求？

更深一层的原因，来自浏览器的**优先级哲学**：

> 让用户尽快看到下一个页面 >>> 让上一个页面把没干完的事干完

对浏览器来说，用户感受第一。如果点链接还要等上个页面把所有 fetch 都发完才跳走，用户会觉得"浏览器卡死了"。

所以策略是：**卸载页面时，毫不留情地清理掉所有未完成的异步任务**（fetch / XHR / setTimeout / Promise……）。

这是**故意的设计**，不是 bug。理解了这点，就明白为什么需要一个"特殊待遇"的 API。

#### 3. 用同步 XHR 能解决吗？副作用是什么？

历史上的做法：

```js
window.addEventListener('beforeunload', () => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/log', false)
  xhr.send(JSON.stringify({ stay: 30 }))
})
```

**能用，但代价巨大。** 同步 XHR 会**强行卡住主线程**，直到请求完成才让代码往下走 —— 浏览器必须等你这个请求干完才敢拆房间。

副作用：

| 副作用 | 后果 |
|---|---|
| 阻塞主线程 | 用户点链接 → 页面卡住几百毫秒～几秒 → 才跳走 |
| 弱网更惨 | 移动端可能卡 5 秒以上，用户以为浏览器死了 |
| 正在被淘汰 | Chrome / Firefox 已警告 `Synchronous XHR is deprecated`，未来会移除 |


死路一条：能"发出去"，但用户体验报废。

#### 3.5 图片打点法（百度之前也有zhe yan）（Image Beacon / Pixel Tracking）

`sendBeacon` 出现之前的**事实标准**，Google Analytics 经典版 `ga.js` 就是这么干的。

```js
window.addEventListener('pagehide', () => {
  new Image().src = '/log?stay=30&uid=123'
})
```

服务端通常返回一个 1×1 透明 GIF，或干脆 `204 No Content`。

**为什么它在卸载时能撑住：**

浏览器对**资源加载请求**（图片 / CSS / 字体）有特殊待遇 —— 认为它们是"页面的一部分"，所以会**延迟卸载文档**直到这些资源加载完成。

回到"楼 / 房间"心智模型：

```
fetch 请求 = 你的私人快递 → 拆房间时直接扔掉 ❌
图片请求  = 物业派的工程车 → 拆房间前会等它先开走 ✅
sendBeacon = 楼下邮筒  → 跟你房间无关，永远能发 ✅
```

**它的局限（也是 `sendBeacon` 出现的动机）：**

| 局限 | 说明 |
|---|---|
| 只能 GET | 数据全塞 URL query，没法发请求体 |
| URL 长度限制 | 大部分服务器约 2KB，超了被截断或返回 414 |
| 不能发 JSON body | 复杂数据要 `encodeURIComponent`，又笨又费空间 |
| 可靠性"中等" | 现代浏览器（特别是移动端）不一定都遵守"延迟卸载等图片" |
| 性能监控里分类不清 | 在 Network 面板被记为图片类型 |

**现在的定位**：作为 `sendBeacon` 不支持时的**降级兜底方案**。

#### 4. `sendBeacon` 是怎么绕开这些问题的？

核心思路：**把"发送任务"从房间里搬到楼的管理处。**

调用 `navigator.sendBeacon(url, data)` 时，浏览器**不是**把请求挂在当前页面的执行环境里，而是把数据"投递"给**浏览器进程本身**的一个发送队列。

```
普通 fetch：
[页面执行环境] —— 持有 —— [请求]
       ↓ 页面卸载
       房间被拆 → 请求一起销毁 ❌

sendBeacon：
[页面执行环境]
       ↓ 投递
[浏览器进程的发送队列] —— 持有 —— [请求]
       ↓ 页面卸载
       房间被拆，但队列在浏览器进程里 → 请求继续发 ✅
```

于是 `sendBeacon` 做到了鱼和熊掌兼得：

| 特性 | 含义 |
|---|---|
| **异步** | 调用后立即返回，不阻塞页面跳转（解决了同步 XHR 的副作用） |
| **可靠** | 即使页面已关闭，浏览器进程还活着，会保证发完（解决了 fetch 被中断的问题） |
| **轻量** | 代价：**只能 POST、有大小限制（约 64KB）、拿不到响应** |

最后这一行的"代价"很关键 —— `sendBeacon` 是**为单一场景特化**的 API：**只管发出去，不管对面回什么**。这就是它能"可靠"的原因：不需要等响应、不需要错误处理，浏览器实现起来就轻量。

#### 5. 四种历史方案对比（终极版）

| 方案 | HTTP 方法 | 数据大小 | 卸载时可靠性 | 阻塞跳转 | 现在还推荐吗 |
|---|---|---|---|---|---|
| `fetch` | 任意 | 无限制 | ❌ 差 | 否 | ❌ |
| 同步 `XHR` | 任意 | 无限制 | ✅ 好 | ❌ 严重 | ❌ 已废弃 |
| `<img>` GET | 仅 GET | ~2KB | ⚠️ 一般 | 否 | ⚠️ 降级用 |
| `sendBeacon` | 仅 POST | ~64KB | ✅ 好 | 否 | ✅ |
| `fetch + keepalive` | 任意 | ~64KB | ✅ 好 | 否 | ✅（更现代） |

#### 6. 演化关系（重要的"思想脉络"）

这几个方案不是"取舍关系"，而是**演化关系**：

```
图片打点（2005）      → 解决了"卸载时还能发请求"
   ↓ 缺点：只能 GET、URL 太短
sendBeacon（2014）    → 解决了"能 POST、能发更大数据"
   ↓ 缺点：只能 POST、拿不到响应、有大小限制
fetch + keepalive（2018+） → 解决了"想用现代 API + 自由度"
```

**写 SDK 时的典型降级链：**

```
1. 优先：fetch + keepalive    （最现代）
   ↓ 不支持
2. 降级：navigator.sendBeacon  （兼容性极好）
   ↓ 不支持
3. 兜底：new Image().src = ... （远古浏览器，全兼容）
```

#### 一句话总结

> `fetch` 在页面卸载时会被一起销毁；同步 `XHR` 虽然能发出去但会卡死跳转；`<img>` 利用浏览器对资源请求的"延迟卸载"特殊待遇，但只能 GET 且数据量小；`sendBeacon` 通过把请求**移交给浏览器进程**，做到了"异步 + 可靠 + 不阻塞"的三全其美，代价是只能 POST、不能拿响应、有大小限制。


## 三、语法

```js
navigator.sendBeacon(url, data)
```

**参数：**
- `url`：请求目标地址（绝对或相对路径），跨域时受 CORS 影响
- `data`：可以是 `string` / `Blob` / `FormData` / `URLSearchParams` / `ArrayBuffer` / `TypedArray` / `null`

**返回值：**
- `true`：浏览器已成功把请求**加入发送队列**
- `false`：加入队列失败（最常见原因：超过大小限制 ~64KB）

**思考问题**
- 返回 `true` 是不是表示"服务器已经收到"？（小心，这是个坑）
- 它发出去的请求是 GET 还是 POST？
- 在控制台能否发现？

### 展开讲解

#### 1. `data` 参数：藏着最大的坑 ——「自动 Content-Type」

`data` 真正的关键不在"可以传什么"，而在**浏览器会自动设置什么 `Content-Type` 请求头**：

| 传入类型 | 自动 Content-Type | 说明 |
|---|---|---|
| `string` | `text/plain;charset=UTF-8` | ⚠️ 直接传 JSON 字符串时**不是** `application/json` |
| `Blob`（无 type） | 无 / `application/octet-stream` | 二进制场景 |
| **`Blob`（带 type）** | **用 Blob 自己的 type** | ⭐ 发 JSON 的正确姿势 |
| `FormData` | `multipart/form-data; boundary=...` | 表单数据 |
| `URLSearchParams` | `application/x-www-form-urlencoded` | URL 编码键值对 |
| `ArrayBuffer` / `TypedArray` | 无 | 二进制 |
| `null` / 不传 | 无 | 只触发一次"心跳信号" |

**典型踩坑代码：**

```js
navigator.sendBeacon('/log', JSON.stringify({ stay: 30 }))
```

看起来很自然，但后端用 `express.json()` 等 JSON 中间件**解析不出来** —— 因为请求头是 `Content-Type: text/plain`，JSON 中间件根本不会去 parse。

**正确姿势：用 `Blob` 显式指定 type**

```js
const blob = new Blob(
  [JSON.stringify({ stay: 30 })],
  { type: 'application/json' }
)
navigator.sendBeacon('/log', blob)
```

> **为什么有这个奇葩设计？**
> `sendBeacon` 最初是为"简单埋点"（key=value）设计的，默认 `text/plain` 够用。
> 后来大家想发 JSON，规范就让你"通过 `Blob` 自带 type 覆盖默认行为" —— 这是个历史包袱。

#### 2. 返回 `true` 不代表"服务器已经收到"

`true` 只表示：**浏览器接受了你的委托，加入了发送队列**，仅此而已。

之后会发生什么，你完全不知道：

- 网络断了 → 你不知道
- 服务器 500 → 你不知道
- DNS 解析失败 → 你不知道
- 服务器返回 403 → 你不知道

而且**没有任何回调、Promise、事件**可以告诉你结果。

> 回到上一节的"邮筒"比喻：
> 你把信扔进邮筒，邮筒"咔嗒"一声 → 这就是 `true`。
> 但信是否被对方收到、是否在路上丢了，**你永远不会知道**。

这是 `sendBeacon` 的**核心权衡**：**牺牲了反馈能力，换来了可靠的"投递"行为。**

**实战建议**：重要数据不要靠它发，只发**丢了也无所谓的统计数据**。

#### 3. 永远是 POST，没得选

规范死规定，没有选项可改。

设计理由：

- GET 有 URL 长度限制（~2KB）
- POST 能发请求体（最多 ~64KB）
- 既然要发数据，POST 更合理

这也是它取代「`<img>` 打点法」的关键 —— 图片只能 GET，sendBeacon 能 POST。

#### 4. 在 DevTools 怎么找到它？—— Type 列显示 `ping`

| 请求方式 | Network 面板 Type 列 |
|---|---|
| `fetch()` | `fetch` |
| `XMLHttpRequest` | `xhr` |
| `<img>` 打点 | `png` / `gif` |
| **`sendBeacon`** | **`ping`** ⭐ |

> **为什么是 `ping`？** 因为 `sendBeacon` 和 `<a ping="...">` 属性在浏览器底层**走的是同一套机制**。

##### 调试时的两个坑

**坑 1：页面已经跳走了，Network 面板被清空**

`sendBeacon` 通常在 `pagehide` / `visibilitychange` 时调用，页面马上跳走，Network 面板默认会清空。

✅ 解决：勾选 **`Preserve log`**（保留请求记录）

**坑 2：Filter 默认不含 Ping**

Network 顶部过滤器（All / Fetch/XHR / JS / CSS / Img / ...）**没有 "Ping" 选项**。要在 `All` 模式下，或在搜索框输入 `ping` 筛选。

##### 调试最佳实践流程

```
1. Network 面板
2. 勾选 ✅ Preserve log
3. Filter 切到 All
4. 搜索框输入：method:POST  或  type:ping
5. 然后再触发 sendBeacon
```

#### 一句话总结（要记住的 4 件事）

1. **想发 JSON？用 `Blob` 包一下**，否则 `Content-Type` 是错的
2. **返回 `true` 不代表服务器收到**，没有任何反馈机制
3. **永远是 POST**，没得选
4. **调试时找 Type = `ping`**，记得勾 `Preserve log`

---

## 四、和 fetch / XHR 的区别（核心对比）

### 4.1 核心对比表（完整 5 列版）

| 维度 | `fetch` | `XHR (sync)` | `<img>` GET | `sendBeacon` | `fetch + keepalive` |
|---|---|---|---|---|---|
| 同步 / 异步 | 异步 | **同步**（阻塞主线程） | 异步 | 异步 | 异步 |
| 页面卸载时是否保证发出 | ❌ 会被取消（不稳定） | ✅ 保证 | ⚠️ 一般（移动端不稳） | ✅ 保证 | ✅ 保证 |
| 是否阻塞页面跳转 | ❌ 不阻塞 | ⚠️ 严重阻塞（可能几秒） | ❌ 不阻塞 | ❌ 不阻塞 | ❌ 不阻塞 |
| 是否能拿到响应 | ✅ 能 | ✅ 能 | ❌ 不能（只能监听 `onload`） | ❌ 拿不到，连"是否到服务器"都不知道 | ✅ 能（未卸载时） |
| 数据大小限制 | 无 | 无 | ~2KB（URL 长度） | ~64KB（单次） | **~64KB（整页共享配额）** ⚠️ |
| HTTP 方法 | 任意 | 任意 | 仅 GET | 固定 POST | 任意 |
| 自定义 headers | ✅ | ✅ | ❌ | ❌（只能靠 Blob type 间接定） | ✅ |
| 现在还推荐吗 | ✅（非卸载场景） | ❌ 已废弃 | ⚠️ 降级兜底 | ✅ | ✅✅（首选） |

**思考问题（复习时先盖住答案自问）：**
- `fetch` 的 `keepalive: true` 选项和 `sendBeacon` 有什么关系？
- 如果都能用，什么时候用 `fetch + keepalive`，什么时候用 `sendBeacon`？

### 4.2 展开讲解：`fetch + keepalive` —— `sendBeacon` 的"现代继任者"

#### 它是什么

```js
fetch('/log', {
  method: 'POST',
  keepalive: true,
  body: JSON.stringify({ stay: 30 }),
  headers: { 'Content-Type': 'application/json' }
})
```

只比普通 fetch 多了 `keepalive: true` 这一行。

#### 它和 `sendBeacon` 的本质关系：**底层是同一套机制**

回到"楼 / 房间"心智模型：

```
普通 fetch：
[页面执行环境] —— 持有 —— [请求]
       ↓ 页面卸载
       房间被拆 → 请求一起销毁 ❌

fetch + keepalive：
[页面执行环境]
       ↓ keepalive=true 时投递
[浏览器进程的发送队列] —— 持有 —— [请求]   ← 和 sendBeacon 在同一个地方
       ↓ 页面卸载
       请求继续发 ✅
```

也就是说：**`keepalive: true` = 用 fetch 的语法调用 sendBeacon 的能力。**

#### 那为什么 `sendBeacon` 没被完全替代？

关键差异在**兼容性**和**配额**：

| 维度 | `sendBeacon` | `fetch + keepalive` |
|---|---|---|
| HTTP 方法 | 仅 POST | **任意**（PUT/DELETE/PATCH） |
| 自定义 headers | 不能 | **可以**（Authorization 等） |
| 拿响应 | 不能 | 能（页面未卸载时） |
| 大小配额 | 每次 64KB，**互相独立** | **整页共享 64KB** ⚠️ |
| 兼容性 | 极好（基本全员支持） | Chrome 66+ / Firefox 109+ / Safari 13+ |

#### 隐藏大坑：`keepalive` 的 64KB 是**整页共享**的

很多人不知道，规范规定 keepalive 请求的配额是**整个页面生命周期内共享**：

```js
fetch('/log1', { keepalive: true, body: bigBlob1 }) // 50KB → OK
fetch('/log2', { keepalive: true, body: bigBlob2 }) // 30KB → ❌ 超过 64KB 总额
```

设计原因：防止页面用 keepalive 发起大量大请求，把卸载阶段拖太久。

**而 `sendBeacon` 是每次独立 64KB**，所以如果你要发多条大数据，反而 `sendBeacon` 更合适。

#### 什么时候用谁？决策表

| 场景 | 推荐 |
|---|---|
| 2026 年新项目，团队代码风格统一用 fetch | ✅ `fetch + keepalive` |
| 需要 Authorization / 自定义 headers | ✅ `fetch + keepalive` |
| 需要 DELETE / PUT 等非 POST 方法 | ✅ `fetch + keepalive` |
| 需要拿响应做判断（非卸载场景） | ✅ `fetch + keepalive` |
| 单次数据 < 64KB，但**总量大**（要多条） | ✅ `sendBeacon`（独立配额） |
| 维护老项目、要兼容旧移动浏览器 | ✅ `sendBeacon` |
| 想代码极简、一行搞定 | ✅ `sendBeacon` |
| 都不可用（远古浏览器） | ✅ `<img>` 兜底 |

#### 一句话总结

> `fetch + keepalive` 是 `sendBeacon` 的"现代继任者"，底层走同一套机制，但有更现代的 API、能用任意方法和 headers。代价是大小配额整页共享，兼容性稍差。**新项目首选 `keepalive`，老项目兼容用 `sendBeacon`，远古浏览器降级到 `<img>`。**

---

## 五、典型使用场景

列出至少 3 个：

1. 埋点上报（PV / UV / 点击）
2. 阅读完成率
3. 视频观看时长
4. 页面退出行为

---

## 六、代码示例

**核心问题：我应该在哪个事件里调用 `sendBeacon`？**

**思考问题：**
- 为什么现在推荐用 `visibilitychange` 而不是 `beforeunload`？
- 移动端 Safari 上 `beforeunload` 有什么坑？
- 什么是 bfcache？为什么监听 `unload` 会破坏它？

### 6.1 "离开页面"远比你想的复杂

听起来简单"用户离开页面时上报"，但 **"离开"有 N 种方式**，浏览器对它们的处理也不一样：

| "离开"方式 | 例子 |
|---|---|
| 关闭标签页 | 点 X |
| 页面跳转 | 点链接 / 提交表单 |
| 切换标签页 | Cmd+Tab |
| 切到后台 | 手机按 Home 键、锁屏 |
| 应用被系统杀 | iOS 内存不足 |
| 浏览器崩溃 | 罕见但有 |

不同事件捕捉到的"离开"不一样 —— 这就是为什么事件选择是个专门要讨论的话题。

### 6.2 四个候选事件对比

| 事件 | 触发时机 | 移动端可靠性 | 破坏 bfcache？ | 现状 |
|---|---|---|---|---|
| `beforeunload` | 即将卸载前 | ❌ iOS Safari 经常不触发 | **是** | Chrome 也在限制 |
| `unload` | 真正卸载时 | ❌ iOS Safari 完全不触发 | **是** | ⚠️ Chrome 117+ 已弃用 |
| `pagehide` | 页面被隐藏（含卸载 + 进 bfcache） | ✅ 好 | 否 | ⭐ 兜底首选 |
| **`visibilitychange`** | 可见性变化（hidden / visible） | ✅✅ **最好** | 否 | ⭐⭐ **首选** |

### 6.3 三个关键概念

#### 概念 1：iOS Safari 上 `unload` / `beforeunload` 几乎不触发

**根本原因**：iOS 的应用生命周期跟桌面完全不一样。

桌面浏览器：

```
打开页面 → 浏览 → 关闭 → 触发 unload ✅
```

iOS Safari：

```
打开页面 → 浏览 → 用户按 Home → 应用切到后台 → 系统可能直接杀掉 Safari
                                              ↑
                                       这里没有任何"卸载"过程 ❌
```

所以你要是依赖 `unload` 做埋点，**iOS 用户的数据会大量丢失**。

> 这是埋点 SDK 作者**必踩的坑**。Google Analytics 早年因此丢了海量 iOS 数据，后来才改用 `visibilitychange`。

#### 概念 2：`visibilitychange` 为什么是首选

它捕捉的是**"页面是否可见"**这个更通用的概念，是 `unload` 的**超集**：

| 触发 `hidden` 的场景 | `unload` 会触发吗 | `visibilitychange` 会触发吗 |
|---|---|---|
| 切到其他标签页 | ❌ | ✅ |
| 手机锁屏 | ❌ | ✅ |
| 切到后台 App | ❌ | ✅ |
| 关闭标签页 | ✅ | ✅（通常先于 unload） |
| 页面跳转 | ✅ | ✅ |

#### 概念 3：bfcache（Back/Forward Cache）—— 别忽视的现代优化

**什么是 bfcache：**

```
用户在 A 页面 → 跳到 B 页面 → 点后退
                              ↓
                       A 页面瞬间恢复（DOM、JS 状态都在）
                       毫秒级，不重新加载
```

现代浏览器（Chrome 96+ / Safari / Firefox）都支持，是用户体验的核武器。

**为什么 `unload` / `beforeunload` 会破坏它：**

> "你都监听 unload 了，说明你依赖卸载行为，那我不敢把你冻起来，得真的卸载你一次。"

浏览器的逻辑就是这样：检测到这两个事件被监听 → **不把页面放进 bfcache**。

所以传统埋点代码会**默默破坏整个网站的回退性能**。这是 Google 团队近年大力推 `visibilitychange` 的核心动机。

### 6.4 最小可用示例

```js
function reportLog(data) {
  const blob = new Blob(
    [JSON.stringify(data)],
    { type: 'application/json' }
  )
  navigator.sendBeacon('/log', blob)
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    reportLog({ stay: 30 })
  }
})
```

> 注意用 `Blob` 包 JSON，前面第三节讲过的"Content-Type 坑"。

### 6.5 推荐的最佳实践（双保险 + 去重）

实战中通常**同时监听** `visibilitychange` + `pagehide`，互为兜底：

| 场景 | `visibilitychange` | `pagehide` |
|---|---|---|
| 切到后台 | ✅ 触发 | ❌ 不触发 |
| 关闭标签页 | ✅ 触发（通常先） | ✅ 也触发 |
| 页面跳转 | 部分浏览器触发 | ✅ 触发 |

```js
let reported = false

function reportLog(data) {
  if (reported) return
  reported = true

  const blob = new Blob(
    [JSON.stringify(data)],
    { type: 'application/json' }
  )
  navigator.sendBeacon('/log', blob)
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    reportLog({ stay: getStayTime() })
  }
})

window.addEventListener('pagehide', () => {
  reportLog({ stay: getStayTime() })
})
```

**两个细节：**

1. `reported` 标志位防止两个事件都触发时**重复上报**
2. 如果业务允许多次上报（比如每次切后台都要计一次），把 `reported` 逻辑挪到服务端按 sessionId 去重

### 6.6 一句话总结

> **新代码请用 `visibilitychange` + `pagehide` 双保险**。**绝对不要用 `unload` / `beforeunload`** —— 它们在 iOS 上不触发，会丢数据；还会破坏 bfcache，连累整个网站的回退性能。

---

## 七、注意事项 / 常见坑

自己边查边补充：

- [ ] 数据大小有上限（大约多少 KB？超过会怎样？）
- [ ] 返回值 `true` 不代表服务器收到，只代表"已加入发送队列"
- [ ] CORS：跨域时服务端要不要配？响应头有要求吗？
- [ ] `Content-Type` 是怎么决定的？传 `Blob` 时怎么自定义？
- [ ] HTTPS / HTTP 混用有没有限制？

## 八、延伸阅读

- MDN: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
- W3C Beacon 规范：
- Google Web.dev 关于卸载时上报的最佳实践：
## 九、我学到了什么

> 看完 / 填完整篇之后，回到这里，用 3-5 句话总结：
> 1. sendBeacon 解决了什么问题？
> 2. 它和 fetch 最本质的区别是什么？
> 3. 我以后什么场景会用它？
