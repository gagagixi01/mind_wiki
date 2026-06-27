# AI Progress Weekly Digest PRD

## 1. 产品名称与一句话定位

**产品名称：** AI Progress Weekly Digest

**一句话定位：** 一个中文优先的 AI 进展研究网站，帮助个人创业者在 10 分钟内理解“本周 AI 发生了什么，以及它在长期技术与商业趋势中意味着什么”。

产品由两部分组成：

- **公共网站：** 静态发布，只展示人工批准后的周报、事件、轨迹、提供方和因果链内容。
- **本地工作台：** 本地私有使用，用于自动发现来源、抽取、AI 草稿、质量报告、人工审核、因果链编辑和周报构建。

## 2. 用户问题

目标用户想持续学习 AI 技术与商业进展，但会遇到几个现实问题：

- 每周论文、模型发布、公司新闻、投资和基础设施动态太多，阅读成本过高。
- 单条新闻很容易被看成孤立事件，难以理解它属于哪条长期趋势。
- 技术变化和商业动作之间的关系不清晰，例如 Nvidia 投资、GPU 供应、模型规模化和架构选择之间如何互相影响。
- 个人创业阶段需要快速建立判断力，既要看历史轨迹，也要看到最新变化。
- 纯自动化摘要不可靠，需要 AI 提效，但最终判断仍要人工批准。

## 3. 目标用户

V1 的核心用户是项目作者本人：处于创业早期、需要持续研究 AI 行业方向的人。

典型使用场景：

- 每周快速了解 AI 领域发生了什么。
- 追踪 Transformer、Mamba、Diffusion、CLIP、多模态、模型发布、开源权重、GPU 基础设施等长期轨迹。
- 把商业事件和技术路线放在同一个判断框架里阅读。
- 用 AI assistant 和开源抽取工具减少信息整理成本。
- 将批准后的洞察沉淀为可复用的公开知识库。

## 4. 产品目标

- 让用户在 10 分钟内读懂本周 AI 进展的主线。
- 把新事件连接到长期技术与商业轨迹，而不是只做新闻列表。
- 用结构化事件卡片复用内容，让同一事件可以出现在周报、轨迹页、提供方页和因果链视图中。
- 支持商业到技术的因果理解，例如“GPU 供给约束如何影响模型规模化和架构选择”。
- 用 AI 辅助完成来源抽取和草稿生成，但所有公开内容必须经过人工批准。
- 保持公共站点简单、静态、可分享；保持本地工作台私有、可审查、可回溯。

## 5. 非目标

V1 不做以下内容：

- 不做公开 admin UI。
- 不做登录、权限和多用户协作。
- 不引入数据库作为必需依赖。
- 不自动发布内容。
- 不让浏览器端直接调用 OpenAI 或其他模型 API。
- 不让 AI 自动决定哪些事件值得发布。
- 不在公共静态站点中包含原始抽取、草稿、拒绝记录、运行日志或 API 密钥。
- 不覆盖 agents/tools、robotics 等未来轨迹，除非后续版本扩展。

## 6. 核心用户流程

### 6.1 阅读本周进展

1. 用户打开公共网站首页。
2. 首页默认回答“本周 AI 发生了什么，它在长期趋势中意味着什么？”
3. 用户先读一段中文 weekly thesis。
4. 用户查看 5-8 个 headline event cards。
5. 用户打开事件详情抽屉，查看来源、信心标签、相关轨迹和因果关系。
6. 用户进入周报详情页阅读完整综合。

### 6.2 追踪长期轨迹

1. 用户进入 Trajectories 页面。
2. 选择 LLM 架构、多模态架构、供应商发布或商业与基础设施轨迹。
3. 通过提供方、事件类型、信心标签、观察清单过滤事件。
4. 用户从时间线中理解技术路线如何演进。

### 6.3 连接商业与技术变化

1. 用户进入 Causal Chains 页面。
2. 查看来源事件、目标事件或概念、关系类型、解释、信心标签和来源数量。
3. 用户理解商业动作如何影响技术方向，例如 GPU 供给、资本投入、模型规模化、推理成本和架构选择。

