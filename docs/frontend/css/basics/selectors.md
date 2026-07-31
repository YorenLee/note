---
date: 2026-04-21
---
背景：代码里面有些选择器写的我发毛，不能第一时间看懂，人懵逼，写个文档便于复习不常用

## 基础选择器
- 元素选择器
- 类选择器
- ID 选择器
- 通用选择器

## 组合选择器

### 5. 后代选择器
选择指定元素的后代元素。

```html
<!-- HTML 结构 -->
<div class="article">
  <h2>文章标题</h2>
  <p>文章第一段</p>
  <div>
    <p>嵌套的段落</p>
  </div>
</div>

<div class="container">
  <div class="item">项目1</div>
  <div class="item">项目2</div>
</div>

<p>外面的段落</p>
```

```css
/* 选择 <div> 内的所有 <p> 元素 */
div p {
  line-height: 1.5;
}

/* 选择 .container 内的所有 .item 元素 */
.container .item {
  border: 1px solid #ddd;
}
```

**效果**: `.article` 内的两个 `<p>` 元素都有 1.5 行高，`.container` 内的两个 `.item` 都有边框。外面的 `<p>` 不受影响。

### 6. 多类选择器（交集选择器）
选择同时具有多个类的元素。

```html
<!-- HTML 结构 -->
<button class="btn">普通按钮</button>
<button class="btn primary">主要按钮</button>
<button class="btn secondary">次要按钮</button>

<div class="card">普通卡片</div>
<div class="card featured">特色卡片</div>
```

```css
/* 选择同时具有 .btn 和 .primary 类的元素 */
.btn.primary {
  background: #007bff;
  color: white;
}

/* 选择同时具有 .card 和 .featured 类的元素 */
.card.featured {
  border: 2px solid gold;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
```

**效果**: 只有同时具有两个类的元素才会应用样式。`.btn.primary` 按钮是蓝色背景，`.card.featured` 卡片有金色边框。

### 7. 子元素选择器
选择指定元素的直接子元素。

```html
<!-- HTML 结构 -->
<ul class="menu">
  <li>直接子元素1</li>
  <li>直接子元素2</li>
  <div>
    <li>嵌套的li（不是直接子元素）</li>
  </div>
</ul>

<div class="parent">
  <div class="child">直接子元素</div>
  <div>
    <div class="child">嵌套的子元素</div>
  </div>
</div>
```

```css
/* 选择 <ul> 的直接子元素 <li> */
ul > li {
  list-style: none;
}

/* 选择 .parent 的直接子元素 .child */
.parent > .child {
  margin-left: 20px;
}
```

**效果**: 只有直接子元素受影响，嵌套的元素不受影响。

### 8. 相邻兄弟选择器
选择紧接在另一元素后的元素。

```html
<!-- HTML 结构 -->
<h1>主标题</h1>
<p>紧跟在h1后的段落（会受影响）</p>
<p>这个段落不会受影响</p>

<div class="title">标题</div>
<div class="subtitle">紧跟的子标题（会受影响）</div>
<div class="subtitle">这个子标题不会受影响</div>
```

```css
/* 选择紧接在 <h1> 后的 <p> 元素 */
h1 + p {
  margin-top: 10px;
}

/* 选择紧接在 .title 后的 .subtitle */
.title + .subtitle {
  color: #666;
}
```

**效果**: 只有紧接在指定元素后的第一个兄弟元素会受影响。

### 9. 通用兄弟选择器
选择指定元素后的所有同级元素。

```html
<!-- HTML 结构 -->
<h2>章节标题</h2>
<p>第一个段落（会受影响）</p>
<div>中间有个div</div>
<p>第二个段落（也会受影响）</p>
<p>第三个段落（同样受影响）</p>

<ul>
  <li class="active">当前项</li>
  <li>后续项1（会受影响）</li>
  <li>后续项2（会受影响）</li>
</ul>
```

```css
/* 选择 <h2> 后的所有 <p> 元素 */
h2 ~ p {
  font-style: italic;
}

/* 选择 .active 后的所有同级元素 */
.active ~ li {
  opacity: 0.7;
}
```

**效果**: 指定元素后的所有匹配元素都会受影响，不论中间是否有其他元素。

### 9.1 群组选择器（逗号 `,`）

用 `,` 把多个选择器写在一起，让它们 **共享同一份样式声明**。本质是「批量应用样式」的语法糖，不是一种新的选择能力。

#### 关键特性

