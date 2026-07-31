### 理论基础：向量与语义相似

####  Embedding 是什么

- 将自然语言（文本、关键词、句子、段落）映射到高维稠密向量空间
- 语义相似的文本在空间中“距离更近”
- 常用于：语义搜索、RAG、推荐召回、聚类、去重、异常检测

####  常见相似度度量

- `余弦相似度（Cosine）`：衡量夹角，最常见，范围 [-1,1]
- `点积（Dot Product）`：与向量长度相关；部分模型推荐使用
- `欧氏距离（L2）`：距离越小越相似

#### 文本分块与上下文窗口

- LLM/RAG 常用“文档分块（chunking）”策略：固定长度、重叠窗口、句子/段落边界对齐
- 目标：确保检索到的块“语义完整”，同时控制 token 成本
- `分块过大：检索粗；过小：语义破碎`；需结合评测调优

#### 检索器策略

- TopK 最近邻：最基础（按相似度排序取前 K）
- MMR（Maximal Marginal Relevance）：在相关性与多样性之间平衡，降低重复
- Metadata Filter：基于结构化元数据的筛选（时间、作者、类型、部门等）
- Rerank：用更强模型（Cross-Encoder/LLM）对候选进行重排
- 混合搜索：BM25（关键词）+ 向量搜索 融合，提高鲁棒性

## Agent-Server 中的策略实现

### 已实现的核心功能

#### 1. Embedding 与向量数据库集成 ✅
- **技术栈**: Upstash Vector + BGE-M3 内置 embedding 模型
- **实现位置**: `VectorDBService` (src/vectorDB/vectorDB.service.ts)
- **特点**: 
  - 自动文本到向量转换，无需手动生成 embedding
  - 默认使用余弦相似度度量
  - 支持 metadata 存储和过滤

#### 2. TopK 最近邻检索 ✅
- **实现位置**: `vectorDBService.query()` 方法
- **使用方式**: 
  ```typescript
  // vector.tool.ts 中的调用
  const results = await vectorDB.query(query, {
    topK,        // 可配置的结果数量
    filter,      // metadata 过滤
    includeMetadata: true
  });
  ```
- **应用场景**: 剧情记忆检索、角色查询等

#### 3. Metadata 过滤 ✅
- **实现机制**: Upstash Vector 的 filter 参数
- **应用示例**: 
  ```typescript
  filter: `novelId = ${novelId}`  // 按小说ID过滤
  ```
- **支持的过滤维度**: novelId、内容类型等结构化数据

#### 4. 工具集成架构 ✅
- **实现位置**: `AgentService` (src/agent/agent.service.ts)
- **架构特点**:
  - 模块化工具设计：vector.tool、prisma.tool、style.tool
  - 支持流式响应和工具调用循环
  - 最大迭代次数限制（MAX_ITERATIONS = 5）

### 当前局限性

#### 1. 文本分块策略 ⚠️
- **现状**: 依赖 metadata 类型字段进行内容分类
- **缺失**: 没有实现固定长度、重叠窗口等高级分块策略
- **影响**: 可能影响检索的语义完整性

#### 2. 高级检索策略 ❌
- **MMR（最大边际相关性）**: 未实现，缺少相关性与多样性平衡
- **Rerank（重排序）**: 未实现，缺少 Cross-Encoder/LLM 二次排序
- **混合搜索**: 未实现，缺少 BM25 + 向量搜索融合

### 性能特征

#### 优势
- ✅ 低延迟：Upstash Vector 云端服务，毫秒级响应
- ✅ 简化开发：内置 embedding，无需管理向量生成
- ✅ 灵活过滤：支持 metadata 条件筛选
- ✅ 流式处理：支持实时响应和工具调用

#### 改进空间
- 🔄 检索质量：引入 MMR 提高结果多样性
- 🔄 排序精度：添加 rerank 层提高相关性
- 🔄 搜索鲁棒性：实现混合搜索结合关键词匹配