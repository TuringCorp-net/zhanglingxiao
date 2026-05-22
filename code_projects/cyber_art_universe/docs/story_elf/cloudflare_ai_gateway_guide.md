# 文档说明
- 本文档介绍了本项目所使用的AI大模型底层调用方式

## 调用路径和模型选择
- 本项目原则上使用Cloudflare的AI gateway来调用相应的大模型，并且是BYOK的方式。选择原因为通过统一的AI gateway来管理所有的可选大模型，通过统一的Cloudflare的key来隐藏其他大模型的真正的key。真正的key在Cloudflare的后台已配置好。Cloudflare的key通过worker的secret进行配置，在后端存储，避免前端泄露。
- 默认大模型为deepseek-V4-flash，上下文窗口为1m。

## 调用demo
- 通过Cloudflare的AI gateway的DeepSeek模型调用demo（account_id已配置，gateway_id已配置，CF_AIG_TOKEN需以secret变量配置到后端worker）：

‘’‘
curl https://gateway.ai.cloudflare.com/v1/21303cf88c8c1cc2c97d78eabda103a2/turingcorp/deepseek/chat/completions \
 --header 'content-type: application/json' \
 --header 'cf-aig-authorization: Bearer $CF_AIG_TOKEN' \
 --data '{
    "model": "deepseek-v4-flash",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
‘’‘

## Story elf封装（Agent）
- 本项目所用的story elf并不是直接裸大模型，而是有大量harness agent工程再加上用户记忆所组成的Agent
- 因此，Story elf应该至少分为两层，第一层是底层大模型调用，这一点上面已经有阐述，通过Cloudflare的AI gateway去调用，第二层是特有的工作流编排以及包含记忆以及指令的上下文组装。
- 工作流编排，包括但不限于从M0到M6各个不同环节的不同运行流程；
- 记忆，包括但不限于从作品到阅读喜好到写作风格，用户对话等多维度多方面的用户记忆
- 指令，包括但不限于适配写作模板、写作方法等方面，以及陪伴阅读、交流心得等方面的上下文指令，让story elf可以凸显特定形象风格。

## deepseek多轮对话上下文指导

多轮对话

本指南将介绍如何使用 DeepSeek /chat/completions API 进行多轮对话。

DeepSeek /chat/completions API 是一个“无状态” API，即服务端不记录用户请求的上下文，用户在每次请求时，需将之前所有对话历史拼接好后，传递给对话 API。

下面的代码以 Python 语言，展示了如何进行上下文拼接，以实现多轮对话。

from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

- Round 1
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 1: {messages}")

- Round 2
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 2: {messages}")


在第一轮请求时，传递给 API 的 messages 为：

[
    {"role": "user", "content": "What's the highest mountain in the world?"}
]

在第二轮请求时：

要将第一轮中模型的输出添加到 messages 末尾
将新的提问添加到 messages 末尾
最终传递给 API 的 messages 为：

[
    {"role": "user", "content": "What's the highest mountain in the world?"},
    {"role": "assistant", "content": "The highest mountain in the world is Mount Everest."},
    {"role": "user", "content": "What is the second?"}
]

## deepseek上下文缓存指导

### 上下文硬盘缓存

DeepSeek API 上下文硬盘缓存技术对所有用户默认开启，用户无需修改代码即可享用。

用户的每一个请求都会触发硬盘缓存的构建。若后续请求与之前的请求在前缀上存在重复，则重复部分只需要从缓存中拉取，计入“缓存命中”。

### 缓存落盘与命中规则

缓存命中的前提是相应前缀已被“落盘”（写入硬盘缓存）。受 Sliding Window Attention 机制的影响，缓存前缀的存取与判别与之前有所不同。每条缓存前缀是一个独立的完整单元。后续请求只有在完整匹配缓存前缀单元时，才能命中缓存。

### 缓存前缀落盘时机：

请求结束位置落盘：每次请求的用户输入结束位置与模型输出结束位置，会产生两个缓存前缀单元。后续请求若完整匹配了它们，则可命中。

公共前缀检测落盘：当系统检测到多次请求之间存在公共前缀时，会将该公共前缀作为一个独立的缓存前缀单元进行落盘。后续请求若完整复用了该缓存前缀单元，则可命中。

按固定 token 间隔落盘：在长输入或长输出中，系统会以一定的 token 数量为间隔，截取缓存前缀单元，避免长前缀因迟迟未达到结束位置而完全无法被缓存。

举例 1：用户第一轮请求内容为 A + B，第二轮请求内容为 A + B + C，则第二轮请求能完整匹配 A + B 这个缓存前缀单元，可以命中 A + B 的缓存。详见下文例一。

举例 2：用户第一轮请求的内容为 A + B，第二轮请求的内容为 A + C，则第二轮请求无法命中缓存，因为 A + C 不能完整匹配第一轮的缓存前缀单元（A + B）。但此时系统会识别到两轮请求存在公共前缀 A，并将 A 作为缓存前缀单元落盘。当第三轮请求 A + D 到来时，能完整匹配 A 这个缓存前缀单元，可以命中 A 的缓存。详见下文例二。

- 例一：多轮对话

第一次请求

messages: [
    {"role": "system", "content": "你是一位乐于助人的助手"},
    {"role": "user", "content": "中国的首都是哪里？"}
]

第二次请求

messages: [
    {"role": "system", "content": "你是一位乐于助人的助手"},
    {"role": "user", "content": "中国的首都是哪里？"},
    {"role": "assistant", "content": "中国的首都是北京。"},
    {"role": "user", "content": "美国的首都是哪里？"}
]

在上例中，第二次请求可以完整复用第一次请求的缓存前缀单元，这部分会计入“缓存命中”。

- 例二：长文本问答

第一次请求

messages: [
    {"role": "system", "content": "你是一位资深的财报分析师..."}
    {"role": "user", "content": "<财报内容>\n\n请总结一下这份财报的关键信息。"}
]

第二次请求

messages: [
    {"role": "system", "content": "你是一位资深的财报分析师..."}
    {"role": "user", "content": "<财报内容>\n\n请分析一下这份财报的盈利情况。"}
]

第三次请求

messages: [
    {"role": "system", "content": "你是一位资深的财报分析师..."}
    {"role": "user", "content": "<财报内容>\n\n请分析一下公司收入与支出占比。"}
]

在上例中，前两次请求不会命中缓存。前两次请求完成后，系统会识别出 system 消息 + user 消息中的<财报内容>为缓存前缀单元，并进行落盘。在第三次请求中，由于完整匹配了前面落盘的缓存前缀单元，则可命中缓存。

### 查看缓存命中情况

在 DeepSeek API 的返回中，我们在 usage 字段中增加了两个字段，来反映请求的缓存命中情况：

prompt_cache_hit_tokens：本次请求的输入中，缓存命中的 tokens 数

prompt_cache_miss_tokens：本次请求的输入中，缓存未命中的 tokens 数

### 硬盘缓存与输出随机性

硬盘缓存只匹配到用户输入的前缀部分，输出仍然是通过计算推理得到的，仍然受到 temperature 等参数的影响，从而引入随机性。其输出效果与不使用硬盘缓存相同。

### 其它说明

缓存系统是“尽力而为”，不保证 100% 缓存命中

缓存构建耗时为秒级。缓存不再使用后会自动被清空，时间一般为几个小时到几天