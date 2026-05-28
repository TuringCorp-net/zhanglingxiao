# 文档说明
- 本文档介绍了本项目所使用的AI大模型底层调用方式

## 调用路径和模型选择
- 本项目原则上使用Cloudflare的AI gateway来调用相应的大模型，并且是BYOK的方式。选择原因为通过统一的AI gateway来管理所有的可选大模型，通过统一的Cloudflare的key来隐藏其他大模型的真正的key。真正的key在Cloudflare的后台已配置好。Cloudflare的key通过worker的secret进行配置，在后端存储，避免前端泄露。
- 默认大模型为deepseek-V4-flash，上下文窗口为1m。

---

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

---

## Story elf封装（Agent）
- 本项目所用的story elf并不是直接裸大模型，而是有大量harness agent工程再加上用户记忆所组成的Agent
- 因此，Story elf应该至少分为两层，第一层是底层大模型调用，这一点上面已经有阐述，通过Cloudflare的AI gateway去调用，第二层是特有的工作流编排以及包含记忆以及指令的上下文组装。
- 工作流编排，包括但不限于从M0到M6各个不同环节的不同运行流程；
- 记忆，包括但不限于从作品到阅读喜好到写作风格，用户对话等多维度多方面的用户记忆
- 指令，包括但不限于适配写作模板、写作方法等方面，以及陪伴阅读、交流心得等方面的上下文指令，让story elf可以凸显特定形象风格。

---

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

---

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

---

## deepseek json格式输出指导

在很多场景下，用户需要让模型严格按照 JSON 格式来输出，以实现输出的结构化，便于后续逻辑进行解析。

DeepSeek 提供了 JSON Output 功能，来确保模型输出合法的 JSON 字符串。

- 注意事项

设置 response_format 参数为 {'type': 'json_object'}。
用户传入的 system 或 user prompt 中必须含有 json 字样，并给出希望模型输出的 JSON 格式的样例，以指导模型来输出合法 JSON。
需要合理设置 max_tokens 参数，防止 JSON 字符串被中途截断。
在使用 JSON Output 功能时，API 有概率会返回空的 content。我们正在积极优化该问题，您可以尝试修改 prompt 以缓解此类问题。

- 样例代码

这里展示了使用 JSON Output 功能的完整 Python 代码：

import json
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

system_prompt = """
The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format. 

EXAMPLE INPUT: 
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}
"""

user_prompt = "Which is the longest river in the world? The Nile River."

messages = [{"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    response_format={
        'type': 'json_object'
    }
)

print(json.loads(response.choices[0].message.content))


模型将会输出：

{
    "question": "Which is the longest river in the world?",
    "answer": "The Nile River"
}

---

## deepseek toolcall工具调用指导

从 DeepSeek-V3.2 开始，API 支持了思考模式下的工具调用能力，详见思考模式。

### strict 模式（Beta）

在 strict 模式下，模型在输出 Function 调用时会严格遵循 Function 的 JSON Schema 的格式要求，以确保模型输出的 Function 符合用户的定义。在思考与非思考模式下的工具调用，均可使用 strict 模式。

### 要使用 strict 模式，需要：

- 用户需要设置 base_url="https://api.deepseek.com/beta" 来开启 Beta 功能
- 在传入的 tools 列表中，所有 function 均需设置 strict 属性为 true
- 服务端会对用户传入的 Function 的 JSON Schema 进行校验，如不符合规范，或遇到服务端不支持的 JSON Schema 类型，将返回错误信息

以下是 strict 模式下 tool 的定义样例：

{
    "type": "function",
    "function": {
        "name": "get_weather",
        "strict": true,
        "description": "Get weather of a location, the user should supply a location first.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }
            },
            "required": ["location"],
            "additionalProperties": false
        }
    }
}


strict 模式支持的 JSON Schema 类型

object
string
number
integer
boolean
array
enum
anyOf
object 类型