1. **并列关系**：等价于把每个选择器单独写一条规则，互不影响。
2. **特异度独立**：每个选择器自己算自己的优先级，不会因为写在一起而合并。
3. **一损俱损**：在标准 CSS 中，**只要列表里有一个选择器无效（如浏览器不识别），整条规则都会被丢弃**。所以遇到带前缀的私有伪元素（例如 `::-webkit-input-placeholder`）时，必须拆开写，不能用逗号合并。
4. **与组合选择器范畴不同**：空格 / `>` / `+` / `~` 描述的是元素之间的结构关系；逗号只是把多个独立选择器合并书写。

```html
<!-- HTML 结构 -->
<h1>一级标题</h1>
<h2>二级标题</h2>
<h3>三级标题</h3>
<p>一段普通文字</p>
```

```css
/* 群组选择器：三个标题共用同一份样式 */
h1,
h2,
h3 {
  font-family: "PingFang SC", sans-serif;
  color: #333;
}

/* 等价于： */
h1 { font-family: "PingFang SC", sans-serif; color: #333; }
h2 { font-family: "PingFang SC", sans-serif; color: #333; }
h3 { font-family: "PingFang SC", sans-serif; color: #333; }
```

**效果**: `h1`、`h2`、`h3` 都使用同一字体和颜色，避免重复书写。

#### 反例：不要把私有伪元素写进群组

```css
/* ❌ 错误：只要 ::-webkit-input-placeholder 不被识别，整条规则都失效 */
input::placeholder,
input::-webkit-input-placeholder,
input::-moz-placeholder {
  color: #999;
}

/* ✅ 正确：分开写，各管各的 */
input::placeholder { color: #999; }
input::-webkit-input-placeholder { color: #999; }
input::-moz-placeholder { color: #999; }
```

#### 与 `:is()` / `:where()` 的对比

`:is(a, b, c)` 也能批量匹配多个选择器，但它是 **一个选择器**，与 `a, b, c`（**三个独立选择器**）有本质区别：

| 写法 | 本质 | 特异度 | 容错性 |
| --- | --- | --- | --- |
| `a, b, c { ... }` | 三个独立选择器 | 各自独立计算 | 任一无效 → 整条规则被丢弃 |
| `:is(a, b, c) { ... }` | 一个选择器 | 取参数中 **最高** 的特异度 | 容错：无效项被忽略，其它仍生效 |
| `:where(a, b, c) { ... }` | 一个选择器 | 特异度恒为 **0** | 容错：同 `:is()` |

```css
/* 群组选择器：特异度各算各的 */
#nav, .menu, ul { color: red; }   /* 三条规则的特异度分别是 1,0,0 / 0,1,0 / 0,0,1 */

/* :is()：整体特异度按最高的算（这里 = #nav 的 1,0,0） */
:is(#nav, .menu, ul) { color: red; }

/* :where()：整体特异度恒为 0,0,0，最容易被覆盖，常用来写"默认样式" */
:where(#nav, .menu, ul) { color: red; }
```

**经验法则**：

- 多个选择器 **样式完全相同** 且 **没有兼容风险** → 用逗号群组，最简洁。
- 想要 **容错** 或 **降低特异度** → 用 `:is()` / `:where()`。
- 含 **私有前缀伪类/伪元素** → 必须拆开写。

## 属性选择器

### 10. 基本属性选择器
选择具有指定属性的元素。

```html
<!-- HTML 结构 -->
<a href="https://example.com" title="外部链接">链接1</a>
<a href="#section">链接2（无title）</a>
<input type="text" title="输入框">
<div title="提示文本">有title的元素</div>
```

```css
/* 选择具有 title 属性的元素 */
[title] {
  cursor: help;
}

/* 选择具有 href 属性的 <a> 元素 */
a[href] {
  text-decoration: underline;
}
```

**效果**: 有 title 属性的元素显示帮助光标，有 href 的链接有下划线。

### 11. 属性值选择器
选择属性值匹配的元素。

```html
<!-- HTML 结构 -->
<a href="https://example.com">精确链接</a>
<a href="https://google.com">Google</a>

<input type="submit" value="提交">
<input type="button" value="按钮">

<div class="nav-main">主导航</div>
<div class="nav-footer">底部导航</div>
<div class="btn-primary">主要按钮</div>
<div class="btn-secondary">次要按钮</div>
```

```css
/* 选择 href="https://example.com" 的 <a> 元素 */
a[href="https://example.com"] {
  color: purple;
}

/* 选择 type="submit" 的 <input> 元素 */
input[type="submit"] {
  background: green;
}

/* 选择 class 包含 "nav" 的元素 */
[class*="nav"] {
  background: #f8f9fa;
}

/* 选择 class 以 "btn" 开头的元素 */
[class^="btn"] {
  border-radius: 4px;
}

/* 选择 class 以 "-primary" 结尾的元素 */
[class$="-primary"] {
  font-weight: bold;
}
```

