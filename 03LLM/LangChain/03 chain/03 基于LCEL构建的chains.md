# 基于 LCEL 构建的 Chains

## 核心思想

LCEL（LangChain Expression Language）链的本质：**把所有组件统一成 `Runnable`，再用 `pipe` / 组合类把它们拼起来**——不再需要专用的 `LLMChain` / `SequentialChain` / `RouterChain` 类。

所有 Runnable 都遵守同一个接口：

| 方法 | 用途 |
| --- | --- |
| `invoke(input)` | 单次同步调用 |
| `stream(input)` | 流式输出，逐 token 产出 |
| `batch(inputs)` | 批量并发执行 |
| `pipe(next)` | 把当前 Runnable 的输出接到下一个 Runnable 的输入 |

→ 一条 LCEL 链 = 一个表达式，**整体也是 Runnable**，可以再被嵌套到更大的链里。

## 五种核心 Runnable

| 类 | 作用 | 替代谁 |
| --- | --- | --- |
| `RunnableSequence` | 顺序执行多步 | `LLMChain` / `SequentialChain` |
| `RunnableParallel` | 并行扇出，多个分支同时跑 | 无对应传统链 |
| `RunnableBranch` | 条件分支，根据输入选路径 | `RouterChain` / `MultiPromptChain` |
| `RunnablePassthrough` | 输入原样透传 | 配合并行做"附加字段" |
| `RunnableLambda` | 把任意函数包装成 Runnable | 中间数据转换 |

---

## 1. 顺序：`prompt | model | parser`

最经典的 LCEL 写法，等价于传统的 `LLMChain`：

```ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({ modelName: "gpt-4o-mini" });
const prompt = ChatPromptTemplate.fromTemplate("用一句话介绍 {topic}");
const parser = new StringOutputParser();

const chain = prompt.pipe(model).pipe(parser);

console.log(await chain.invoke({ topic: "Docker" }));
```

对应"`Prompt → LLM → Parser`"的经典组合。

## 2. 并行：`RunnableParallel`

同时跑多条独立分支，结果合并成一个对象——典型场景是**同时生成多个角度的回答**或**多任务批处理**。

```ts
import { RunnableParallel } from "@langchain/core/runnables";

const summaryChain = ChatPromptTemplate.fromTemplate("用 30 字总结：{text}").pipe(model).pipe(parser);
const titleChain   = ChatPromptTemplate.fromTemplate("给下面文本起个标题：{text}").pipe(model).pipe(parser);

const parallel = RunnableParallel.from({
  summary: summaryChain,
  title:   titleChain,
});

console.log(await parallel.invoke({ text: "..." }));
// { summary: "...", title: "..." }
```

## 3. 分支：`RunnableBranch`（替代 RouterChain）

根据输入条件走不同的链；最后一个参数是**默认分支**。

```ts
import { RunnableBranch } from "@langchain/core/runnables";

const physicsChain = ChatPromptTemplate.fromTemplate("你是物理专家：{input}").pipe(model).pipe(parser);
const mathChain    = ChatPromptTemplate.fromTemplate("你是数学专家：{input}").pipe(model).pipe(parser);
const defaultChain = ChatPromptTemplate.fromTemplate("请回答：{input}").pipe(model).pipe(parser);

const branch = RunnableBranch.from([
  [(x: { topic: string }) => x.topic === "physics", physicsChain],
  [(x: { topic: string }) => x.topic === "math",    mathChain],
  defaultChain,
]);

await branch.invoke({ topic: "physics", input: "什么是黑体辐射？" });
```

> 比 `MultiPromptChain` 灵活得多：条件可以是任意 JS 函数，不强依赖 LLM 路由。

## 4. 透传 + Lambda：构造"原始输入 + 中间产物"的上下文

常见痛点：链中后面的步骤既要原始输入、又要前面某一步的输出。`RunnablePassthrough` + `RunnableParallel` 是标准解法。

```ts
import { RunnablePassthrough, RunnableLambda } from "@langchain/core/runnables";

const enrich = RunnableParallel.from({
  question: new RunnablePassthrough(),
  upper:    new RunnableLambda({ func: (x: string) => x.toUpperCase() }),
});

await enrich.invoke("hello");
// { question: "hello", upper: "HELLO" }
```

之后这个 `{ question, upper }` 对象可以直接喂给一个 prompt 模板，在模板里用 `{question}` / `{upper}` 引用——**这是 LCEL 取代 SequentialChain 多变量传递的标准做法**。

## 5. 流式 / 批量

所有 Runnable 默认就支持，无需任何改动：

```ts
for await (const token of await chain.stream({ topic: "Docker" })) {
  process.stdout.write(token);          // 打字机效果
}

const results = await chain.batch([
  { topic: "Docker" },
  { topic: "Kubernetes" },
  { topic: "Nginx" },
]);                                     // 并发批处理
```

---

## 与传统链的对应关系

| 需求 | 传统链 | LCEL 写法 |
| --- | --- | --- |
| 单步问答 | `LLMChain` | `prompt.pipe(model).pipe(parser)` |
| 固定串联（单字符串） | `SimpleSequentialChain` | `chainA.pipe(chainB)` |
| 固定串联（多变量） | `SequentialChain` | `RunnableParallel` + `RunnablePassthrough` |
| 动态路由 | `RouterChain` / `MultiPromptChain` | `RunnableBranch` |
| 任意中间转换 | 无优雅方案 | `RunnableLambda` |
| 流式 / 批量 / 异步 | 各自有专用 API | 统一 `stream` / `batch` / `ainvoke` |

→ **核心收益**：少了一堆专用 Chain 类，多了组合的自由度；调试、流式、并发全部"开箱即用"。

## 一句话总结

> 把组件做成 Runnable，用 `pipe` / `Sequence` / `Parallel` / `Branch` / `Lambda` / `Passthrough` 这 6 块积木，几乎能拼出所有传统 Chain 能做的事，并且更灵活、更易调试。
