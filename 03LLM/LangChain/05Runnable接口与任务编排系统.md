1. Runnable 的设计理念与核心接口
    - 统一输入 → 处理 → 输出的标准接口。
    - 支持的主要方法：
        - invoke()：单次同步调用
        - stream()：流式输出（适合实时交互）
        - batch()：批量处理
        - pipe()：链式连接（最常用的编排方式）
2. 常用 Runnable 实现类
    - RunnableLambda：把普通函数包装成 Runnable
    - RunnableSequence：顺序执行多个步骤（流水线）
    - RunnableParallel：并行执行多个分支（扇出）
    - RunnablePassthrough：输入原样透传
3. 高级任务编排模式
    - 顺序链：Prompt → LLM → Parser 的经典组合
    - 条件分支/路由：根据输入动态选择不同处理路径
    - 并行 + 汇聚：同时运行多个子任务，最后合并结果
    - Map/Reduce 风格：批量处理 + 聚合
    - 流式处理：实时输出 token，支持打字机效果
    - 错误处理与重试：回退机制、指数退避等

### RunnableLambda：把普通函数包装成 Runnable

LangChain 的流水线只认 `Runnable` 这种标准组件。RunnableLambda 就像一个“包装盒”，把你的普通函数塞进去，让它瞬间变成可以和其他组件（Prompt、LLM 等）串联、并行、流式输出的 Runnable。
```typescript
import { RunnableLambda } from "@langchain/core/runnables";

const normalize = new RunnableLambda(({ text }) => ({
  text: text.trim().slice(0, 2000)   // 去空格 + 截断
}));

const result = await normalize.invoke({ text: "   hello runnable    " });
// 输出: { text: "hello runnable" }
```

### RunnableSequence：顺序执行多个步骤（流水线 / Pipeline）
像工厂的流水线一样，一个步骤接一个步骤执行。前一个的输出自动变成后一个的输入。非常适合线性流程：输入 → 处理1 → 处理2 → 处理3 → 输出。构建方式：
- 用 RunnableSequence.from([步骤1, 步骤2, ...])
- 或者用链式 .pipe(下一个步骤)
```typescript
const trim = new RunnableLambda((x: string) => x.trim());
const exclaim = new RunnableLambda((x: string) => x + "!");

const seq = RunnableSequence.from([trim, exclaim]);

await seq.invoke(" hello ");   // 输出: "hello!"
```
### RunnableParallel：并行执行多个分支（扇出 Fan-out）

一个输入，同时扔给多个独立任务去执行（并行跑，不用等上一个完成），最后把所有结果收集起来合并成一个对象。就像“多线程”处理不同维度。

**为什么重要？**  
很多分析任务可以同时做（比如同时算长度、检测关键词、判断语言），并行能大幅提升速度。
```typescript
const a = new RunnableLambda((x: string) => `A:${x.length}`);
const b = new RunnableLambda((x: string) => `B:${x.split(" ").length}`);
const c = new RunnableLambda((x: string) => `C:${x.includes("AI")}`);

const parallel = new RunnableParallel({ a, b, c });   // 同时跑 a、b、c

const result = await parallel.invoke("AI makes front-end better");
// 输出类似: { a: "A:25", b: "B:5", c: "C:true" }
```
### RunnablePassthrough：输入原样透传
什么都不干，就是把输入原封不动地传下去。
```TypeScript
import { RunnableLambda, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";

const tokenize = new RunnableLambda((x: string) => x.split(/\s+/));
const count = new RunnableLambda((xs: string[]) => xs.length);

// 产出形如 { raw, tokens, count }
const pipeline = RunnableSequence.from([
  new RunnableLambda((raw: string) => ({ raw })),
  new RunnableLambda(async ({ raw }) => ({ raw, tokens: await tokenize.invoke(raw) })),
  new RunnableLambda(async ({ raw, tokens }) => ({ raw, tokens, count: await count.invoke(tokens) })),
  RunnablePassthrough.from(),
]);

export async function run() {
  const out = await pipeline.invoke("hello runnable world");
  console.log(out);
}

if (require.main === module) run();
// 输出
/*
{
  raw: 'hello runnable world',
  tokens: [ 'hello', 'runnable', 'world' ],
  count: 3
}
*/
```


## RAG 数据处理流水线（ETL Pipeline）

目标：把一批文档处理成可用于向量检索的格式（典型的 Indexing/ETL 过程）：  
文档加载 → 分块 → 去重 → 批量嵌入 → 写入向量库 → 生成统计报告。
整体结构同样用 `RunnableSequence.from([...])` 构建。  
很多步骤用纯函数 + RunnableLambda 实现（因为不是所有步骤都需要 LLM）。

```typescript
import { RunnableLambda, RunnableParallel, RunnableSequence } from "@langchain/core/runnables";

// 模拟函数（实际项目中替换成真实组件）
async function loadFiles(glob: string) { /* 返回文档数组 */ }
async function split(docs) { /* 切块 */ }
async function dedup(chunks) { /* 去重 */ }
async function embedBatch(texts: string[]) { /* 返回向量 */ }
async function upsertVectors(items) { /* 写入向量库，返回数量 */ }

const pipeline = RunnableSequence.from([
  // 输入：{ glob: "docs/**/*.md" }
  new RunnableLambda((input) => input.glob),

  // 1. 加载文档
  new RunnableLambda(async (glob) => await loadFiles(glob)),

  // 2. 分块
  new RunnableLambda(async (docs) => await split(docs)),

  // 3. 过滤太短的片段
  new RunnableLambda(async (chunks) => chunks.filter(c => c.text.trim().length >= 4)),

  // 4. 去重
  new RunnableLambda(async (chunks) => await dedup(chunks)),

  // 5. 批量嵌入 + 生成 id（这里用 Parallel 同时处理向量和 id）
  new RunnableLambda(async (chunks: any[]) => {
    const textList = chunks.map(c => c.text);
    const parallel = new RunnableParallel({
      vectors: new RunnableLambda(async () => await embedBatch(textList)),
      ids: new RunnableLambda(async () => chunks.map(c => c.id))
    });
    const { vectors, ids } = await parallel.invoke({} as any);
    return ids.map((id, i) => ({ id, vector: vectors[i].vector }));
  }),

  // 6. 写入向量库并生成报告
  new RunnableLambda(async (items) => ({
    upserted: await upsertVectors(items),
    total: items.length,
    // 可以在这里加更多统计：平均长度、唯一文档数等
  }))
]);
```