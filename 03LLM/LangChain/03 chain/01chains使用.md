---
date: 2026-04-26
---
## Chain的基本概念
Chain：链，用于将多个组件（提示模板、LLM模型、记忆、工具等）连接起来，形成可复用的 `工作流` ，完成复杂的任务。
**Chain 的核心思想**是通过组合不同的模块化单元，实现比单一组件更强大的功能。比如
- 将 LLM 与 Prompt Template （提示模板）结合
- 将 LLM 与 输出解析器 结合
- 将 LLM 与 外部数据 结合，例如用于问答
- 将 LLM 与 长期记忆 结合，例如用于聊天历史记录
- 通过将 第一个LLM 的输出作为 第二个LLM 的输入，...，将多个LLM按顺序结合在一起
## LCEL 及其基本构成
使用LCEL，可以构造出结构最简单的Chain。
LangChain表达式语言（LCEL，LangChain Expression Language）是一种声明式方法，可以轻松地将多个组件链接成 AI 工作流。它通过Python原生操作符（如管道符 | ）将组件连接成可执行流程，显著简化了AI应用的开发。

**LCEL的基本构成**：提示（Prompt）+ 模型（Model）+ 输出解析器（OutputParser）


- Prompt：Prompt 是一个 BasePromptTemplate，这意味着它接受一个模板变量的字典并生成一个 PromptValue 。PromptValue 可以传递给 LLM（它以字符串作为输入）或 ChatModel（它以消息序列作为输入）。
- Model：将 PromptValue 传递给 model。如果我们的 model 是一个 ChatModel，这意味着它将输出一个 BaseMessage 。
- OutputParser：将 model 的输出传递给 output_parser，它是一个 BaseOutputParser，意味着它可以接受字符串或 BaseMessage 作为输入。
- chain：我们可以使用 | 运算符轻松创建这个Chain。 | 运算符在 LangChain 中用于将两个元素组合在一起。
- invoke：所有LCEL对象都实现了 Runnable 协议，保证一致的调用方式（ invoke / batch / stream ）

## Runnable
Runnable是LangChain定义的一个抽象接口（Protocol），它 强制要求 所有LCEL组件实现一组标准方法：
任何实现了这些方法的对象都被视为LCEL兼容组件。比如：聊天模型、提示词模板、输出解析器、检索器、代理(智能体)等。

每个 LCEL 对象都实现了 Runnable 接口，该接口定义了一组公共的调用方法。这使得 LCEL 对象链也自动支持这些调用成为可能。

### 为什么需要统一调用方式？
传统问题

假设没有统一协议：
- 提示词渲染用 .format()
- 模型调用用 .generate()
- 解析器解析用 .parse()
- 工具调用用 .run()

代码会变成：

```ts
const promptText = prompt.format({ topic: "猫" });        // 提示词：format
const raw        = await model.generate(promptText);      // 模型：generate
const result     = parser.parse(raw.text);                // 解析器：parse
const final      = await tool.run(result);                // 工具：run
```
**痛点**：每个组件调用方式不同，组合时需要手动适配。
### LCEL解决方案

通过 Runnable 协议统一：

```ts
const chain = prompt.pipe(model).pipe(parser).pipe(tool);
const final = await chain.invoke({ topic: "猫" });
```
- 一致性：无论组件的功能多复杂（模型/提示词/工具），调用方式完全相同
- 组合性：管道操作符 | 背后自动处理类型匹配和中间结果传递