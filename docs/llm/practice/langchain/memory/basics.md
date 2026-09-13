---
date: 2026-04-26
---
## Memory模块的设计思路
如何设计Memory模块？
层次1(最直接的方式)：保留一个聊天消息列表

层次2(简单的新思路)：只返回最近交互的k条消息

层次3(稍微复杂一点)：返回过去k条消息的简洁摘要

层次4(更复杂)：从存储的消息中提取实体，并且仅返回有关当前运行中引用的实体的信息

### ChatMessageHistory

ChatMessageHistory是一个用于 **存储和管理对话消息** 的基础类，它直接操作消息对象（如HumanMessage, AIMessage 等），是其它记忆组件的底层存储工具
**特点：**
 - 纯粹是消息对象的“ 存储器 ”，与记忆策略（如缓冲、窗口、摘要等）无关。
 - 不涉及消息的格式化（如转成文本字符串）
#### 场景1：记忆存储

把 `ChatMessageHistory` 当成一个消息列表容器，手动往里加消息、读消息、清空。

```ts
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const history = new ChatMessageHistory();

await history.addMessage(new HumanMessage("你好，我叫小明"));
await history.addMessage(new AIMessage("你好小明，有什么可以帮你？"));
await history.addMessage(new HumanMessage("我刚才说我叫什么？"));

const messages = await history.getMessages();
console.log(messages);
// [ HumanMessage("你好，我叫小明"), AIMessage("你好小明..."), HumanMessage("我刚才说...") ]

await history.clear(); // 一次性清空所有消息
```

要点：
- `addMessage` / `addUserMessage` / `addAIMessage` 都是往内部数组 push。
- `getMessages` 把整个数组按原始顺序返回，**不做任何裁剪或摘要**。
- 默认是内存存储；要持久化可换成 `RedisChatMessageHistory`、`UpstashRedisChatMessageHistory` 等实现，接口完全一致。

#### 场景2：对接LLM

`ChatMessageHistory` 自己不会跟模型说话，需要**手动**把历史消息拼到 prompt 里发给 LLM。

```ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ modelName: "gpt-4o-mini" });
const history = new ChatMessageHistory();

async function chat(userInput: string) {
  await history.addMessage(new HumanMessage(userInput));

  const messages = [
    new SystemMessage("你是一个友好的助手。"),
    ...(await history.getMessages()),     // 把历史全部拼进去
  ];

  const res = await model.invoke(messages);
  await history.addMessage(res);          // AI 回复也写回历史
  return res.content;
}

console.log(await chat("我叫小明"));
console.log(await chat("我刚才说我叫什么？")); // 模型能答出"小明"，因为历史里有
```

要点：
- 模型本身**无状态**，靠你每次把历史全塞进去才能"记得"。
- 这种手动写法在多轮对话里非常啰嗦 → 这就是 `BufferMemory`、`RunnableWithMessageHistory` 这些上层组件存在的意义：它们封装了"取历史 → 注入 prompt → 把回复写回"这一整套动作。


### ConversationBufferMemory

ConversationBufferMemory是一个基础的 对话记忆（Memory）组件 ，专门用于按 原始顺序存储 完整的对话历史。
**特点：**
 - 完整存储对话历史
 - **简单** 、 **无裁剪** 、 **无压缩**
 - 与 Chains/Models 无缝集成
 - 支持两种返回格式（通过 return_messages 参数控制输出格式）
	 - return_messages=True 返回消息对象列表（ List[BaseMessage]
	 - return_messages=False （默认） 返回拼接的 纯文本字符串

**两条核心规则**：

1. `saveContext(inputs, outputs)` 不在乎 key 叫什么，**第一个对象的第一个值**会被当作 `HumanMessage`，**第二个对象的第一个值**会被当作 `AIMessage`。
2. `loadMemoryVariables({})` 返回对象的 key 默认是 `"history"`，可通过构造参数 `memoryKey` 修改。

```ts
import { BufferMemory } from "langchain/memory";

// ① 默认配置：故意用奇怪的 key 名，仍然被识别为 human / AI
const memory = new BufferMemory();

await memory.saveContext(
  { question: "我叫小明" },     // key 叫 question 也没关系，被当 HumanMessage
  { answer: "你好小明" },       // key 叫 answer  也没关系，被当 AIMessage
);
await memory.saveContext(
  { foo: "我刚才说我叫什么？" },
  { bar: "你叫小明" },
);

console.log(await memory.loadMemoryVariables({}));
// { history: 'Human: 我叫小明\nAI: 你好小明\nHuman: 我刚才说我叫什么？\nAI: 你叫小明' }
//   ↑ 默认 key 是 history
```

```ts
// ② 自定义 memoryKey，把返回对象的 key 改掉
const memory2 = new BufferMemory({ memoryKey: "chat_history" });

await memory2.saveContext({ input: "你好" }, { output: "你好呀" });

console.log(await memory2.loadMemoryVariables({}));
// { chat_history: 'Human: 你好\nAI: 你好呀' }
```

```ts
// ③ returnMessages 控制返回格式：字符串 vs 消息对象数组
const memoryStr = new BufferMemory({ returnMessages: false });   // 默认
const memoryObj = new BufferMemory({ returnMessages: true });

for (const m of [memoryStr, memoryObj]) {
  await m.saveContext({ input: "你好" }, { output: "你好呀" });
}

console.log(await memoryStr.loadMemoryVariables({}));
// { history: 'Human: 你好\nAI: 你好呀' }            ← 字符串

console.log(await memoryObj.loadMemoryVariables({}));
// { history: [ HumanMessage("你好"), AIMessage("你好呀") ] }  ← 消息对象列表
```

