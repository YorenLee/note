LangChain.js 提供了 一套完整的 Callback 机制（基于事件驱动），可以实时监听和干预 LLM、Chain、Tool、Retriever 等组件的整个执行过程。

### LangChain.js 主要提供了哪些 Callback 事件
LangChain.js 内置了很多生命周期钩子（handler 方法），常见的有：

**LLM 相关：**
- `handleLLMStart`：LLM 开始调用
- `handleLLMNewToken`：每生成一个新 token（最常用于流式输出）
- `handleLLMEnd`：LLM 调用结束（可拿到 token 用量、耗时等）
- `handleLLMError`：LLM 调用出错
**Chain / Runnable 相关：**
- `handleChainStart` / `handleChainEnd` / `handleChainError`
- `handleRunnableStart` / `handleRunnableEnd` / `handleRunnableError`
**Tool 相关：**
- `handleToolStart` / `handleToolEnd` / `handleToolError`
**Retriever 相关：**
- `handleRetrieverStart` / `handleRetrieverEnd` / `handleRetrieverError`

每个事件都会携带 runId、parentRunId（支持嵌套形成调用树）、输入输出、tags、metadata 等信息。

## langchain实现方法
### 使用内置的 ConsoleCallbackHandler（最简单）
```ts
import { ConsoleCallbackHandler } from "@langchain/core/callbacks/console";

const model = new ChatOpenAI({
  callbacks: [new ConsoleCallbackHandler()],
  verbose: true,   // 开启后会打印更多信息
});
```
### 传入自定义 Callback（推荐）
```ts
const chain = prompt.pipe(model).pipe(outputParser);

await chain.invoke(
  { text: "你的输入" },
  { 
    callbacks: [new MyCustomHandler()],   // 可以传多个
    tags: ["demo", "translate"]           // 可选标签
  }
);
```
### 创建自己的 CallbackHandler（最灵活）
继承 `BaseCallbackHandler` 并实现需要的方法：
```ts
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

class MetricsHandler extends BaseCallbackHandler {
  name = "metrics-handler";

  async handleLLMStart(event: any) {
    console.log("[LLM 开始]", event.runId, "模型:", event.invocationParams?.model);
  }

  async handleLLMNewToken(token: string) {
    process.stdout.write(token);   // 实时打印，实现打字机效果
  }

  async handleLLMEnd(event: any) {
    console.log("\n[LLM 结束] Token 用量:", event.output?.llmOutput?.tokenUsage);
  }

  async handleChainStart(event: any) {
    console.log("[Chain 开始]", event.name);
  }

  async handleChainError(err: any) {
    console.error("[出错]", err.message);
  }
}
```

