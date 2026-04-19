---
date: 2026-04-19
---
## 介绍与分类
Prompt Template 是LangChain中的一个概念，接收用户输入，返回一个传递给LLM的信息（即提示词prompt）。
在应用开发中，固定的提示词限制了模型的灵活性和适用范围。所以，**prompt template** 是一个**模板化**的字符串 ，你可以将 **变量插入到模板** 中，从而创建出不同的提示。调用时
- 以 **字典** 作为输入，其中每个键代表要填充的提示模板中的变量。
- 输出一个 PromptValue 。这个 PromptValue 可以传递给 LLM 或 ChatModel，并且还可以转换为字符串或消息列表。
**有几种不同类型的提示模板**
- **PromptTemplate** ：LLM提示模板，用于生成字符串提示。它使用 Python 的字符串来模板提示。
- **ChatPromptTemplate** ：聊天提示模板，用于组合各种角色的消息模板，传入聊天模型。
- XxxMessagePromptTemplate:消息模板词模板，包括：SystemMessagePromptTemplate、HumanMessagePromptTemplate、AIMessagePromptTemplate、ChatMessagePromptTemplate等
- **FewShotPromptTemplate**:样本提示词模板，通过示例来教模型如何回答
- **PipelinePrompt**:管道提示词模板，用于把几个提示词组合在一起使用。
- **自定义模板** ：允许基于其它模板类来定制自己的提示词模板。

### PromptTemplate
PromptTemplate 类，用于快速构建 **包含变量** 的提示词模板，并通过 **传入不同的参数值** 生成自定义的提示词。

**核心思想**：把"提示词"从硬编码字符串升级为「可复用的模板对象」，解决三个问题：
1. **变量占位与延迟绑定**：模板中用 `{var}` 占位，运行时再注入真实值，实现"一次定义、多次调用"。
2. **参数语义分层**：区分"每次都要传"的动态参数和"提前预填"的半固定参数。
3. **统一接口（Runnable 协议）**：实现了 `RunnableSerializable`，可以与 LLM、OutputParser 通过 `.pipe()` 串成 LCEL（LangChain Expression Language（LangChain 表达式语言））链路。

**主要参数介绍：**
- `template`：定义提示词模板的字符串，其中包含 文本 和 变量占位符（如 `{name}`）；
- `input_variables` / `inputVariables`：列表，指定模板中使用的变量名称，在调用模板时被替换；
- `partial_variables` / `partialVariables`：字典，用于定义模板中一些固定的变量名（典型如系统时间、用户身份），这些值不需要再每次调用时被替换。

**函数介绍：**
- `format()`：给 `input_variables` 变量赋值，并返回提示词。利用 `format()` 进行格式化时就一定要赋值，否则会报错。当在 template 中未设置 `input_variables`，则会自动忽略。
- `invoke()`：Runnable 协议的统一调用入口，返回 `PromptValue`。

#### 两种实例化方式

##### 构造函数形式
显式声明 `template`、`inputVariables`、`partialVariables` 三个字段，适合需要预填部分参数的场景。

```ts
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = new PromptTemplate({
  template: "你好 {name}，今天是 {date}，请用 {style} 风格写一句问候语。",
  inputVariables: ["name", "style"],
  partialVariables: {
    date: new Date().toLocaleDateString("zh-CN"),
  },
});

const text = await prompt.format({ name: "Yoren", style: "幽默" });
console.log(text);
```

要点：
- `date` 放在 `partialVariables` 里，调用 `format` 时**不需要再传**；
- 若漏传 `inputVariables` 中声明的 key（如 `name`），会直接抛错。

##### 调用 from_template()
静态工厂方法，会**自动扫描** `{xxx}` 占位符，无需手写 `inputVariables`，是最常用的写法。

```ts
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(
  "请将下面这段 {language} 代码翻译成 {target}：\n{code}"
);

const text = await prompt.format({
  language: "Python",
  target: "TypeScript",
  code: "print('hello')",
});
console.log(text);
```

##### format() 与 invoke()
只要对象是 `RunnableSerializable` 接口类型，都可以使用 `invoke()`，替换前面使用 `format()` 的调用方式。
- `format()`：返回值为 **字符串类型**；
- `invoke()`：返回值为 **PromptValue 类型**，接着调用 `to_string()` / `toString()` 返回字符串，也可调用 `toChatMessages()` 转为消息列表。

**等价关系示例：**

```ts
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate("用一句话介绍 {topic}");

const s1: string = await prompt.format({ topic: "LangChain" });

const pv = await prompt.invoke({ topic: "LangChain" });
const s2: string = pv.toString();

console.log(s1 === s2); // true
```

**为什么推荐 `invoke()`？**
只有统一返回 Runnable 协议的对象，才能用 `.pipe()` 把 Prompt → Model → Parser 串成一条流水线，这是 `format()`（只返回字符串）做不到的：

```ts
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const prompt = PromptTemplate.fromTemplate("用 {style} 的语气解释 {concept}");
const model = new ChatOpenAI({ model: "gpt-4o-mini" });
const parser = new StringOutputParser();

const chain = prompt.pipe(model).pipe(parser);

const answer = await chain.invoke({
  style: "通俗易懂",
  concept: "向量数据库",
});
console.log(answer);
```

| 方法         | 返回类型          | 是否可 `.pipe()` | 适用场景              |
| ---------- | ------------- | ------------- | ----------------- |
| `format()` | `string`      | ❌             | 需要纯字符串做日志、拼接      |
| `invoke()` | `PromptValue` | ✅             | 接入 LCEL 链路、统一调用风格 |