### 6.4 自动发现、策展与人工发布

1. 用户不需要手动录入 URL。本地 pipeline 根据配置好的 source packs 自动发现候选来源。
2. Source packs 包含 RSS feeds 和 web search queries，并记录来源类型、相关轨迹、运行频率、可信度标签和去重规则。
3. RSS discovery 拉取 provider blogs、arXiv / Hugging Face papers、leaderboards、business news 和 infrastructure sources。
4. Web search discovery 按主题查询本周 AI model release、GPU supply、NVIDIA investment、multimodal model、LLM architecture 等变化，生成候选 URL。
5. 系统对候选来源做 URL normalize、重复来源检测、主题分类和 trajectory classification。
6. 本地流程使用 Crawl4AI 作为主抽取器，Trafilatura 作为 fallback。
7. 每个候选来源生成 discovery record、extraction quality report 和 run log，失败也必须成为可见记录。
8. AI assistant 根据抽取内容生成中文结构化草稿。
9. 系统校验草稿 schema、来源质量、重复来源和重复事件。
10. 用户在本地工作台人工审核、编辑、批准、拒绝或重试草稿。
11. 只有明确批准后的内容才会进入 `content/approved` 并出现在公共网站。
12. Pipeline 可以自动发现和整理候选来源，但不能自动发布内容，也不能让 AI 单独决定哪些事件进入公共站点。

## 7. 公共网站需求

公共网站是中文优先、静态可发布的研究站点。

核心页面：

- 首页：展示最新周报、weekly thesis、主线摘要、事件卡片和筛选器。
- 周报详情页：展示完整周报正文、headline events、watchlist events 和 closing synthesis。
- 轨迹页：按长期轨迹组织事件，支持筛选与稀疏状态展示。
- 提供方页：按 OpenAI、NVIDIA、Meta 等提供方聚合事件。
- 来源页：展示已批准事件的公开来源元数据，并标记来源缺失状态。
- 因果链页：展示结构化商业到技术或技术到技术的因果关系。

关键 UI 要求：

- 使用 shadcn/ui 风格的 research cockpit，而不是通用 SaaS dashboard。
- 桌面端使用 Sidebar 作为问题路由器。
- 移动端保留相同导航结构，不能横向溢出。
- 事件卡片使用 Card 和 Badge 显示日期、类型、轨迹、提供方、信心、来源数量和观察清单标记。
- 事件详情使用 Sheet 抽屉，支持键盘关闭，并保持用户当前浏览上下文。
- 筛选器支持轨迹、提供方、事件类型、信心和观察清单。
- 信心状态必须以文字表达，不能只依赖颜色。

公共站点只能读取批准内容：

- `content/approved/events/*.mdx`
- `content/approved/weeks/*.mdx`
- `content/approved/trajectories.ts`

## 8. 本地工作台需求

本地工作台是私有策展工具，不进入公共静态发布。

核心能力：

- Source pack 管理：配置 RSS feeds、web search queries、来源类型、相关轨迹、运行频率、可信度标签和去重规则。
- 自动发现队列：展示 RSS / web search 发现的候选 URL、发现原因、来源类型、轨迹分类和重复状态。
- 手动触发与本地定时：支持 `Run now`，也支持本地定时任务自动运行 discovery。
- 抽取状态：展示抽取中、fallback、失败、重复来源、AI 输出无效、已批准和已拒绝等状态。
- 质量报告：展示证据覆盖率、来源可信度、因果链接完整度等指标。
- 草稿审核：支持批准、驳回、重试。
- 因果链编辑：支持关系类型、置信度、说明和来源编辑。
- 周报构建：基于批准事件生成 weekly brief proposal。

边界要求：

- 浏览器端只更新本地 UI 状态。
- 浏览器端不得直接抓取 URL、执行 web search、写文件或调用模型 API。
- RSS、web search、真实抽取和模型调用必须发生在本地 server 或 worker 进程中。
- `.curation/` 存放本地 raw extracts、drafts、invalid outputs、rejected items、quality reports 和 run logs。

