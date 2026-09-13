语言模型返回的内容通常都是字符串的格式（文本格式），但在实际AI应用开发过程中，往往希望model可以返回更直观、更格式化的内容，以确保应用能够顺利进行后续的逻辑处理。此时，LangChain提供的 **`输出解析器`** 就派上用场了。

输出解析器（Output Parser）负责获取 LLM 的输出并将其转换为更合适的格式。这在应用开发中及其重要。


LangChain有许多不同类型的输出解析器
- `StrOutputParser` ：字符串解析器
- `JsonOutputParser` ：JSON解析器，确保输出符合特定JSON对象格式
- `XMLOutputParser` ：XML解析器，允许以流行的XML格式从LLM获取结果
- `CommaSeparatedListOutputParser` ：CSV解析器，模型的输出以逗号分隔，以列表形式返回输出
- `DatetimeOutputParser` ：日期时间解析器，可用于将 LLM 输出解析为日期时间格式
除了上述常用的输出解析器之外，还有：
- `EnumOutputParser` ：枚举解析器，将LLM的输出，解析为预定义的枚举值
- `StructuredOutputParser` ：将非结构化文本转换为预定义格式的结构化数据（如字典）
- `OutputFixingParser` ：输出修复解析器，用于自动修复格式错误的解析器，比如将返回的不符合预期格式的输出，尝试修正为正确的结构化数据（如 JSON）
- `RetryOutputParser` ：重试解析器，当主解析器（如 JSONOutputParser）因格式错误无法解析LLM 的输出时，通过调用另一个 LLM 自动修正错误，并重新尝试解析