要点回顾：
- 不管 inputs / outputs 的 key 叫什么，都按"第一个 value = Human、第二个 value = AI"映射。
- 返回对象的 key 默认 `history`，由 `memoryKey` 配置修改——这个名字必须与后续 prompt 模板里的占位符（如 `{history}` / `{chat_history}`）一致，否则注入不进去。
- `returnMessages: true` 用于 ChatModel（接收消息列表）；`false` 用于 LLM（接收纯文本拼接）。

### ConversationChain
ConversationChain实际上是就是对 ConversationBufferMemory 和 LLMChain 进行了封装，并且提供一个默认格式的提示词模版（我们也可以不用），从而简化了初始化ConversationBufferMemory的步骤。

**等价关系**：

```
ConversationChain  ≈  LLMChain (默认 prompt) + BufferMemory (默认 memoryKey="history")
```

你不再需要手动调用 `saveContext` / `loadMemoryVariables`，每次 `invoke` 时它会自动：取历史 → 注入 `{history}` → 调用模型 → 把回复写回 memory。

#### 用法1：开箱即用（用默认 memory + 默认 prompt）

```ts
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

const model = new ChatOpenAI({ modelName: "gpt-4o-mini" });
const chain = new ConversationChain({ llm: model });

console.log((await chain.invoke({ input: "我叫小明" })).response);
console.log((await chain.invoke({ input: "我刚才说我叫什么？" })).response);
// → 第二轮模型能答出"小明"，证明历史被自动维护
```

要点：
- 没传 `memory` 参数 → 自动用 `BufferMemory({ memoryKey: "history" })`。
- 没传 `prompt` 参数 → 自动用内置模板（含 `{history}` + `{input}` 占位符）。
- 返回结果在 `result.response` 字段里。

#### 用法2：自定义 prompt + 自定义 memoryKey

需要"系统人设""自定义占位符名"时，自己传 prompt 和 memory，**两边占位符必须一致**。

```ts
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一位简洁的技术助手，回答控制在 30 字内。"],
  new MessagesPlaceholder("chat_history"),  // ← 占位符名
  ["human", "{input}"],
]);

const memory = new BufferMemory({
  memoryKey: "chat_history",                 // ← 必须和 prompt 里一致
  returnMessages: true,                      // ChatModel 用消息列表格式
});

const chain = new ConversationChain({ llm: model, prompt, memory });

await chain.invoke({ input: "JS 里 var 和 let 的区别？" });
await chain.invoke({ input: "刚才那个问题里第一个关键字是什么？" });
```

要点：
- `memoryKey` 决定 memory 返回对象的 key；`MessagesPlaceholder("chat_history")` 决定 prompt 从哪个字段读历史 —— **两者必须同名**，否则历史注入不进去。
- ChatModel 推荐 `returnMessages: true`，让 prompt 收到 `BaseMessage[]` 而不是字符串。

> 注意：`ConversationChain` 同样属于 **legacy**。LCEL 写法用 `RunnableWithMessageHistory` 替代，更灵活；这里仅作为传统封装演示。

### ConversationBufferWindowMemory

在了解了ConversationBufferMemory记忆类后，我们知道了它能够无限的将历史对话信息填充到History中，从而给大模型提供上下文的背景。但这会 **导致内存量十分大** ，并且 **消耗的token是非常多的**，此外，每个大模型都存在最大输入的Token限制。我们发现，过久远的对话数据往往并不能对当前轮次的问答提供有效的信息，LangChain 给出的解决方式是： ConversationBufferWindowMemory 模块。该记忆类会 **保存一段时间内对话交互** 的列表， **仅使用最近 K 个交互** 。这样就使缓存区不会变得太大。

**关键参数 `k`**：只保留最近 k 轮（一轮 = 一次 user → AI 的来回）。其它接口（`saveContext` / `loadMemoryVariables` / `memoryKey` / `returnMessages`）与 `BufferMemory` 完全一致。

```ts
import { BufferWindowMemory } from "langchain/memory";

const memory = new BufferWindowMemory({ k: 2 });   // 只保留最近 2 轮

await memory.saveContext({ input: "我叫小明" },        { output: "你好小明" });
await memory.saveContext({ input: "我今年 18 岁" },     { output: "记住了，18 岁" });
await memory.saveContext({ input: "我喜欢编程" },       { output: "编程很有趣" });
await memory.saveContext({ input: "我用 TypeScript" },  { output: "TS 类型安全" });

console.log(await memory.loadMemoryVariables({}));
// {
//   history:
//     'Human: 我喜欢编程\nAI: 编程很有趣\n' +
//     'Human: 我用 TypeScript\nAI: TS 类型安全'
// }
//   ↑ 只剩最近 2 轮，前两轮（"我叫小明" / "我今年 18 岁"）已被丢弃
```

代价：模型**会忘掉**窗口之外的信息。比如上面这段，再问"我叫什么"它就答不出来了——这是窗口策略的本质，不是 bug。

**和 BufferMemory 的取舍**：

| 维度 | BufferMemory | BufferWindowMemory |
| --- | --- | --- |
| 历史保留 | 全部 | 最近 k 轮 |
| token 消耗 | 随轮数线性增长 | 上限可控 |
| 是否会忘 | 不会 | **会忘掉远处的事** |
| 适用 | 短会话、调试 | 长会话、生产环境 |

> 如果既想控制 token 又不想丢早期信息 → 用 `ConversationSummaryBufferMemory`（最近 k 轮原文 + 更早的消息自动摘要）。

