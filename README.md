# ContentWork 内容生产工作台

ContentWork 的目标是把平台热点、对标账号内容、品牌商品信息和历史表现，转化为每天可拍的短视频脚本库。

当前项目已经从最小 MVP 进入 V2 大版本规划阶段。

## 当前状态

已跑通的 MVP 闭环：

- 抖音总热榜采集、入库、导出。
- 品牌配置读取。
- 固定对标账号池。
- 运营选择热点和对标结构。
- 确认素材包后调用 Codex CLI 生成脚本。
- 脚本写入 SQLite 并在页面展示。
- 脚本可进入独立脚本库，支持审核状态、发布链接、表现数据和模板标记。

当前主要问题：

- 产品形态仍像技术验证页。
- 数据输入过薄，缺少真实视频字幕、商品活动和账号内容表现。
- 脚本质量缺少评分、改写和复盘闭环。
- 平台采集不能只依赖登录态自动化，需要人工导入和第三方数据替代方案。

## V2 方向

V2 要把系统升级为“每日内容生产工作台”，拆成 7 个核心模块：

1. 今日工作台
2. 热点池
3. 对标内容池
4. 品牌与商品
5. 生成工作流
6. 脚本库与复盘
7. 采集任务中心

核心状态必须分清：

- 今日工作流：当天正在选择、确认和生成的内容。
- 历史资产：已入库脚本、字幕、结构摘要和复盘。
- 数据源状态：热榜、登录态、字幕服务、人工导入状态。
- 生成任务：待确认、结构分析、生成中、低质量、失败、已入库。

## 主要文档

- [V2 大版本产品与开发规划](docs/v2-product-development-plan.md)
- [V2 开发执行清单](docs/v2-implementation-backlog.md)
- [V2 技术架构与接口规格](docs/v2-technical-spec.md)
- [真实数据驱动原型计划](docs/real-data-prototype-plan.md)
- [抖音采集管道运行说明](docs/douyin-pipeline-ops.md)
- [对标视频字幕接入链路](docs/benchmark-subtitle-pipeline.md)

## 本地页面

启动静态服务后打开：

```bash
python3 -m http.server 8782 --bind 127.0.0.1
```

页面：

- V2 工作台：`http://127.0.0.1:8782/prototype/v2.html?v=content-pool-v1`
- 热点池：`http://127.0.0.1:8782/prototype/trend-pool.html?v=content-pool-v1`
- 对标内容池：`http://127.0.0.1:8782/prototype/content-pool.html?v=content-pool-v1`
- 品牌商品中心：`http://127.0.0.1:8782/prototype/brand-center.html?v=brand-center-v1`
- 当前脚本流程：`http://127.0.0.1:8782/prototype/index.html?v=brand-center-v1`
- AI 生成能力：`http://127.0.0.1:8782/prototype/ai-tools.html?v=brand-center-v1`
- 脚本库复盘：`http://127.0.0.1:8782/prototype/script-library.html?v=brand-center-v1`
- 采集任务中心：`http://127.0.0.1:8782/prototype/collection-center.html?v=brand-center-v1`

## 本地 API

首次启动前安装 Python 依赖：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

启动原型 API：

```bash
npm run prototype:api
```

简版内容生产 Agent 的单条视频录入已内嵌视频处理能力，不再依赖单独启动 `video-tools` 服务。抖音链接会在当前 API 进程内完成解析、无水印下载和字幕提取；如需 ASR 字幕，需要运行环境提供 `ASR_API_KEY`。

当前接口包括：

- `GET /api/health`
- `GET/POST /api/selections`
- `GET /api/v2/dashboard`
- `GET /api/v2/trends`
- `POST /api/v2/trends/{id}/mark`
- `GET /api/v2/workday/today`
- `POST /api/v2/workday/reset`
- `POST /api/v2/workday/close`
- `GET/POST /api/v2/content-sources`
- `POST /api/v2/content-sources/batch`
- `POST /api/v2/content-sources/{id}/select`
- `POST /api/v2/content-sources/{id}/structure`
- `GET/POST /api/v2/brand-products`
- `POST /api/v2/brand-products/{id}/select`
- `GET /api/v2/collection-tasks`
- `POST /api/v2/collection-tasks/run`
- `POST /api/v2/script-candidates/{id}/review`
- `POST /api/v2/script-candidates/{id}/rewrite`
- `GET /api/v2/script-library`
- `POST /api/v2/script-candidates/{id}/publish-result`
- `POST /api/confirm-selection`
- `POST /api/generate`
- `POST /api/ai/chat`
- `POST /api/ai/images/generate`
- `POST /api/ai/images/edit`

## 数据命令

导出原型数据：

```bash
npm run prototype:export
```

采集抖音总热榜：

```bash
npm run douyin:login
npm run douyin:category
```

生成脚本候选：

```bash
npm run scripts:generate
```

提取对标视频字幕：

```bash
npm run benchmarks:subtitles
```

## V2 开发顺序

推荐顺序：