object 定义一个包含键值对的深层结构，其中 properties 定义了对象中每个键（属性）的 schema。每个 object 的所有属性均需设置为 required，且 object 中 additionalProperties 属性必须为 false。

示例：

{
    "type": "object",
    "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer" }
    },
    "required": ["name", "age"],
    "additionalProperties": false
}

string 类型

支持的参数：
pattern：使用正则表达式来约束字符串的格式
format：使用预定义的常见格式进行校验，目前支持：
email：电子邮件地址
hostname：主机名
ipv4：IPv4 地址
ipv6：IPv6 地址
uuid：uuid
不支持的参数
minLength
maxLength
示例：

{
    "type": "object",
    "properties": {
        "user_email": {
            "type": "string",
            "description": "The user's email address",
            "format": "email" 
        },
        "zip_code": {
            "type": "string",
            "description": "Six digit postal code",
            "pattern": "^\\d{6}$"
        }
    }
}

number/integer 类型

支持的参数
const：固定数字为常数
default：数字的默认值
minimum：最小值
maximum：最大值
exclusiveMinimum：不小于
exclusiveMaximum：不大于
multipleOf：数字输出为这个值的倍数
示例：

{
    "type": "object",
    "properties": {
        "score": {
            "type": "integer",
            "description": "A number from 1-5, which represents your rating, the higher, the better",
            "minimum": 1,
            "maximum": 5
        }
    },
    "required": ["score"],
    "additionalProperties": false
}


array 类型

不支持的参数
minItems
maxItems
示例：

{
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "description": "Five keywords of the article, sorted by importance",
            "items": {
                "type": "string",
                "description": "A concise and accurate keyword or phrase."
            }
        }
    },
    "required": ["keywords"],
    "additionalProperties": false
}

enum

enum 可以确保输出是预期的几个选项之一，例如在订单状态的场景下，只能是有限几个状态之一。

样例：

{
    "type": "object",
    "properties": {
        "order_status": {
            "type": "string",
            "description": "Ordering status",
            "enum": ["pending", "processing", "shipped", "cancelled"]
        }
    }
}

anyOf

匹配所提供的多个 schema 中的任意一个，可以处理可能具有多种有效格式的字段，例如用户的账户可能是邮箱或者手机号中的一个：

{
    "type": "object",
    "properties": {
    "account": {
        "anyOf": [
            { "type": "string", "format": "email", "description": "可以是电子邮件地址" },
            { "type": "string", "pattern": "^\\d{11}$", "description": "或11位手机号码" }
        ]
    }
  }
}


$ref 和 $def

可以使用 $def 定义模块，再用 $ref 引用以减少模式的重复和模块化，此外还可以单独使用 $ref 定义递归结构。

{
    "type": "object",
    "properties": {
        "report_date": {
            "type": "string",
            "description": "The date when the report was published"
        },
        "authors": {
            "type": "array",
            "description": "The authors of the report",
            "items": {
                "$ref": "#/$def/author"
            }
        }
    },
    "required": ["report_date", "authors"],
    "additionalProperties": false,
    "$def": {
        "author": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "author's name"
                },
                "institution": {
                    "type": "string",
                    "description": "author's institution"
                },
                "email": {
                    "type": "string",
                    "format": "email",
                    "description": "author's email"
                }
            },
            "additionalProperties": false,
            "required": ["name", "institution", "email"]
        }
    }
}

---

## deepseek 思考模式指导

思考模式

DeepSeek 模型支持思考模式：在输出最终回答之前，模型会先输出一段思维链内容，以提升最终答案的准确性。

思考模式开关与思考强度控制

控制参数（OpenAI 格式）	控制参数（Anthropic 格式）
思考模式开关(1)	{"thinking": {"type": "enabled/disabled"}}
思考强度控制(2)(3)	{"reasoning_effort": "high/max"}	{"output_config": {"effort": "high/max"}}
(1) 默认思考开关为 enabled
(2) 思考模式下，对普通请求，默认 effort 为 high；对一些复杂 Agent 类请求（如 Claude Code、OpenCode），effort 自动设置为 max
(3) 思考模式下，出于兼容考虑 low、medium 会映射为 high, xhigh 会映射为 max