**效果**: 精确匹配、包含、开头、结尾的属性值选择器分别应用不同样式。

## 伪类选择器

### 12. 链接伪类

```html
<!-- HTML 结构 -->
<a href="https://example.com">未访问链接</a>
<a href="https://visited.com">已访问链接</a>
```

```css
/* 未访问的链接 */
a:link {
  color: blue;
}

/* 已访问的链接 */
a:visited {
  color: purple;
}

/* 鼠标悬停 */
a:hover {
  text-decoration: underline;
}

/* 激活状态（点击时） */
a:active {
  color: red;
}
```

**效果**: 链接在不同状态下显示不同样式。

### 13. 用户行为伪类

```html
<!-- HTML 结构 -->
<input type="text" placeholder="获得焦点试试">
<input type="text" disabled placeholder="禁用的输入框">
<input type="checkbox" checked> 已选中
<input type="checkbox"> 未选中
```

```css
/* 获得焦点的元素 */
input:focus {
  border-color: #007bff;
  outline: none;
}

/* 禁用的元素 */
input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

/* 选中的单选框或复选框 */
input:checked {
  background: #007bff;
}
```

**效果**: 根据用户交互状态应用不同样式。

### 14. 结构伪类

```html
<!-- HTML 结构 -->
<ul>
  <li>第一个列表项</li>
  <li>第二个列表项</li>
  <li>第三个列表项</li>
  <li>第四个列表项</li>
  <li>第五个列表项</li>
</ul>

<table>
  <tr><td>行1</td></tr>
  <tr><td>行2</td></tr>
  <tr><td>行3</td></tr>
  <tr><td>行4</td></tr>
</table>

<div>唯一的子元素</div>
```

```css
/* 第一个子元素 */
li:first-child {
  font-weight: bold;
}

/* 最后一个子元素 */
li:last-child {
  border-bottom: none;
}

/* 第 n 个子元素（偶数） */
li:nth-child(2n) {
  background: #f8f9fa;
}

/* 奇数位置的子元素 */
tr:nth-child(odd) {
  background: #fff;
}

/* 偶数位置的子元素 */
tr:nth-child(even) {
  background: #f8f9fa;
}

/* 唯一子元素 */
div:only-child {
  margin: 20px;
}
```

**效果**: 根据元素在父元素中的位置应用不同样式。

### 15. 其他伪类

```html
<!-- HTML 结构 -->
<div></div>
<div>有内容的div</div>

<div class="visible">可见元素</div>
<div class="hidden">隐藏元素</div>
```

```css
/* 空元素 */
div:empty {
  display: none;
}

/* 不是指定元素的元素 */
div:not(.hidden) {
  display: block;
}

/* 根元素（<html>） */
:root {
  --primary-color: #007bff;
}
```

**效果**: 选择特殊状态的元素，如空元素、非指定类元素等。

## 伪元素选择器

### 16. 内容伪元素

```html
<!-- HTML 结构 -->
<p>这是一个很长的段落，用来演示伪元素的效果。第一行会特别显示。</p>
```

```css
/* 第一个字母 */
p::first-letter {
  font-size: 2em;
  font-weight: bold;
}

/* 第一行 */
p::first-line {
  font-weight: bold;
  color: #333;
}

/* 选中的文本 */
::selection {
  background: #007bff;
  color: white;
}
```

**效果**: 段落的第一个字母变大，第一行加粗，选中文本有特殊背景。

### 17. 生成内容伪元素

```html
<!-- HTML 结构 -->
<p class="quote">这是一段引用文字</p>
<div class="clearfix">
  <div style="float: left;">左浮动</div>
  <div style="float: right;">右浮动</div>
</div>
```

```css
/* 元素前插入内容 */
.quote::before {
  content: '"';
  color: #666;
}

/* 元素后插入内容 */
.quote::after {
  content: '"';
  color: #666;
}

/* 清除浮动 */
.clearfix::after {
  content: '';
  display: table;
  clear: both;
}
```

**效果**: 引用文字前后添加引号，清除浮动容器内的浮动。

## 选择器优先级

CSS 选择器的优先级（从高到低）：

1. **!important** - 最高优先级
2. **内联样式** - style 属性中的样式
3. **ID 选择器** - #id
4. **类、伪类、属性选择器** - .class, :hover, [attr]
5. **元素、伪元素选择器** - div, ::before
6. **通用选择器** - *

