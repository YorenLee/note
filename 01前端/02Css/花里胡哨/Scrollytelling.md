# Scrollytelling 滚动叙事布局

## 什么是 Scrollytelling

用户滚动页面时，左侧图片区"粘"在视窗中，右侧叙事内容正常滚动。根据右侧滚动到的位置，左侧自动切换对应图片。支持多组叙事——一组播完后整体滚走，下一组接上来。

```
┌──────────────────────────────────────────┐
│            外层容器（唯一滚动条）           │
│  ┌──────────────────┬───────────────────┐ │
│  │   左侧 (sticky)   │  右侧 (正常流)    │ │
│  │   图片随章节切换    │  章节1 (100vh)    │ │
│  │                   │  章节2 (100vh)    │ │
│  │                   │  章节3 (100vh)    │ │
│  └──────────────────┴───────────────────┘ │
│  ┌──────────────────┬───────────────────┐ │
│  │   下一组 sticky    │  下一组章节...     │ │
│  └──────────────────┴───────────────────┘ │
└──────────────────────────────────────────┘
```

## 布局原理：为什么只有一个滚动条

一组容器用 flex 横向排列，左侧 sticky 固定高度，右侧多个章节把容器撑高，外层自然溢出产生唯一的滚动条。

```
.groupInner (flex 容器)
├── .stickyLeft     → width:50%, height:100vh, sticky
│                     自身不产生滚动，高度固定为一屏
└── .narrativeRight → width:50%, 内容撑高
    ├── 章节1 (min-height: 100vh)
    ├── 章节2 (min-height: 100vh)
    └── 章节3 (min-height: 100vh)
                      ↑ 三个章节 = 300vh，把 .groupInner 撑到 300vh
```

- 右侧有 3 个 `100vh` 的章节 → 父容器 `.groupInner` 被撑到 `300vh`
- 左侧 `sticky` 只有 `100vh`，但它不会限制父容器高度（flex item 的高度由最高的那个决定）
- 外层容器没有 `overflow: hidden`，所以 `300vh` 自然溢出到 `<body>` → 产生唯一的页面滚动条
- 左侧 `sticky` 在这 `300vh` 的滚动过程中一直粘在视窗顶部
- 当整个 `.groupInner` 滚出视窗，sticky 失效，左侧跟着走 → 下一组出现

**简单说：右侧撑高度，左侧 sticky 搭便车。**

## 核心 CSS

```css
.groupInner {
    display: flex;       /* 左右并排 */
}

.stickyLeft {
    width: 50%;
    position: sticky;    /* 粘在视窗 */
    top: 0;
    height: 100vh;       /* 固定一屏高 */
    flex-shrink: 0;
}

.narrativeRight {
    width: 50%;          /* 内容自然撑高 */
    flex-shrink: 0;
}

.chapter {
    min-height: 100vh;   /* 每个章节至少一屏 */
}
```

`sticky` 是整个布局的基石。它让左侧图片区在父容器 `.groupInner` 的范围内粘在视窗顶部。当父容器滚出视窗时，sticky 失效，左侧跟着走——这就是"一组播完自动滚走"的原理。

**致命坑：** 任何祖先元素设置 `overflow: hidden` 或 `overflow: auto`，sticky 直接失效。

---

## 三种实现方案对比

### 方案 A：IntersectionObserver（离散切换）

**原理：** 用浏览器原生 API 监听章节是否进入视口，触发 `setState` 切换图片 class。

```javascript
const observer = new IntersectionObserver(
    ([entry]) => {
        if (entry.isIntersecting) {
            setActiveChapter(index);
        }
    },
    { threshold: 0.5 }  // 章节 50% 可见时触发
);
observer.observe(chapterEl);
```

图片通过 CSS `transition` 做淡入淡出：

```css
.image {
    opacity: 0;
    transition: opacity 0.8s ease, transform 0.8s ease;
}
.imageActive {
    opacity: 1;
}
```

**特点：**
- 零依赖，性能好，代码最简单
- 切换是**离散的**——threshold 到了就跳，跟滚动速度无关
- 过渡动画是**时间驱动**的（0.8s 固定），不是滚动进度驱动
- 兼容性极好

---

### 方案 B：scroll 事件 + 连续进度（进度驱动）

**原理：** 监听 scroll 事件，计算每个章节在视口中的可见进度 `0~1`，用这个进度值直接写 `style`。

```javascript
const rect = chapterEl.getBoundingClientRect();
const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1);

// 用 progress 驱动多个属性
imgEl.style.opacity = String(opacity);
imgEl.style.transform = `scale(${scale}) translateY(${translateY}px)`;
imgEl.style.filter = `blur(${blur}px)`;
```

滚到 30%，图片就 30% 透明——**1:1 绑定滚动进度**。

**图片的三段式处理：**
- 第一张：初始可见 → progress > 0.6 时淡出
- 中间张：progress 0.15~0.4 淡入 → 0.4~0.6 保持 → 0.6~0.85 淡出
- 最后一张：淡入后保持不淡出