您在使用 OpenAI SDK 设置 thinking 参数时，需要将 thinking 参数传入 extra_body 中：

response = client.chat.completions.create(
  model="deepseek-v4-pro",
  # ...
  reasoning_effort="high",
  extra_body={"thinking": {"type": "enabled"}}
)

输入输出参数

思考模式不支持 temperature、top_p、presence_penalty、frequency_penalty 参数。请注意，为了兼容已有软件，设置参数不会报错，但也不会生效。

在思考模式下，思维链内容通过 reasoning_content 参数返回，与 content 同级。在后续的轮次的拼接中，可以选择性地返回 reasoning_content 给 API：

在两个 user 消息之间，如果模型未进行工具调用，则中间 assistant 的 reasoning_content 无需参与上下文拼接，在后续轮次中将其传入 API 会被忽略。详见多轮对话拼接。
在两个 user 消息之间，如果模型进行了工具调用，则中间 assistant 的 reasoning_content 需参与上下文拼接，在后续所有 user 交互轮次中必须回传给 API。详见工具调用。
多轮对话拼接

在每一轮对话过程中，模型会输出思维链内容（reasoning_content）和最终回答（content）。如果没有工具调用，则在下一轮对话中，之前轮输出的思维链内容不会被拼接到上下文中，如下图所示：


样例代码

下面的代码以 Python 语言为例，展示了如何访问思维链和最终回答，以及如何在多轮对话中进行上下文拼接。

非流式
流式
from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Turn 1
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    reasoning_effort="high"
    extra_body={"thinking": {"type": "enabled"}},
)

reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content

# Turn 2
# The reasoning_content will be ignored by the API
messages.append(response.choices[0].message)
messages.append({'role': 'user', 'content': "How many Rs are there in the word 'strawberry'?"})
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    reasoning_effort="high"
    extra_body={"thinking": {"type": "enabled"}},
)
# ...


工具调用

DeepSeek 模型的思考模式支持工具调用功能。模型在输出最终答案之前，可以进行多轮的思考与工具调用，以提升答案的质量。其调用模式如下图所示：


请注意，区别于思考模式下的未进行工具调用的轮次，进行了工具调用的轮次，在后续所有请求中，必须完整回传 reasoning_content 给 API。

若您的代码中未正确回传 reasoning_content，API 会返回 400 报错。正确回传方法请您参考下面的样例代码。

样例代码

下面是一个简单的在思考模式下进行工具调用的样例代码：

import os
import json
from openai import OpenAI
from datetime import datetime

# The definition of the tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_date",
            "description": "Get the current date",
            "parameters": { "type": "object", "properties": {} },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply the location and date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": { "type": "string", "description": "The city name" },
                    "date": { "type": "string", "description": "The date in format YYYY-mm-dd" },
                },
                "required": ["location", "date"]
            },
        }
    },
]

# The mocked version of the tool calls
def get_date_mock():
    return datetime.now().strftime("%Y-%m-%d")

def get_weather_mock(location, date):
    return "Cloudy 7~13°C"

TOOL_CALL_MAP = {
    "get_date": get_date_mock,
    "get_weather": get_weather_mock
}