1. V2.0 信息架构重构：多页面工作台、今日状态和历史脚本库分离。
2. V2.1 人工导入和对标内容池：链接导入、批量导入、手工字幕。
3. V2.2 字幕结构化闭环：接入 `video-tools`，生成结构摘要。
4. V2.3 脚本质量引擎：商品活动、质量评分、低分改写。
5. V2.4 采集任务中心：登录态健康、失败截图、手动重跑。
6. V2.5 复盘学习闭环：采用状态、发布表现、优质模板复用。

当前 V2.1 已开始落地：

- `content_sources` 本地表。
- `GET /api/v2/content-sources`
- `POST /api/v2/content-sources`
- `POST /api/v2/content-sources/batch`
- `POST /api/v2/content-sources/{id}/select`
- `POST /api/v2/content-sources/{id}/subtitle-text`
- `POST /api/v2/content-sources/bulk-select`
- `POST /api/v2/content-sources/bulk-structure`
- 独立对标内容池页面：单条导入、批量导入、内容列表、手工补录字幕、批量加入生成工作流、批量生成结构摘要。
- 全站左侧菜单已统一加入“对标内容池”，V2 首页也提供正式入口。
- V2 工作台里的单条导入、批量导入、最近导入列表和加入生成工作流按钮。
- 批量导入已支持一行一条链接，也支持灰豚、蝉妈妈、飞瓜、新榜等第三方表格复制粘贴。
- 第三方表格支持 `标题/链接/账号/平台/字幕/备注` 等表头别名，导入失败会返回具体行号和失败原因。
- 对标内容池批量导入已新增导入前预检，显示格式、识别字段、预计可导入行数、风险行和导入后的下一步动作。
- V2 工作台“最近导入”已支持导入后的批量处理：批量加入生成工作流、批量生成结构摘要。
- `GET /api/v2/dashboard` 已返回 `generationReadiness`，用于判断当前是否具备生成脚本条件。
- V2 工作台已新增“脚本生成准备度”模块，展示已确认素材、人工结构、商品活动和优质模板，并提供跳转到脚本流程的入口。
- 脚本流程页已新增“生成前检查”，直接读取 `generationReadiness`，展示确认素材包、结构摘要、商品活动和高表现模板是否就绪。
- 脚本流程页已新增输入证据链，显示本次会读取的商品活动和已加入的结构素材，并提供跳转维护入口。
- V2 工作台已新增“直接生成候选脚本”控制台，可选择生成 1-5 条，调用 `/api/generate`，展示质量分、输入证据和分镜，并写入脚本库。
- V2 生成结果卡片已支持直接审核：采用、待改、弃用，调用脚本库审核接口并同步脚本库状态。
- V2 生成结果卡片已支持轻量发布回填：发布链接、播放、点赞、线索和模板标记，调用脚本库发布表现接口并同步复盘数据。
- `GET /api/v2/dashboard` 已返回 `reviewInsights`，基于已发布脚本和优质模板生成复盘洞察。
- V2 工作台已新增“复盘洞察”模块，展示表现最好脚本、可复用模板、聚合表现和下一轮生成建议。
- 脚本库复盘页已新增“复盘学习”面板，直接展示发布表现、优质模板、最佳脚本和下一轮生成建议，让历史资产反哺脚本生成。
- `GET /api/v2/dashboard` 的 `tasks` 已改为真实数据驱动，根据采集失败、未结构化素材、新脚本待审核、待改脚本、模板数量生成今日待办。
- V2 工作台“今日待处理”已展示动态待办、数量和动作入口。
- `GET /api/v2/dashboard` 已返回 `workflowOverview`，把采集保障、选择选题、确认输入、生成脚本、审核采用、发布复盘串成首页生产闭环。
- V2 工作台已新增“今日生产闭环”面板，直接告诉运营今天卡在哪一步，以及下一步应该进入哪个页面处理。
- `GET /api/v2/dashboard` 已返回 `reviewQueue`，首页“今日产出”优先展示待审核脚本队列，不再只展示最新生成批次。
- V2 首页“今日产出”已明确作为生产闭环里的“审核采用”步骤，运营可直接把脚本标记为采用、待改或弃用；审核后待审核数量和 `workflowOverview` 会同步刷新。
- `GET /api/v2/dashboard` 已返回 `releaseReadiness`，把 R1-R4 大版本拆包按真实数据计算验收状态、缺口和下一步动作。
- V2 首页“大版本产品蓝图”已新增版本验收看板，R1 生产闭环、R2 输入增厚、R3 质量引擎、R4 采集保障不再只是静态规划。
- `releaseReadiness` 已新增 `maturityGaps`，明确原型验收全绿后仍未达到目标系统的缺口：自动字幕、固定对标号内容更新、质量反馈学习、第三方数据清洗。
- V2 工作台已切到今日工作日口径：`stats` 只统计当天素材、任务和脚本，`historyStats` 保留历史资产总量，历史脚本不再混入今日产出。
- 已新增正式 `workdays` 表和工作日接口：`GET /api/v2/workday/today`、`POST /api/v2/workday/reset`、`POST /api/v2/workday/close`。
- V2 首页已新增“开启新一轮今日工作流”和“结束今日工作日”；重置只清空今日选择，不删除历史脚本库。
- V2 首页已新增“今日推荐选题”，由真实热点、已结构化对标素材、商品活动和高表现模板组合生成，运营可直接从推荐进入生成或补输入。
- 今日推荐选题已支持“采用选题”，采用后会写入当前输入包并自动确认，脚本生成会读取这次采用的热点和结构。
- 已采用推荐选题会显示在 V2 生成准备度和脚本流程页生成前证据链里，运营能追踪“为什么生成这些脚本”。
- 生成脚本时已把已采用推荐选题写入 `daily_script_candidates.input_topic_json`；脚本流程页和脚本库页都会展示“采用选题”，能追踪“选题 → 脚本 → 脚本库”。