### 优先级计算
```css
/* 优先级: 0,0,0,1 */
div {}

/* 优先级: 0,0,1,0 */
.class {}

/* 优先级: 0,1,0,0 */
#id {}

/* 优先级: 0,0,1,1 */
div.class {}

/* 优先级: 0,1,1,1 */
#id .class div {}
```

## 实际应用示例

### 18. 导航菜单样式
```html
<nav>
  <ul class="nav">
    <li><a href="#">首页</a></li>
    <li class="active"><a href="#">产品</a></li>
    <li><a href="#">服务</a></li>
    <li><a href="#">联系</a></li>
  </ul>
</nav>
```

```css
/* 导航容器 */
.nav {
  display: flex;
  list-style: none;
  padding: 0;
}

/* 导航项 */
.nav > li {
  position: relative;
}

/* 导航链接 */
.nav > li > a {
  display: block;
  padding: 10px 20px;
  text-decoration: none;
  color: #333;
}

/* 悬停效果 */
.nav > li > a:hover {
  background: #007bff;
  color: white;
}

/* 当前页面 */
.nav > li.active > a {
  background: #0056b3;
  color: white;
}
```

### 19. 表单样式
```html
<form>
  <div class="form-group">
    <label for="name">姓名</label>
    <input type="text" id="name" placeholder="请输入姓名">
  </div>
  <div class="form-group error">
    <label for="email">邮箱</label>
    <input type="email" id="email" placeholder="请输入邮箱">
    <span class="error-message">邮箱格式不正确</span>
  </div>
</form>
```

```css
/* 表单组 */
.form-group {
  margin-bottom: 15px;
}

/* 标签 */
.form-group > label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

/* 输入框 */
.form-group > input[type="text"],
.form-group > input[type="email"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* 焦点状态 */
.form-group > input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* 错误状态 */
.form-group.error > input {
  border-color: #dc3545;
}

.form-group.error > .error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 5px;
}
```

## CSS 预处理器选择器

### 20. Sass/SCSS 中的 & 符号
`&` 符号在 Sass/SCSS 中代表父选择器，用于嵌套规则和创建复杂的选择器。

```html
<!-- HTML 结构 -->
<button class="button">普通按钮</button>
<button class="button button--primary">主要按钮</button>

<div class="card">
  <div class="card__header">标题</div>
  <div class="card__body">内容</div>
</div>
```

```scss
/* 基本用法 - 伪类 */
.button {
  background: blue;
  
  &:hover {
    background: darkblue;
  }
  
  &:active {
    background: navy;
  }
  
  &--primary {
    background: #007bff;
    color: white;
  }
}

/* BEM 命名法 */
.card {
  border: 1px solid #ddd;
  
  &__header {
    padding: 16px;
    font-weight: bold;
    border-bottom: 1px solid #eee;
  }
  
  &__body {
    padding: 16px;
  }
  
  &--featured {
    border-color: gold;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
}

/* 媒体查询中的 & */
.sidebar {
  width: 250px;
  
  @media (max-width: 768px) {
    & {
      width: 100%;
      position: fixed;
    }
  }
}
```

**编译后**:
```css
.button { background: blue; }
.button:hover { background: darkblue; }
.button:active { background: navy; }
.button--primary { background: #007bff; color: white; }

.card { border: 1px solid #ddd; }
.card__header { padding: 16px; font-weight: bold; border-bottom: 1px solid #eee; }
.card__body { padding: 16px; }
.card--featured { border-color: gold; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }

.sidebar { width: 250px; }
@media (max-width: 768px) {
  .sidebar { width: 100%; position: fixed; }
}
```

## 最佳实践

### 21. 选择器编写建议

1. **保持简洁** - 避免过长的选择器链
2. **使用类选择器** - 优先使用 class 而不是 ID
3. **避免过度嵌套** - 减少选择器的层级深度
4. **语义化命名** - 使用有意义的类名
5. **复用性** - 创建可复用的选择器

### 22. 性能优化

```css
/* ❌ 避免：过于具体的选择器 */
body div#main .container .row .col-md-6 .card .card-body .btn {
  /* 样式 */
}

/* ✅ 推荐：简洁的选择器 */
.btn-primary {
  /* 样式 */
}

/* ❌ 避免：通用选择器性能差 */
div * {
  /* 样式 */
}

/* ✅ 推荐：具体的选择器 */
div > p {
  /* 样式 */
}
```

## 浏览器兼容性

大多数现代选择器在现代浏览器中都得到良好支持，但需要注意：

- **IE8 及以下**：不支持属性选择器、伪元素等
- **IE9**：支持大部分 CSS3 选择器
- **现代浏览器**：完全支持 CSS3 选择器

使用较新的选择器时，建议检查目标浏览器的兼容性。