def run_turn(turn, messages):
    sub_turn = 1
    while True:
        response = client.chat.completions.create(
            model='deepseek-v4-pro',
            messages=messages,
            tools=tools,
            reasoning_effort="high",
            extra_body={ "thinking": { "type": "enabled" } },
        )
        messages.append(response.choices[0].message)
        reasoning_content = response.choices[0].message.reasoning_content
        content = response.choices[0].message.content
        tool_calls = response.choices[0].message.tool_calls
        print(f"Turn {turn}.{sub_turn}\n{reasoning_content=}\n{content=}\n{tool_calls=}")
        # If there is no tool calls, then the model should get a final answer and we need to stop the loop
        if tool_calls is None:
            break
        for tool in tool_calls:
            tool_function = TOOL_CALL_MAP[tool.function.name]
            tool_result = tool_function(**json.loads(tool.function.arguments))
            print(f"tool result for {tool.function.name}: {tool_result}\n")
            messages.append({
                "role": "tool",
                "tool_call_id": tool.id,
                "content": tool_result,
            })
        sub_turn += 1
    print()

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url=os.environ.get('DEEPSEEK_BASE_URL'),
)

# The user starts a question
turn = 1
messages = [{
    "role": "user",
    "content": "How's the weather in Hangzhou Tomorrow"
}]
run_turn(turn, messages)

# The user starts a new question
turn = 2
messages.append({
    "role": "user",
    "content": "How's the weather in Guangzhou Tomorrow"
})
run_turn(turn, messages)


在 Turn 1 的每个子请求中，都携带了该 Turn 下产生的 reasoning_content 给 API，从而让模型继续之前的思考。response.choices[0].message 携带了 assistant 消息的所有必要字段，包括 content、reasoning_content、tool_calls。简单起见，可以直接用如下代码将消息 append 到 messages 结尾：

messages.append(response.choices[0].message)

这行代码等价于：

messages.append({
    'role': 'assistant',
    'content': response.choices[0].message.content,
    'reasoning_content': response.choices[0].message.reasoning_content,
    'tool_calls': response.choices[0].message.tool_calls,
})

且在 Turn 2 的请求中，我们仍然携带着 Turn1 所产生的 reasoning_content 给 API。

该代码的样例输出如下：

Turn 1.1
reasoning_content="The user is asking about the weather in Hangzhou tomorrow. I need to get tomorrow's date first, then call the weather function."
content="Let me check tomorrow's weather in Hangzhou for you. First, let me get tomorrow's date."
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_kw66qNnNto11bSfJVIdlV5Oo', function=Function(arguments='{}', name='get_date'), type='function', index=0)]
tool result for get_date: 2026-04-19

Turn 1.2
reasoning_content="Today is 2026-04-19, so tomorrow is 2026-04-20. Now I'll call the weather function for Hangzhou."
content=''
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_H2SCW6136vWJGq9SQlBuhVt4', function=Function(arguments='{"location": "Hangzhou", "date": "2026-04-20"}', name='get_weather'), type='function', index=0)]
tool result for get_weather: Cloudy 7~13°C

Turn 1.3
reasoning_content='The weather result is in. Let me share this with the user.'
content="Here's the weather forecast for **Hangzhou tomorrow (April 20, 2026)**:\n\n- 🌤 **Condition:** Cloudy  \n- 🌡 **Temperature:** 7°C ~ 13°C (45°F ~ 55°F)\n\nIt'll be on the cooler side, so you might want to bring a light jacket if you're heading out! Let me know if you need anything else."
tool_calls=None

Turn 2.1
reasoning_content='The user is asking about the weather in Guangzhou tomorrow. Today is 2026-04-19, so tomorrow is 2026-04-20. I can directly call the weather function.'
content=''
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_8URkLt5NjmNkVKhDmMcNq9Mo', function=Function(arguments='{"location": "Guangzhou", "date": "2026-04-20"}', name='get_weather'), type='function', index=0)]
tool result for get_weather: Cloudy 7~13°C

Turn 2.2
reasoning_content='The weather result for Guangzhou is the same as Hangzhou. Let me share this with the user.'
content="Here's the weather forecast for **Guangzhou tomorrow (April 20, 2026)**:\n\n- 🌤 **Condition:** Cloudy  \n- 🌡 **Temperature:** 7°C ~ 13°C (45°F ~ 55°F)\n\nIt'll be cool and cloudy, so a light jacket would be a good idea if you're going out. Let me know if there's anything else you'd like to know!"
tool_calls=None