**性能保障：**
```javascript
const onScroll = () => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(updateOnScroll);
};
window.addEventListener('scroll', onScroll, { passive: true });
```
- `passive: true` — 不阻塞滚动
- `requestAnimationFrame` — 节流到 60fps
- 直接写 `el.style` — 跳过 React 渲染，零 setState

**特点：**
- 零依赖，连续过渡，可驱动任意复杂动画
- 比方案 A 代码量多，需要手动管理进度映射
- 兼容性极好

---

### 方案 C：CSS scroll-timeline（纯 CSS）

**原理：** 用 CSS 原生的滚动驱动动画，零 JS 逻辑。React 组件里没有任何 Hooks。

**四个关键 CSS 属性：**

**1) `timeline-scope` — 打通兄弟子树**

```css
.groupInner {
    timeline-scope: --ch-0, --ch-1, --ch-2, --ch-3;
}
```

左侧图片和右侧章节是不同子树，必须在公共祖先上声明 `timeline-scope`，才能跨子树引用 timeline。

**2) `view-timeline-name` — 章节创建 timeline**

```css
.chapter:nth-child(1) { view-timeline-name: --ch-0; }
.chapter:nth-child(2) { view-timeline-name: --ch-1; }
```

每个章节根据自身在视口中的可见进度（0% 刚进入 → 100% 完全离开），生成一条 view progress timeline。

**3) `animation-timeline` — 图片绑定到章节 timeline**

```css
.image:nth-child(1) {
    animation: scrollShowFirst linear both;
    animation-timeline: --ch-0;
}
```

图片的动画不再由时间驱动，而是由对应章节的滚动位置驱动。

**4) `animation-timeline: view()` — 文字自驱动**

```css
.chapterContent {
    animation: revealContent linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 45%;
}
```

`view()` 是匿名写法，元素用自己的可见度驱动自己的动画。

**三种 keyframes 处理首/中/末图片：**
- `scrollShowFirst` — 第一张：初始 opacity:1 → 章节离开时淡出
- `scrollShow` — 中间张：章节进入淡入 → 章节离开淡出
- `scrollShowLast` — 最后一张：章节进入淡入 → 保持 opacity:1

**特点：**
- 零 JS，React 组件没有任何 Hooks
- 动画在**合成线程**执行，完全不占主线程
- 兼容性一般：Chrome 115+、Firefox 110+，Safari 有限

---

## 方案总结

| 方案 | 依赖 | 过渡方式 | 线程 | 兼容性 | 适合场景 |
|------|------|---------|------|--------|---------|
| A: IntersectionObserver | 无 | 离散 + CSS transition | 主线程 | 极好 | 简单图片切换 |
| B: scroll 事件 + rAF | 无 | 连续，进度驱动 | 主线程 | 极好 | 复杂多属性动画 |
| C: CSS scroll-timeline | 无 | 连续，进度驱动 | 合成线程 | 一般 | 面向现代浏览器 |

---

## 页面间切换：startViewTransition

三个方案页面之间的切换使用了 `document.startViewTransition` + Layout 嵌套路由模式。

### Layout 模式

```
/scrollytelling           → ScrollytellingLayout（共享导航栏）
    ├── /scrollytelling        → 方案 A
    ├── /scrollytelling/css    → 方案 C
    └── /scrollytelling/scroll → 方案 B
```

Layout 组件负责渲染导航栏，子路由通过 `<RichRoute route={route} />` 渲染——子页面完全不知道导航栏的存在。

### startViewTransition 核心代码

```javascript
const navigateTo = (path) => {
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            flushSync(() => {
                history.push(path);
            });
        });
    } else {
        history.push(path);
    }
};
```

**关键点：**
- `startViewTransition` 截图旧 DOM → 回调里更新 DOM → 截图新 DOM → 播放过渡动画
- 必须用 `flushSync` 强制 React **同步**更新 DOM，否则截到的还是旧 DOM
- 不支持的浏览器直接 `history.push`，无感降级

**CSS 控制过渡效果：**

```css
/* 导航栏设置 view-transition-name，切换时保持不动 */
.nav { view-transition-name: scrolly-nav; }

::view-transition-old(scrolly-nav),
::view-transition-new(scrolly-nav) {
    animation: none;
}

/* 页面内容区做滑动 + 模糊过渡 */
::view-transition-old(root) {
    animation: slideOut 0.35s ease both;
}
::view-transition-new(root) {
    animation: slideIn 0.35s ease both;
}
```

### startViewTransition 不适合 Scrollytelling 本身

它是**离散的、一次性的**——触发一次，播放一次。无法绑定滚动进度、无法暂停/倒退。适合页面跳转，不适合滚动驱动的连续动画。

---

## 常见坑

1. **sticky 失效** — 祖先有 `overflow: hidden/auto` 就废了
2. **IntersectionObserver 的 threshold** — 设太低会频繁切换，设太高可能跳过短章节
3. **scroll 事件性能** — 必须 `passive: true` + `requestAnimationFrame` 节流
4. **scroll-timeline 兼容性** — Safari 支持有限，生产环境建议做降级
5. **flushSync + startViewTransition** — 不用 flushSync，React 异步更新会导致截到旧 DOM
6. **view-transition-name 唯一性** — 同一时刻页面上不能有两个元素同名