## 9. 内容与数据模型概要

### 9.1 Event

事件是公共网站的核心复用单元。

关键字段：

- `id`
- `title`
- `date`
- `type`
- `summary`
- `why_it_matters`
- `trajectories`
- `providers`
- `sources`
- `confidence`
- `watchlist`
- `causal_links`

事件类型包括：

- `paper`
- `model_release`
- `architecture`
- `business`
- `infra`
- `benchmark`
- `regulation`
- `product`

V1 轨迹包括：

- `llm_architecture`
- `multimodal_architecture`
- `provider_releases`
- `commercial_forces`

信心标签包括：

- `observed`
- `likely`
- `speculative`

### 9.2 Weekly Brief

周报引用事件 ID，而不是复制事件正文。

关键字段：

- week start
- week end
- weekly thesis
- headline event IDs
- watchlist event IDs
- closing synthesis
- body

### 9.3 Causal Link

因果链必须是结构化数据，不只是散文描述。

关键字段：

- source event
- target event 或 target concept
- relationship type
- explanation
- confidence
- sources

### 9.4 Curation State

本地策展状态保存在文件系统中，而不是 SQLite。

状态包括：

- source pack config
- discovery record
- raw extraction
- draft JSON
- invalid AI output
- rejected item
- quality report
- run log
- duplicate warning

## 10. V1 成功标准

V1 成功意味着：

- 用户能通过首页在 10 分钟内理解本周 AI 进展主线。
- 每个公开事件都有来源、信心标签和轨迹归属。
- 用户能从同一事件进入周报、轨迹、提供方和因果链视角。
- 公共静态输出不包含本地工作台、`.curation`、草稿、原始抽取、运行日志或 API 密钥。
- 用户不手动输入 URL，也能通过 RSS 和 web search 自动获得本周候选来源列表。
- 每个候选来源都有发现原因、来源类型、轨迹分类、去重状态和质量报告。
- 本地工作台清楚展示抽取、草稿、质量报告、审核和周报构建状态。
- AI 辅助流程能减少整理成本，但不能绕过人工批准。
- 项目可以通过 `pnpm test`、`pnpm lint`、`pnpm build` 和 `pnpm test:e2e` 验证核心质量。

## 11. V1 发布范围

V1 包含：

- 中文静态公共网站。
- 最新周报首页和周报详情页。
- 四条长期轨迹页面。
- 提供方视图。
- 来源视图。
- 因果链视图。
- 事件详情抽屉。
- 已批准 MDX 内容加载与校验。
- 本地 curation 文件系统。
- RSS 和 web search source packs。
- 自动 discovery pipeline：候选来源发现、URL normalize、去重、分类和运行记录。
- Crawl4AI / Trafilatura 抽取适配思路与本地 pipeline。
- OpenAI-compatible API 草稿生成边界。
- 本地工作台 UI。
- AppleDouble 文件清理与忽略规则。

V1 不包含：

- 公共后台。
- 自动发布。
- 无人值守自动发布。
- 公开云端爬虫服务。
- 多用户权限。
- 生产数据库。
- 公开工作台部署。
- robotics 和 agents/tools 轨迹。

## 12. 后续路线图

可能的后续版本方向：

- 增强 source pack 模板库：provider blogs、arXiv、Hugging Face papers、leaderboards、business news、infrastructure sources。
- 优化 web search query 生成、来源可信度评分和本地定时任务可视化。
- 增加 seed-data bootstrap，方便快速初始化高质量历史事件。
- 扩展 agents/tools 和 robotics 轨迹。
- 加强 source quality scoring，让来源质量影响事件信心标签。
- 增加更强的重复事件检测和事件合并流程。
- 增加半自动 weekly brief builder，把批准事件转化为候选周报结构。
- 增加图谱化因果视图，帮助用户看到商业、模型、硬件和架构之间的长期联动。