当前 V2.2 已开始落地：

- `content_structures` 本地表。
- `subtitle_jobs` 本地表。
- `POST /api/v2/content-sources/{id}/subtitle-job`
- `POST /api/v2/content-sources/bulk-subtitle-jobs`
- `POST /api/v2/content-sources/{id}/structure`
- `POST /api/v2/content-sources/{id}/subtitle-text`
- 对标内容池支持在单条素材上粘贴/更新字幕文本，成功后素材状态变为 `subtitle_done`，可继续生成结构摘要。
- 对标内容池已支持创建自动字幕任务，调用本地 `video-tools /api/subtitle`；服务不可用或失败时会记录失败原因，并保留手工字幕兜底入口。
- 对标内容池已支持批量创建字幕任务，默认最多处理 3 条有链接素材，避免运营逐条点击。
- V2 工作台里的人工素材结构摘要、可用输入和风险提示展示。

当前 V2.3 已开始落地：

- 生成脚本时读取已选择的人工结构摘要。
- 生成脚本时读取已选择的商品活动。
- `daily_script_candidates.quality_json`
- `daily_script_candidates.input_structure_json`
- `daily_script_candidates.input_product_json`
- `daily_script_candidates.input_topic_json`
- `daily_script_candidates.quality_status`
- `daily_script_candidates.review_status`
- `daily_script_candidates.rewrite_count`
- `brand_products` 本地表。
- 脚本流程页展示质量分、评分维度和“读取结构”数量。
- 独立品牌商品中心页面已落地，支持新增商品活动、统计已加入生成数量、加入/移出生成输入。
- V2 工作台支持新增商品活动、加入/移出生成输入。
- 脚本流程页支持采用、待改、弃用和自动改写。

当前 V2.5 已开始落地：

- 左侧菜单新增独立“脚本库复盘”页面。
- `daily_script_candidates` 已支持 `publish_url`、`published_at`、`performance_json`、`is_template`。
- `GET /api/v2/script-library` 可按全部、已采用、待改、弃用、已发布、模板筛选。
- `POST /api/v2/script-candidates/{id}/publish-result` 可回填发布链接、播放、点赞、评论、线索和模板标记。
- 已验证脚本 `64` 可回填为已采用、已发布、优质模板，并在脚本库页展示表现数据。
- 生成脚本时已读取优质模板，写入 `input_template_json`，脚本页和脚本库页都能追溯“参考高表现模板”。
- 生成脚本时已读取已采用推荐选题，写入 `input_topic_json`，脚本页和脚本库页都能追溯“采用选题”。
- 已验证新脚本 `65` 读取了 1 条人工结构、1 条商品活动、1 条高表现模板，质量理由包含“参考了 1 条高表现模板”。
- 脚本库页已新增“新脚本”筛选和批量审核操作条，可勾选多条脚本后批量标记采用、待改或弃用，解决候选脚本堆积时只能逐条处理的问题。

当前 V2.4 已开始落地：

- 新增独立采集任务中心页面。
- 新增 `collection_tasks` 本地表。
- `GET /api/v2/collection-tasks` 可读取最近采集任务。
- `POST /api/v2/collection-tasks/run` 可触发抖音总热榜采集和抖音类目小批量采集。
- 已验证抖音总热榜任务成功写入任务记录并刷新热榜数据。
- 已验证登录态类目采集遇到验证码时会标记为失败，并提示改用人工导入。
- 已验证登录态类目采集失败时会保存 JSON 结果和验证码截图，并在采集任务中心展示产物路径。
- 已新增小红书占位任务，明确当前不做不稳定自动采集，改走人工导入或第三方数据。
- 采集失败任务现在可以“带入人工导入”，跳转到对标内容池并预填平台、标题、来源和备注。
- 采集任务中心已新增“每日采集计划”，保存抖音热榜、抖音类目、小红书占位和第三方表格兜底 4 条计划的启用状态、建议时间、关键词、负责人和失败兜底动作。
- 每条采集计划现在可“按计划运行一次”，运行结果会进入最近采集任务；第三方表格兜底会生成一条人工导入任务并提示下一步。
- `GET /api/v2/dashboard` 已返回 `collectionStrategy`，把抖音公开热榜、抖音登录态小批量、小红书人工导入、第三方表格兜底合成“今日采集保障”判断。
- 采集任务中心已新增“今日采集保障”面板，直接告诉运营今天是否能继续生产、哪些来源要走兜底、下一步应该运行采集还是导入数据。
