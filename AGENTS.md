ReasonLoop
A Reasoning Middleware Between Agents and Models
一、项目定义

ReasonLoop 不是：

Agent
Chat CLI
Prompt 集合
Claude Code 替代品

ReasonLoop 是：

一个位于 Agent 与 LLM 之间的推理中间件（Reasoning Middleware）。

传统架构：

User
 ↓
Agent
 ↓
LLM
 ↓
Response

例如：

Claude Code
Cursor Agent
OpenCode
Cline
Aider

本质都是：

Harness
 ↓
LLM

ReasonLoop 引入新的层：

User
 ↓
Agent
 ↓
ReasonLoop
 ↓
LLM
 ↓
Response

ReasonLoop 不负责：

Tool调用
文件系统
Shell执行
UI交互

这些属于 Agent。

ReasonLoop 只负责：

管理推理过程。

二、核心问题

现代 Agent 最大的问题不是不会调用工具。

而是：

复杂任务不稳定

表现为：

推理漂移

最初目标：

设计 Minecraft 启动器

5轮后：

开始讨论用户增长
提前收敛

模型找到一个看起来合理的方案后停止探索。

自洽幻觉

模型：

我认为这是正确的

实际上：

没有验证
不可调试

只能看到：

输入
↓
输出

看不到：

为什么这么想
三、核心思想

传统模型：

文本
↓
文本
↓
文本

ReasonLoop：

State
↓
State
↓
State

核心理念：

推理不是文本生成过程，而是状态转移过程。

四、系统架构
Agent
 ↓
ReasonLoop Gateway
 ↓
Complexity Analyzer
 ↓
Policy Controller
 ↓
Reasoning Loop
 ├─ Planner
 ├─ Critic
 ├─ Adversary
 └─ Validator
 ↓
State Transition Engine
 ↓
Prompt Compiler
 ↓
Model Adapter
 ↓
LLM
五、核心组件
1 State

系统唯一可信数据源。

interface ReasoningState {
  goal: string

  claims: Claim[]

  assumptions: Assumption[]

  evidence: Evidence[]

  openQuestions: string[]

  controversies: Controversy[]

  metadata: Metadata
}

State 不保存思维链。

State 保存：

当前认知状态
2 Scratchpad

自由思考空间。

允许：

试错
猜测
发散
探索

不参与最终存储。

作用：

思考发生地
3 Planner

负责：

扩展思路
提出方案
发现可能路径

Planner 不负责判断正确性。

4 Critic

负责：

寻找逻辑漏洞
寻找遗漏
寻找不一致

例如：

缺少更新系统设计

缺少权限模型
5 Adversary

负责：

主动攻击当前方案

例如：

如果只有一个开发者呢？

如果没有服务器呢？

如果用户量只有100呢？

目的：

打破自我认证
6 Validator

唯一连接现实的模块。

包括：

代码执行
检索
规则检查
API调用

作用：

Reality Check

没有 Validator：

ReasonLoop = 高级自洽生成器
六、Reasoning Loop

系统核心。

传统：

Prompt
↓
LLM
↓
Answer

ReasonLoop：

State
 ↓

Planner

 ↓

Critic

 ↓

Adversary

 ↓

Validator

 ↓

State Update

 ↓

Policy

 ↓

Continue?

循环：

直到收敛
七、Policy Controller

整个系统的大脑。

负责：

下一步做什么

输出：

type Decision =
  | "expand"
  | "refine"
  | "verify"
  | "attack"
  | "stop"

核心逻辑：

边际收益
VS
边际成本

如果：

继续思考收益不大

停止。

八、收敛机制

不是：

找到真理

而是：

继续思考不划算

收敛条件：

达到预算

或者

状态稳定

或者

无新问题产生
九、Prompt Compiler

整个项目最重要的技术模块之一。

很多人以为：

State
↓
LLM

即可。

实际上：

所有模型最终只接受：

文本

因此需要：

State
 ↓
Prompt Compiler
 ↓
Prompt IR
 ↓
LLM

Prompt Compiler 负责：

把结构化状态
编译成模型可理解上下文

例如：

{
  "goal":"设计启动器",
  "constraints":[...],
  "risks":[...]
}

编译为：

Goal:
...

Constraints:
...

Risks:
...
十、Complexity Analyzer

ReasonLoop 不应该总是启动深度推理。

例如：

TCP是什么

复杂度：

0.1

直接透传。

例如：

设计Minecraft启动器

复杂度：

0.9

启动完整推理循环。

十一、接入方式
MVP

OpenAI Compatible Proxy

架构：

Claude Code
 ↓
localhost:8080
 ↓
ReasonLoop
 ↓
Anthropic

Agent 无需修改。

只修改：

baseURL

即可接入。

未来支持：

Claude Code
Cursor
OpenCode
Cline
Aider
Continue
十二、技术架构
Runtime
Node.js
TypeScript
Persistence
JSON
SQLite
API
OpenAI Compatible
Internal Modules
gateway/
state/
planner/
critic/
adversary/
validator/
policy/
compiler/
adapter/
十三、MVP范围

必须实现：

State

Planner

Critic

Policy

Prompt Compiler

Proxy Server

暂不实现：

Multi View

复杂图推理

长期记忆

知识图谱
十四、长期愿景

今天：

Agent
 ↓
Model

未来：

Agent
 ↓
ReasonLoop
 ↓
Model

就像：

应用
 ↓
操作系统
 ↓
CPU

一样。

十五、最终定位

一句话定义：

ReasonLoop is a reasoning middleware that sits between agents and language models, transforming raw prompts into structured, stateful, adversarially-evaluated reasoning processes before execution.

中文：

ReasonLoop 是一个位于 Agent 与大模型之间的推理中间件，通过状态机、反馈控制、对抗评估和现实验证，将原本不可控的语言生成过程转化为可观测、可迭代、可收敛的推理过程。

我个人认为，经过所有讨论后，真正有价值的创新点已经不是“思维链增强”，而是：

把推理从 Prompt 层提升到了 Runtime 层。

这是它和绝大多数“超级提示词”“思考框架”“Agent Workflow”的本质区别。