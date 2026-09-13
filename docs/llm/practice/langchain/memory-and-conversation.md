
### 一、为什么需要 Memory

语言模型本身是无状态的，每次调用只依赖当前输入的 Prompt。但对话型应用需要"上下文记忆"，让模型理解"我们刚聊到哪儿了"。记忆的本质就是：在多轮对话间传递"压缩过的语义"与"关键事实"。
### 四大 Memory 类型与权衡

| 类型                        | 原理                    | 优点          | 风险            |
| ------------------------- | --------------------- | ----------- | ------------- |
| Buffer（对话缓冲）              | 全量保留近几轮消息             | 简单直接        | token 膨胀、成本升高 |
| Buffer Window（滑动窗口）       | 仅保留最近 N 条消息           | 降低 token 消耗 | 会忘记早期重要信息     |
| Summary（摘要记忆）             | 用模型将历史压缩成摘要，再与短期上下文拼接 | 大幅压缩历史      | 摘要偏差、信息丢失     |
| Vector Store Memory（向量记忆） | 将对话事实向量化，按语义相似度按需检索   | 事实性持久记忆、个性化 | 召回误差、运维成本     |
### LangChain.js 提供的 Memory 实现

- `ConversationBufferMemory` — 全量缓冲
- `ConversationBufferWindowMemory` — 滑动窗口（如 `k=4` 只保留最近4条）
- `ConversationSummaryMemory` — 摘要压缩
- `VectorStoreRetrieverMemory` — 向量检索记忆
- 自定义 Memory — 实现 `loadMemoryVariables` / `saveContext` 接口即可