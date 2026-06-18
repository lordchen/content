# ContentWork V2 技术架构与接口规格

## 1. 目标

V2 的技术目标：

- 从静态导出原型升级为可持续开发的本地应用。
- 把“今日工作流、历史资产、数据源状态、生成任务”分开建模。
- 支持自动采集失败时继续通过人工导入完成生产。
- 为字幕结构化、脚本质量评分、复盘学习预留数据结构。

短期仍保留 SQLite 和本地 Codex CLI；不引入复杂部署。

## 2. 系统边界

### 保留

- 抖音总热榜采集脚本。
- 登录态浏览器采集脚本。
- `video-tools` 字幕服务作为外部本地依赖。
- Codex CLI 作为本地生成引擎。
- SQLite 作为 V2.0-V2.3 阶段数据库。

### 重构

- 当前 `prototype_api_server.py` 逐步拆成模块化 API。
- 当前 `data.js` 静态导出只作为兼容层，不作为 V2 长期数据方式。
- 当前单页原型拆成多页面工作台。

### 不做

- 多租户。
- 公网部署。
- 自动发布。
- 大规模爬取。
- 官方 API 深度集成。

## 3. 后端模块

V2 后端建议拆成 7 个模块。

### 3.1 WorkdayService

负责每日工作批次。

职责：

- 创建今日工作日。
- 返回今日状态。
- 区分今日结果和历史资产。

核心接口：

- `GET /api/workday/today`
- `POST /api/workday/reset`

### 3.2 TrendService

负责热点数据。

职责：

- 读取抖音热榜和后续小红书热榜。
- 计算品牌相关性。
- 标记可用方式和风险。

核心接口：

- `GET /api/trends?workdayId=&platform=&status=`
- `POST /api/trends/{id}/mark`
- `POST /api/trends/{id}/select`

### 3.3 ContentSourceService

负责对标内容和人工导入。

职责：

- 单条链接导入。
- 批量链接导入。
- 手工字幕导入。
- 对标账号内容管理。

核心接口：

- `GET /api/v2/content-sources?platform=&status=`
- `POST /api/v2/content-sources`
- `GET /api/v2/content-sources/batch-template`
- `POST /api/v2/content-sources/batch`
- `POST /api/v2/content-sources/{id}/select`
- `POST /api/v2/content-sources/bulk-select`
- `POST /api/v2/content-sources/bulk-structure`
- `POST /api/v2/content-sources/{id}/subtitle-text`

当前原型已落地：

- `GET /api/v2/content-sources`
- `POST /api/v2/content-sources`
- `GET /api/v2/content-sources/batch-template`
- `POST /api/v2/content-sources/batch`
- `POST /api/v2/content-sources/{id}/select`
- `POST /api/v2/content-sources/{id}/structure`
- `GET /api/v2/dashboard` 返回 `stats.selectedContentSources` 和 `currentWorkflow.manualSourceCount`
- `GET /api/v2/dashboard` 返回 `generationReadiness`
- `GET /api/v2/dashboard` 返回 `reviewInsights`
- `GET /api/v2/dashboard` 返回真实数据驱动的 `tasks`

### 3.4 SubtitleService

负责字幕任务。

职责：

- 调用 `video-tools /api/subtitle`。
- 保存字幕原文。
- 保存失败原因。

核心接口：

- `POST /api/subtitle-jobs`
- `GET /api/subtitle-jobs/{id}`
- `POST /api/subtitle-jobs/{id}/retry`

### 3.5 StructureService

负责内容结构摘要。

职责：

- 基于字幕或元数据生成结构摘要。
- 标记可借鉴结构和风险。
- 给脚本生成提供高质量输入。

核心接口：

- `POST /api/content-structures`
- `GET /api/content-structures?sourceId=`

当前原型接口：

- `POST /api/v2/content-sources/{id}/subtitle-job`
- `POST /api/v2/content-sources/bulk-subtitle-jobs`
- `POST /api/v2/content-sources/{id}/subtitle-text`
- `POST /api/v2/content-sources/{id}/structure`
- `GET /api/v2/dashboard` 返回 `stats.contentStructures`

### 3.6 GenerationService

负责脚本生成任务。

职责：

- 固化输入快照。
- 调用 Codex CLI。
- 保存脚本。
- 评分。
- 低分重写。

核心接口：

- `POST /api/generation-jobs`
- `GET /api/generation-jobs/{id}`
- `POST /api/script-candidates/{id}/rewrite`

当前原型接口：

- `POST /api/generate`
- `POST /api/v2/script-candidates/{id}/review`
- `POST /api/v2/script-candidates/{id}/rewrite`
- 生成时读取 `content_structures`
- `POST /api/generate` 可选传入 `structureSourceIds: number[]`，只读取这些已选择且已结构化的内容池素材；不传时沿用默认最近已选结构。
- 生成时读取 `brand_products`
- 返回 `inputStructureCount`
- 返回 `requestedStructureSourceIds`
- 返回 `inputProductCount`
- 每条脚本返回 `quality` 和 `input_structures`
- 每条脚本返回 `input_products`
- 每条脚本返回 `input_templates`、`input_feedback` 和 `input_topics`，用于脚本流程页和脚本库页回看生成依据。
- 每条脚本的 `quality` 必须包含 `diagnosis`，用于解释强项、弱项、输入影响和建议改写方向。
- `POST /api/v2/script-candidates/{id}/rewrite` 必须返回 `rewritePlan`、`rewriteReason` 和 `diagnosisUsed`，让前端说明本次自动改写解决什么。
- `POST /api/v2/script-candidates/{id}/rewrite` 优先调用 Codex CLI 诊断改写，输入原脚本、质量诊断、品牌信息、结构素材、商品活动、模板和复盘信号；失败时返回本地规则兜底结果和失败原因。

### 3.7 ReviewService

负责人工审核和复盘。

职责：

- 标记采用/弃用/待改。
- 回填发布链接。
- 回填表现数据。
- 标记优质模板。

核心接口：

- `POST /api/script-candidates/{id}/review`
- `POST /api/script-candidates/{id}/publish-result`
- `GET /api/script-library`

## 4. 数据模型

### 4.1 `workdays`

每日工作批次。

字段：

- `id`
- `brand_name`
- `work_date`
- `status`
- `note`
- `created_at`
- `updated_at`

状态：

- `open`
- `closed`

### 4.2 `trend_items`

多平台热点统一表。

字段：

- `id`
- `workday_id`
- `platform`
- `title`
- `topic`
- `rank_value`
- `heat_value`
- `source_url`
- `raw_payload_json`
- `brand_relevance_score`
- `usage_status`
- `risk_level`
- `reason`
- `fetched_at`
- `created_at`

`usage_status`：

- `candidate`
- `selected`
- `watch`
- `irrelevant`
- `blocked`

### 4.3 `content_sources`

统一素材表，承接视频、笔记、链接和人工内容。

字段：

- `id`
- `workday_id`
- `platform`
- `source_type`
- `title`
- `url`
- `account_name`
- `selected`
- `benchmark_update_task_id`
- `raw_text`
- `note`
- `import_method`
- `status`
- `created_at`
- `updated_at`

`source_type`：

- `benchmark_video`
- `hot_video`
- `manual_note`
- `third_party_row`

`import_method`：

- `browser_capture`
- `manual_url`
- `batch_url`
- `subtitle_text`
- `csv_import`

`status`：

- `imported`
- `subtitle_pending`
- `subtitle_done`
- `structure_done`
- `failed`

说明：

- `selected` 是布尔字段，表示是否加入当前生成工作流。
- `benchmark_update_task_id` 可为空；从固定对标号今日更新任务导入时写入，用于把素材和具体账号任务绑定。
- `status` 只表示素材处理状态，不表示是否被运营选中。
- 关联素材导入后，对应 `benchmark_update_tasks.status` 自动进入 `in_progress`；结构化成功后自动进入 `done`。
- `dataSourceMatrix` 把固定对标号更新作为 `C2 固定对标账号池` 数据源层读取；如果今日还有账号未补近期内容，采集任务流必须提示去对标内容池补 1-3 条视频/笔记。
- `collectionGuaranteeHub.switchRules` 包含 `C2 固定对标账号池 -> C 人工链接/字幕 或 D 第三方表格` 的切换规则，不能把“账号名单存在”当作“对标内容已更新”。
- `collectionDailyReview` 是 dashboard 的只读日终复盘对象，读取采集任务、数据源矩阵、对标账号更新、结构摘要、脚本审核和发布回填。
- `collectionDailyReview.checkpoints[]` 包含公开热榜主干、失败来源兜底、固定对标账号更新、素材结构摘要、脚本审核采用、发布表现回填。
- `collectionDailyReview.nextDayPriorities[]` 用于下一工作日提醒；它只记录未闭环动作，不自动修改任何业务状态。
- `workdayOpeningReminder` 从 `collectionDailyReview.nextDayPriorities` 生成开工提醒，包含 `priorityCount`、`blockerCount`、`priorities[]`、`nextAction` 和 `nextHref`。
- 首页待办可以把 `workdayOpeningReminder` 注入第一条任务，但不能创建模拟任务或改变原始复盘状态。
- `operation_handoffs` 保存运营交接快照，payload 内包含当时的 `workdayOpeningReminder`、`collectionDailyReview` 和 `nextDayPriorities`。
- `GET /api/v2/operation-handoffs` 返回最近交接记录；`POST /api/v2/operation-handoffs` 从当前 dashboard 状态生成一条交接快照。
- 本地交接记录是飞书通知/归档的前置层；保存交接不代表复盘项已完成。

### 4.4 `subtitle_jobs`

字幕任务。

### 4.4.1 `collection_tasks`

采集任务表，记录自动采集、登录态采集和替代方案任务结果。

字段：

- `id`
- `brand_name`
- `task_type`
- `source_platform`
- `strategy`
- `status`
- `command`
- `output_json`
- `error`
- `started_at`
- `finished_at`
- `created_at`

`task_type`：

- `douyin_hot`
- `douyin_category`
- `xhs_placeholder`

`strategy`：

- `stable_hot_api`
- `login_state_browser`
- `manual_import`
- `third_party_import`

`status`：

- `running`
- `success`
- `failed`

### 4.4.2 `collection_schedules`

每日采集计划表。它不是后台自动执行器，而是先把运营节奏、失败兜底和后续定时器配置固定下来。

字段：

- `id`
- `brand_name`
- `task_type`
- `source_platform`
- `strategy`
- `schedule_time`
- `queries`
- `enabled`
- `owner`
- `fallback_action`
- `note`
- `created_at`
- `updated_at`

默认计划：

- 抖音总热榜：稳定公开热榜。
- 抖音类目小批量：登录态浏览器，每次最多 3 个词。
- 小红书占位：不做不稳定自动采集，走人工/第三方导入。
- 第三方表格兜底：灰豚、蝉妈妈、飞瓜、新榜或飞书表格。

字段：

- `id`
- `source_id`
- `engine`
- `status`
- `text`
- `segments_json`
- `error`
- `started_at`
- `finished_at`
- `created_at`

`status`：

- `pending`
- `running`
- `success`
- `failed`

### 4.5 `content_structures`

结构摘要。

目标字段：

- `id`
- `source_id`
- `structure_type`
- `hook_summary`
- `emotion_points_json`
- `shot_rhythm_json`
- `cta_pattern`
- `usable_parts_json`
- `risk_notes_json`
- `summary_json`
- `quality`
- `created_at`

当前原型字段：

- `id`
- `source_id`
- `brand_name`
- `structure_json`
- `status`
- `error`
- `created_at`
- `updated_at`

`quality`：

- `metadata_only`
- `subtitle_based`
- `manual_verified`

### 4.6 `brand_products`

品牌商品和活动。

字段：

- `id`
- `brand_name`
- `product_name`
- `product_group`
- `selling_points_json`
- `activity_rules`
- `price_note`
- `store_scope`
- `valid_from`
- `valid_to`
- `status`
- `selected`
- `created_at`
- `updated_at`

当前原型接口：

- `GET /api/v2/brand-products`
- `POST /api/v2/brand-products`
- `POST /api/v2/brand-products/{id}/select`

当前原型页面：

- `prototype/brand-center.html`
- 入口位于左侧菜单 `03 品牌商品`，在对标内容池之后、脚本流程之前。
- 页面包含新增商品活动、当前商品活动统计、商品活动列表、加入/移出生成输入。
- V2 首页保留快捷添加，但正式商品活动维护入口是品牌商品中心。

### 4.7 `generation_jobs`

生成任务。

字段：

- `id`
- `workday_id`
- `brand_name`
- `target_count`
- `input_snapshot_json`
- `status`
- `generator`
- `error`
- `created_at`
- `finished_at`

`status`：

- `draft`
- `confirmed`
- `analyzing`
- `generating`
- `scored`
- `completed`
- `failed`

### 4.8 `script_candidates`

脚本候选。

字段：

- `id`
- `generation_job_id`
- `workday_id`
- `brand_name`
- `title`
- `hook`
- `shots_json`
- `cta`
- `source_trend_id`
- `source_structure_id`
- `source_product_id`
- `score_json`
- `quality_status`
- `risk_notes`
- `review_status`
- `created_at`
- `updated_at`

`quality_status`：

- `unscored`
- `passed`
- `needs_rewrite`
- `blocked`

当前原型字段补充：

- `daily_script_candidates.quality_json`
- `daily_script_candidates.input_structure_json`
- `daily_script_candidates.input_product_json`
- `daily_script_candidates.input_template_json`
- `daily_script_candidates.input_topic_json`
- `daily_script_candidates.quality_status`
- `daily_script_candidates.review_status`
- `daily_script_candidates.review_note`
- `daily_script_candidates.rewrite_count`
- `daily_script_candidates.parent_script_id`

`daily_script_candidates.quality_json`：

- `overall`：总分。
- `scores.shootable`：可拍性。
- `scores.hook`：前 3 秒开头。
- `scores.brandFit`：品牌和类目贴合。
- `scores.conversion`：CTA、权益和到店动作。
- `scores.compliance`：价格、库存、权益等合规稳健度。
- `reasons[]`：评分理由。
- `riskHits[]`：命中的风险词或风险口径。
- `diagnosis.summary`：运营可读的质量判断摘要。
- `diagnosis.strongDimensions[]`：当前脚本可保留的强项。
- `diagnosis.weakDimensions[]`：待改维度，元素包含 `dimension`、`reason`、`action`。
- `diagnosis.inputImpact[]`：结构素材、商品活动、模板对质量的影响。
- `diagnosis.rewriteFocus`：自动改写优先处理的方向。
- `diagnosis.rewritePrompt`：给改写和人工复核使用的具体改写建议。
- `rewritePlan`：自动改写后写回的改写计划，包含 `focus`、`prompt`、`fixes[]`、`source`。
- `rewriteDiff`：改写前后差异，包含 `summary`、`changedSegments[]`、`removedRiskWords[]`、`oldHook`、`newHook`。
- `rewriteGenerator`：改写执行方式，包含 `name`、`usedFallback`、`error`，用于区分 `codex_rewrite_v1` 和本地兜底。

`review_status`：

- `new`
- `adopted`
- `rejected`
- `needs_edit`
- `published`

### 4.9 `script_reviews`

人工复盘。

字段：

- `id`
- `script_id`
- `review_status`
- `review_note`
- `publish_url`
- `performance_json`
- `is_template`
- `created_at`

## 5. 关键页面数据接口

### 5.1 今日工作台

`GET /api/v2/dashboard`

返回：

- 今日 workday，当前过渡阶段用 `workday.scope = today` 标识今日口径。
- 数据源状态。
- 待处理任务。
- 今日候选。
- 今日生成结果。
- 历史资产摘要。

当前原型返回：

- `workday.mode = daily_workday`
- `workday.scope = today`
- `workday.id`
- `workday.status`
- `workday.note`
- `stats`：今日素材、今日结构、今日脚本、今日采集任务。
- `historyStats`：历史素材、历史脚本、历史任务等资产总量。
- `workflowOverview`：首页生产闭环，包含采集保障、选择选题、确认输入、生成脚本、审核采用、发布复盘 6 个步骤。
- `productVisionMap`：目标系统地图，说明当前成熟度、最终目标、下一步动作、R1-R4 阶段、角色体验、数据兜底策略和成熟度缺口。
- `targetSystemPlan`：目标系统蓝图，聚合最终目标、4 个能力包、运营一天的体验闭环、四层数据采集替代方案、R1-R4 拆包和产品原则。
- `developmentBoard`：下一大版本开发看板，基于 `productVisionMap`、`releaseReadiness`、`workflowOverview` 和 `collectionFallbackDesk` 生成当前阶段、下一版本、R1-R4 卡片、P0/P1 缺口和入口。
- `developmentBoard.implementationPlan`：下一大版本实施计划，包含当前优先任务包、P0/P1 任务包、负责人、验收门槛、子任务入口和大版本红线。
- `releaseReadiness`：R1-R4 大版本验收看板，基于真实数据返回每个版本的完成项、缺口、百分比和下一步。
- `releaseReadiness.maturityGaps`：目标系统下一档成熟度缺口，用来区分“原型可验收”和“最终系统完成”。
- `latestScripts`：只返回当天最近生成脚本；当天无生成时返回空数组，不用历史脚本填充。
- `reviewQueue`：今日待审核脚本队列，首页“今日产出”优先读取它，让运营直接完成采用、待改或弃用。
- `reviewInsights`：仍基于历史已发布脚本和模板，用于生成质量学习。
- `reviewInsights.learningSignals.noteLearning`：审核原因学习，包含原因覆盖率、缺原因数量、原因主题分布和原因级复用/避坑指令。
- `singleMaterialLoop`：单条真实素材闭环追踪，只选择真实运营素材，排除测试、验证、示例和 `example.com` 链接；步骤为入库、字幕/正文、加入生成、结构摘要、候选脚本。
- `singleMaterialLoop.source.linkedScript`：候选脚本关联证据，后端通过扫描 `daily_script_candidates.input_structure_json[].sourceId` 是否等于该素材 id 判断；只有关联到候选脚本，第 5 步才算完成。
- `singleMaterialLoop.acceptance`：首条真实素材跑通标准，包含 `minimumEvidence[]`、`fallbackPaths[]` 和 `blockedRules[]`，首页据此展示真实链接、手工字幕、第三方表格三条替代路径。
- `firstBenchmarkMaterialPlan`：首条真实账号素材跑通计划，读取今日 `benchmark_update_tasks.items[].generationReadiness` 和 `singleMaterialLoop.acceptance`，指定一个固定对标账号，并把“补近期内容、补字幕/正文、加入生成、结构摘要、生成脚本”五步转成可执行状态。
- `firstBenchmarkMaterialPlan.operatorGuide`：P0-1 运营操作向导，把目标账号当前卡点转成“今天先补哪条内容、必填字段、执行顺序、完成定义”。
- `firstBenchmarkMaterialPlan.operatorGuide.requiredFields[]`：导入真实对标内容时必须填写或补充的字段要求，至少包含标题、链接、账号、字幕/正文、备注。
- `firstBenchmarkMaterialPlan.operatorGuide.runOrder[]`：运营按顺序执行的五步入口：导入真实素材、补字幕/正文、加入生成工作流、生成结构摘要、生成候选脚本。
- `firstBenchmarkMaterialPlan.operatorGuide.doneDefinition[]`：P0-1 不能只看页面按钮是否点击，必须满足真实素材入库、文本、加入生成、结构摘要和脚本输入证据。
- V2 首页必须展示 P0-1 端到端验收看板，把 `singleMaterialLoop.steps` 和 `firstBenchmarkMaterialPlan.steps/counts` 合并成“导入、文本、加入、结构、脚本读取”五步状态，不再让运营在两个模块之间拼判断。
- P0-1 端到端验收看板只做展示聚合，不新增独立状态；如果账号计划存在，优先使用 `firstBenchmarkMaterialPlan.steps`，否则使用 `singleMaterialLoop.steps`。
- P0-1 端到端验收看板的脚本读取证据必须来自 `singleMaterialLoop.source.linkedScript` 或账号计划第 5 步状态，不允许用历史脚本数量替代。
- 对标内容池固定账号任务卡必须展示 P0-1 当前下一步，不让运营在所有按钮里自行判断；下一步卡按真实计数切换主动作：导入真实素材、处理字幕/正文、加入生成工作流、生成结构摘要、生成候选脚本。
- 对标任务导入成功后，结果面板必须展示 P0-1 接力区，并提供“回到该账号任务卡”的主按钮；导入不是闭环终点，运营必须回到同一卡片继续处理字幕、加入生成和结构摘要。
- 对标任务导入成功后不得清空隐藏的 `benchmarkUpdateTaskId`，避免运营继续补同一账号时丢失任务归因。
- 对标内容池的批量补账号模板不得预置 `example.com` 或 `replace-video` 占位链接；只能填入空白字段和账号/平台归因，预检继续阻塞空白行。
- 脚本流程页必须在生成前检查区展示 P0-1 真实输入闸门；当 `firstBenchmarkMaterialPlan.level != ready` 时，要明确提示首条真实账号素材未跑通，并提供跳回内容池的按钮。
- 生成按钮仍以 `generationReadiness.ready` 为最终禁用条件，但 P0-1 闸门必须解释真实素材缺口，不能只显示泛化的“关键输入缺失”。
- `singleMaterialLoop.acceptance.fallbackPaths[].href`：必须携带 `importPath`，内容池按 `real_link`、`manual_subtitle`、`third_party_table` 展示不同来源待办说明、当前入口、验收重点和步骤。
- `importPath` 路径说明只能作为 UI 提示，不能预填进 `rawText`；预检和正式导入必须把“路径说明不是素材正文”作为阻塞项，防止说明文字被导入为真实素材。
- 内容池导入必须把重复链接作为阻塞项：`内容池已存在该链接` 不能只做提示，单条和批量正式导入都不能写入重复 URL。
- 批量导入必须在写库前做整批预校验；`表内重复链接` 属于阻塞项，存在阻塞行时整批不写入，并返回 `preflightBlocked = true` 和每行 `notWritten` 证据。
- 批量预检必须暴露整批阻塞状态：当存在任一阻塞行时，返回 `preflightBlocked = true`、`batchImportable = false`、`blockedRowCount` 和 `batchAction`；`importableCount` 表示正式导入会写入的数量，阻塞时必须为 `0`，行级可通过数量只能放在 `rowImportableCount`。
- 批量导入按钮必须依赖服务端预检结果：本地粗预检、服务端预检中、服务端预检失败或 `preflightBlocked = true` 时都不能提交正式导入；只有 `serverChecked = true` 且无整批阻塞时才允许点击。
- 内容池批量导入结果区必须展示 `preflightBlocked`：标题显示整批暂停和 0 条写入，每个 `notWritten` 行显示未写入原因。

`GET /api/v2/workday/today`

返回或自动创建当天工作日。

`POST /api/v2/workday/reset`

开启新一轮今日工作流。当前原型行为：

- 今日工作日状态改为 `open`。
- 清空热点/对标选择。
- 清空今日导入素材的 selected 状态。
- 清空已选商品活动。
- 不删除历史脚本、历史素材、历史表现数据。

`POST /api/v2/workday/close`

结束今日工作日。当前原型行为：

- 今日工作日状态改为 `closed`。
- 保留所有历史资产和今日产出。

### 5.2 热点池

`GET /api/v2/trends`

返回：

- 多平台热点。
- 品牌相关性。
- 使用状态。
- 风险标签。

当前原型返回：

- `run`：最近热榜批次。
- `items[]`：来自真实 `hot_search_items` 的热榜项。
- `items[].usageStatus`：`candidate`、`selected`、`watch`、`irrelevant`、`blocked`。
- `items[].riskLevel`：`low`、`medium`、`high`。
- `items[].selected`：是否已加入今日候选。
- `stats`：当前筛选列表的状态统计。

`POST /api/v2/trends/{id}/mark`

输入：

- `usageStatus`
- `riskLevel`：可选。
- `note`：可选。

行为：

- 标记为 `selected` 时写入 `operator_video_selections`，脚本流程可读取。
- 标记为 `watch`、`irrelevant`、`blocked` 时从今日热点候选移除。
- 标记结果写入 `trend_marks`，不修改原始热榜数据。

### 5.3 对标内容池

页面：

- `prototype/content-pool.html`
- 入口位于左侧菜单 `02 对标内容池`，在热点池之后、脚本流程之前。
- 页面包含固定对标账号池管理、固定账号今日更新任务、单条导入、批量导入、内容池列表、手工补录字幕、批量加入生成工作流、批量生成结构摘要。
- V2 首页保留快捷导入，但正式素材处理入口是对标内容池页面。

`GET /api/v2/benchmark-accounts`

用途：

- 读取当前品牌的固定对标账号池。
- 账号池只保存长期跟踪对象，不等同于今天可用素材；每天仍必须补近期内容、字幕/正文和结构摘要。

返回：

- `items[]`：账号 `id`、`platform`、`accountName`、`accountHandle`、`accountUrl`、`category`、`whyTrack`、`patterns[]`。
- `summary`：账号池数量和用途说明。
- `nextAction`：新增账号后生成今日任务，再按账号补近期内容。

`POST /api/v2/benchmark-accounts`

输入：

- `platform`
- `accountName`
- `accountHandle`
- `accountUrl`
- `category`
- `whyTrack`
- `patterns`

规则：

- 同品牌、同平台、同账号名保存时更新，不重复创建。
- 保存成功后必须调用今日任务生成逻辑，确保新账号出现在 `benchmark_update_tasks`。
- `whyTrack` 必填，防止账号池退化成无判断依据的名字列表。

`GET /api/v2/benchmark-update-tasks`

用途：

- 读取固定对标账号池生成的当天更新任务。
- 判断每个账号今天是否已经补近期内容、是否有字幕/正文、是否加入生成、是否结构化、是否可进入脚本生成。

返回：

- `items[].qualityCounts`：账号今日素材数、有文本数、已加入生成数、已结构化数、待补字幕数。
- `items[].sourceQueue[]`：该账号今日素材队列，每条包含素材状态、下一步动作和页面锚点。
- `items[].generationReadiness`：账号级生成输入就绪判断。

`generationReadiness` 规则：

- `ready = true` 只在至少 1 条素材同时满足有字幕/正文、已加入生成工作流、已生成结构摘要时成立。
- `level` 可为 `ready`、`missing_sources`、`needs_subtitle`、`needs_selection`、`needs_structure`、`partial`。
- `blockers[]` 必须说明关键缺口，不能只显示“待更新”。
- 前端必须根据 `generationReadiness.ready` 控制“去生成脚本”按钮，未就绪时禁用。

`GET /api/v2/content-sources`

返回：

- 导入素材。
- 字幕任务状态。
- 结构摘要状态。
- `subtitleReadiness`：字幕接入执行看板，包含：
  - `counts`：内容池总数、有链接、有字幕/正文、可结构化、需手工字幕、已结构化等统计。
  - `service`：本地 `video-tools` 健康状态和兜底建议。
  - `jobTrace`：字幕任务追踪摘要，包含任务数、成功数、失败数、运行中数、最近失败原因、失败素材列表和手工兜底动作。
  - `queue[]`：按优先级排序的素材处理队列，每条给出 `statusLabel`、`actionType`、`reason`、`completion` 和页面锚点。
- `thirdPartyReadiness`：第三方数据清洗看板，包含：
  - `counts`：第三方/表格素材总数、有链接、有正文、已结构化、待结构化、支持字段数、风险规则数。
  - `supportedVendors`：当前适配的灰豚、蝉妈妈、飞瓜、新榜、飞书表格等来源提示。
- `fieldGroups`：必需字段、质量字段、风险检查字段和对应清洗规则。
  - `queue[]`：第三方素材下一步处理队列，优先提示待结构化素材。

`GET /api/v2/content-sources/batch-template`

用途：

- 给运营复制第三方/人工表格字段模板。
- 给内容池和 V2 首页统一展示字段别名、适配来源、平台枚举、风险词和导入规则。
- 只返回模板示例和清洗规则，不写入数据库。

返回：

- `version`：模板版本。
- `recommendedHeader`：推荐 TSV 表头，例如 `标题	链接	账号	平台	字幕	备注`。
- `templateText`：可复制到飞书表格的完整示例文本，示例行必须在正式导入前替换。
- `acceptedPlatforms[]`：抖音、小红书、第三方、手工素材。
- `vendors[]`：灰豚、蝉妈妈、飞瓜、新榜、飞书表格。
- `fieldGroups[]`：最低可入库字段、质量字段、可选字段及别名。
- `rules[]`：预检不写库、正式导入上限、失败行返回方式、兜底入口边界。
- `riskTerms[]`：服务端导入预检使用的风险词。

`POST /api/v2/content-sources/preview`

用途：

- 单条导入前预检，不写数据库。
- 使用后端同一套真实素材规则提前判断这条素材是否能作为运营素材入库。
- 给内容池页和 V2 首页快捷导入展示导入状态、检查项和下一步动作。

输入：

- `platform`
- `sourceType`
- `title`
- `url`
- `accountName`
- `rawText`
- `note`

返回：

- `importable`：是否允许作为真实运营素材进入正式导入。
- `status` / `statusLabel`：`ready` 或 `blocked`，用于前端显示“可导入真实素材 / 暂不能导入”。
- `titleReady`、`hasUrl`、`hasText`：前端展示字段完整性。
- `warnings`：所有检查项。
- `blockingWarnings`：会阻止正式导入的检查项，例如缺少链接或正文、链接格式不完整、非运营素材。
- `nextAction`：运营下一步动作。
- `rule`：说明预检不写库，正式导入仍会使用同一套拦截规则。

`POST /api/v2/content-sources/batch`

输入：

- `platform`：默认平台，支持 `douyin`、`xhs`、`manual`、`third_party`。
- `accountName`：默认账号/来源。
- `batchText`：逐行文本、CSV 或 TSV 表格粘贴内容。

解析规则：

- 无表头时按“一行一条素材”解析，兼容 `标题 https://video-url`。
- 有 CSV/TSV 表头时按字段别名映射，支持 `标题/title/视频标题/笔记标题`、`链接/url/link`、`账号/account/作者/博主`、`平台/platform`、`字幕/rawText/content/正文`、`备注/note/推荐理由/热度/互动`。
- 行内平台可写 `抖音`、`小红书`、`第三方`，会归一化为系统枚举。

返回：

- `total`
- `success`
- `failed`
- `format`
- `results[]`：每行 `line`、`ok`、`input`、成功 `item` 或失败 `error`。
- 如果整批预校验发现阻塞行，返回 `preflightBlocked = true`、`success = 0`，所有 `results[]` 都必须带 `notWritten = true`，不允许部分写入。

`POST /api/v2/content-sources/{id}/subtitle-job`

用途：

- 对单条内容池素材创建自动字幕任务。
- 调用本地 `video-tools /api/subtitle`。
- 成功时把字幕文本写回 `content_sources.raw_text`，`import_method = auto_subtitle`，`status = subtitle_done`。
- 失败时写入 `subtitle_jobs.status = failed`、`error` 和 `fallback_action`，页面继续提供手工字幕兜底。

输入：

- `engine`：可选，默认读取 `SUBTITLE_ENGINE`，当前默认 `jianying`。

返回：

- `job`：字幕任务状态、错误、字幕长度和分段数量。
- `item`：更新后的内容池素材。

`POST /api/v2/content-sources/bulk-subtitle-jobs`

用途：

- 批量为内容池素材创建自动字幕任务。
- 默认处理最近有链接且没有成功字幕任务的素材，最多 3 条。
- 每条素材独立返回成功或失败，不因为单条失败中断整体。

输入：

- `mode`：`recent_with_url_without_success`、`selected_with_url_without_success`、`ids` 或 `benchmark_task`。
- `limit`：默认 3，最大 10。
- `ids`：当 `mode = ids` 时使用。
- `benchmarkUpdateTaskId`：`mode=benchmark_task` 时使用，只处理该对标账号今日任务下有链接且没有成功字幕任务的素材。

返回：

- `total`
- `success`
- `failed`
- `results[]`：每条返回 `job`、`item` 或 `error`。

`POST /api/v2/content-sources/{id}/subtitle-text`

用途：

- 自动字幕服务未接入或失败时，运营可对单条内容池素材手工补录字幕、笔记正文或旧字幕项目导出的文本。
- 保存后 `content_sources.raw_text` 写入字幕文本，`import_method = manual_subtitle_patch`，`status = subtitle_done`。
- 后续 `POST /api/v2/content-sources/{id}/structure` 会读取该字幕文本生成结构摘要。
- 页面保存成功后必须展示单条下一步动作：生成结构摘要、加入生成工作流、查看素材；如果该素材不计入真实闭环，只允许查看并标记为验证流程。

输入：

- `rawText` 或 `subtitleText`：必填，字幕文本。
- `note`：可选，字幕来源说明。

返回：

- 更新后的 `item`。

`POST /api/v2/content-sources/bulk-select`

用途：

- 把最近导入但尚未加入的素材批量加入生成工作流。

输入：

- `mode`：`unselected_recent`、`recent`、`ids` 或 `benchmark_task`。
- `limit`：默认 `10`，最大 `50`。
- `ids`：`mode=ids` 时使用。
- `benchmarkUpdateTaskId`：`mode=benchmark_task` 时使用，只处理该对标账号今日任务导入的素材。

返回：

- `total`
- `success`
- `failed`
- `results[]`

`POST /api/v2/content-sources/bulk-structure`

用途：

- 为已加入生成工作流且尚未结构化的素材批量生成结构摘要。

输入：

- `mode`：`selected_without_structure`、`recent_without_structure`、`ids` 或 `benchmark_task`。
- `limit`：默认 `3`，最大 `5`，避免 Codex CLI 长时间阻塞。
- `ids`：`mode=ids` 时使用。
- `benchmarkUpdateTaskId`：`mode=benchmark_task` 时使用，只结构化该对标账号今日任务导入的素材。

返回：

- `total`
- `success`
- `failed`
- `results[]`：每条返回成功的 `source` 和 `structure`，失败返回 `title` 和 `error`。

### 5.4 生成工作流

`POST /api/v2/generation-jobs`

输入：

- `workdayId`
- `brandName`
- `trendIds`
- `sourceIds`
- `productIds`
- `templateIds`
- `targetCount`

返回：

- `generationJobId`
- `status`
- `scripts`
- `warnings`
- `inputTemplateCount`

当前原型兼容入口：

- V2 工作台直接调用 `POST /api/generate`。
- 脚本流程页读取 `GET /api/v2/dashboard` 的 `generationReadiness`，在生成按钮上方展示生成前检查和输入证据链。
- 输入 `target`，范围 `1-5`。
- 输入 `structureSourceIds`，可选；脚本流程页用它表达“本次结构输入包”。
- `selectedContentSources[]` 中的素材可带 `benchmarkTask` 摘要，用于按固定对标号今日更新任务分组展示和批量勾选结构输入。
- `benchmarkUpdateTasks.items[].generationReadiness` 必须在脚本流程页展示，运营能看到固定账号任务是否可进入生成、缺哪一步，以及回内容池处理入口。
- 脚本流程页固定账号任务卡必须展示本次输入包状态：该账号有多少结构素材可勾选、当前勾选了多少；可用时提供“勾选该账号结构 / 取消该账号结构”，并复用 `structureSourceIds`，不另建一套输入状态。
- 返回 `scripts`、`generator`、`inputStructureCount`、`inputProductCount`、`inputTemplateCount`。
- 返回 `inputTopicCount`；每条脚本返回 `inputTopics`，用于展示本次采用的推荐选题快照。
- 脚本流程页和脚本库页都必须能展开“查看生成依据”，展示结构素材、商品活动、高表现模板、复盘信号和采用选题。
- 生成结果写入 `daily_script_candidates`，脚本库通过 `GET /api/v2/script-library` 读取。
- 生成返回的每条脚本包含 `id`，V2 页面可直接调用 `POST /api/v2/script-candidates/{id}/review` 完成采用、待改、弃用。
- `POST /api/v2/script-candidates/{id}/review` 输入 `reviewStatus` 和可选 `reviewNote`；`reviewNote` 为空时后端会写入默认原因，避免复盘学习只有状态、没有文本信号。
- V2 页面可直接调用 `POST /api/v2/script-candidates/{id}/publish-result` 回填发布链接、播放、点赞、线索和模板标记。

### 5.4.1 生成准备度

`GET /api/v2/dashboard` 返回 `generationReadiness`。

用途：

- 在 V2 工作台判断“现在能不能去生成脚本”。
- 在脚本流程页展示生成前检查，说明本次会读取哪些真实输入。
- 将脚本生成依赖的输入统一展示给运营，不让运营猜按钮关系。
- 把已选结构素材按 `benchmarkTask.id` 分组，让运营知道某个对标账号今日采集/结构化结果如何进入脚本生成。
- 同步展示固定对标账号任务级 `generationReadiness`；未就绪账号不能被当作结构输入，只能作为回内容池补数据的待办。
- 当某个账号任务已有可读取结构素材时，脚本流程页可一键把该账号结构加入或移出本次 `structureSourceIds` 输入包；按钮只改变本次生成输入包，不改变内容池素材本身。

判断项：

- `confirmed_materials`：已确认热点/对标，满足任一即可。
- `structured_sources`：已加入生成工作流且有结构摘要的人工/第三方素材。
- `brand_products`：已加入生成输入的商品活动。
- `templates`：优质模板，可选但推荐。

返回字段：

- `ready`
- `level`
- `summary`
- `checks[]`
- `nextAction`
- `generateUrl`

### 5.4.2 复盘洞察

`GET /api/v2/dashboard` 返回 `reviewInsights`。

用途：

- 将已发布表现、优质模板和下一轮生成建议放回今日工作台。
- 让发布表现不只是归档，而是成为下一轮生成前的输入判断。

返回字段：

- `publishedCount`
- `templateCount`
- `totals.views`
- `totals.likes`
- `totals.comments`
- `totals.leads`
- `bestScripts[]`
- `templates[]`
- `nextActions[]`

### 5.4.2.1 质量学习控制面板

`GET /api/v2/dashboard` 返回 `qualityLearningPlan`。

用途：

- 把复盘洞察从“只展示结果”改成“运营下一步控制台”。
- 明确当前历史脚本是否已经足够反哺下一轮生成。
- 告诉运营缺的是审核、发布表现、模板沉淀还是审核原因。
- 解释下一轮生成会读取哪些历史学习输入，并保留追溯字段。

返回字段：

- `version`
- `level`：`ready`、`partial`、`needs_review`、`needs_publish`、`needs_templates`、`empty`
- `summary`
- `nextAction`
- `nextHref`
- `counts.total`
- `counts.new`
- `counts.adopted`
- `counts.needsEdit`
- `counts.rejected`
- `counts.published`
- `counts.templates`
- `counts.reuseSignals`
- `counts.avoidSignals`
- `generationImpact.ready`
- `generationImpact.summary`
- `generationImpact.inputFields[]`：当前为 `input_template_json`、`input_feedback_json`
- `reviewNoteLearning`：从 `reviewInsights.learningSignals.noteLearning` 透传，用于展示审核原因覆盖率和原因主题。
- `counts.reviewNoteCoverage`、`counts.reviewNotesWithText`、`counts.reviewNotesMissing`：分别表示审核原因覆盖率、有原因数和缺原因数。
- `actionQueue[]`：脚本库筛选或生成页跳转动作
- `reuseSignals[]`
- `avoidSignals[]`
- `rules[]`

### 5.4.3 今日动态待办

`GET /api/v2/dashboard` 返回 `tasks[]`。

生成依据：

- 采集失败任务数量。
- 已加入生成工作流但未结构化素材数量。
- 新脚本待审核数量。
- 待改脚本数量。
- 已采用但未发布脚本数量。
- 高表现模板数量。

每条任务字段：

- `priority`
- `title`
- `description`
- `count`
- `status`
- `actionLabel`
- `href`

### 5.5 脚本库

`GET /api/v2/script-library`

查询参数：

- `status`：可选，支持 `new`、`adopted`、`needs_edit`、`rejected`、`published`、`template`。
- `limit`：可选，默认 `50`，最大 `100`。

返回：

- 历史脚本。
- 采用状态。
- 发布表现。
- 是否优质模板。

当前原型返回：

- `items[]`
- `stats.total`
- `stats.adopted`
- `stats.needsEdit`
- `stats.rejected`
- `stats.published`
- `stats.templates`

当前前端能力：

- 脚本库页支持 `status=new` 筛选。
- 每条脚本卡支持勾选进入批量操作。
- 每条脚本卡必须支持审核原因输入和快捷原因；单条采用、待改、弃用时一起提交。
- 批量采用、批量待改、批量弃用复用 `POST /api/v2/script-candidates/{id}/review` 循环提交。
- 批量审核可使用默认原因，但不能写空原因。
- 批量操作必须显示已选数量；完成后刷新脚本库并清掉成功项选择。
- 部分失败时保留错误提示，不静默吞掉失败。

`POST /api/v2/script-candidates/{id}/publish-result`

输入：

- `publishUrl`
- `publishedAt`
- `performance.views`
- `performance.likes`
- `performance.comments`
- `performance.shares`
- `performance.leads`
- `isTemplate`

行为：

- 写入发布链接和表现数据。
- 有发布链接时自动把脚本审核状态更新为 `adopted`。
- `isTemplate = true` 时标记为优质模板。
- 优质模板会被后续生成读取，作为 `input_templates` 进入生成提示词。
- 新脚本入库时将参考模板快照写入 `input_template_json`。

### 5.6 采集任务

`GET /api/v2/collection-tasks`

查询参数：

- `limit`：可选，默认 `20`，最大 `100`。

返回：

- 最近采集任务。
- 任务策略。
- 成功/失败状态。
- 失败原因。
- 命令输出。
- 采集产物路径。

`POST /api/v2/collection-tasks/run`

输入：

- `taskType`：`douyin_hot`、`douyin_category` 或 `xhs_placeholder`。
- `queries`：类目采集关键词，最多 3 个，用逗号分隔。

行为：

- `douyin_hot` 调用 `scripts/fetch_douyin_hot_search.py`。
- `douyin_category` 调用 `scripts/douyin_category_capture.js`。
- `xhs_placeholder` 不调用外部采集，直接记录为人工/第三方导入占位任务。
- 任务结果写入 `collection_tasks`。
- 类目采集输出包含 `captcha_blocked` 时，任务标记为 `failed`，并提示改用人工导入。
- 类目采集会保存页面截图，任务输出的 `output.artifacts` 包含 JSON 结果和截图路径。
- 小红书占位任务输出 `output.fallbackActions`，提示人工导入链接、粘贴笔记文本或导入第三方表格。
- 采集任务中心可生成对标内容池人工导入链接，携带 `importPlatform`、`importTitle`、`importAccount`、`importNote`。

对标内容池人工导入预填参数：

- `importPlatform`
- `importTitle`
- `importAccount`
- `importNote`

`GET /api/v2/collection-schedules`

返回：

- 当前品牌的每日采集计划。
- 如果没有计划，自动初始化默认计划。

`POST /api/v2/collection-schedules/{id}`

输入：

- `enabled`：是否启用。
- `scheduleTime`：建议执行时间，格式 `HH:MM`。
- `queries`：关键词或采集范围。
- `owner`：负责人。
- `fallbackAction`：失败后的兜底动作。

行为：

- 只保存计划配置，不自动执行任务。
- 后续接后台定时器时，以 `collection_schedules` 为配置源。

`POST /api/v2/collection-schedules/{id}/run`

行为：

- 读取计划配置并运行一次。
- 抖音热榜和抖音类目计划复用 `POST /api/v2/collection-tasks/run` 的执行逻辑。
- 第三方表格兜底计划不调用外部采集，会写入一条 `third_party_import` 任务，提示运营去对标内容池批量导入。
- 暂不做后台自动定时触发。

`GET /api/v2/dashboard.collectionStrategy`

用途：

- 把采集任务日志和每日采集计划合成运营可读的“今日采集保障”。
- 不再把“爬虫全部成功”作为唯一标准，而是判断今天是否有足够数据继续生产。

返回：

- `level`：`healthy`、`usable_with_fallback`、`needs_input`。
- `summary`：今日采集保障结论。
- `nextAction`：当前最应该执行的下一步。
- `lanes`：四条保障链路。
- `lanes[].title`：抖音公开热榜、抖音登录态小批量、小红书人工导入、第三方表格兜底。
- `lanes[].status`：`ready`、`fallback`、`paused`、`waiting`。
- `lanes[].evidence`：最近任务证据或失败原因。
- `lanes[].recommendedAction`：运营下一步动作。

`GET /api/v2/dashboard.collectionGuaranteeHub`

用途：

- 把 `collectionStrategy`、`dataSourceMatrix`、`collectionActionFlow` 和 `collectionFallbackDesk` 聚合成采集任务中心顶部的总指挥入口。
- 先回答“今天按哪条数据链路继续生产”，再让运营进入具体任务卡。
- 明确自动采集失败后的切换顺序，避免继续高频尝试不稳定采集。

返回：

- `version`：当前为 `collection_guarantee_hub_v2`。
- `mode`：`production_ready`、`usable_with_manual`、`fallback_now`、`needs_input`。
- `modeLabel`：运营可读状态。
- `summary`：今日采集链路结论。
- `nextAction` / `nextHref`：当前最应该执行的动作入口。
- `counts.readySources`
- `counts.usableSources`
- `counts.fallbackSources`
- `counts.waitingSources`
- `activeStep`：来自 `collectionActionFlow.steps[]` 的当前卡点。
- `activeFallback`：来自 `collectionFallbackDesk.primary` 的当前兜底动作。
- `decisionEngine`：采集替代方案决策器，把当前真实状态翻译成“为什么切、切到哪里、如何完成”。
- `decisionEngine.version`：当前为 `collection_decision_engine_v1`。
- `decisionEngine.status`：继承当前推荐动作状态，例如 `fallback_now`、`run`、`waiting`。
- `decisionEngine.label`：运营可读推荐，例如“当前推荐：切兜底”。
- `decisionEngine.summary`：当前推荐链路说明。
- `decisionEngine.trigger`：触发推荐动作的真实证据或原因。
- `decisionEngine.switchTo`：推荐切换到的数据链路或执行台。
- `decisionEngine.action` / `decisionEngine.href`：主按钮入口。
- `decisionEngine.completion`：完成标准，必须指向真实素材导入、字幕/正文补齐或结构摘要。
- `decisionEngine.cards[]`：辅助动作卡，分别解释今日先做什么、自动失败后切到哪里、数据链路状态。
- `laneCards[]`：A/B/C/D 四层链路状态卡。
- `switchRules[]`：失败切换规则，例如公开热榜失败切人工/第三方，登录态验证码切人工/第三方。
- `switchRules[].owner`：该切换动作负责人。
- `switchRules[].sla`：从触发条件出现到完成切换的处理时限。
- `switchRules[].handoff`：切换时必须完成的交接动作。
- `switchRules[].evidence`：判断触发条件和完成状态时使用的数据证据。
- `principles[]`：采集保障原则。

`GET /api/v2/dashboard.collectionActionFlow`

用途：

- 把 `dataSourceMatrix` 和 `collectionStrategy` 翻译成运营今天可以照做的任务流。
- 不只告诉运营哪个来源失败，还要告诉运营下一步执行顺序。

返回：

- `summary`：任务流规则摘要。
- `nextAction`：当前最应该执行的动作。
- `nextHref`：当前动作入口。
- `activeKey`：当前卡点步骤。
- `steps[].key`：`hot`、`fallback`、`manual`、`structure`、`generate`。
- `steps[].status`：`done`、`ready`、`run`、`fallback`、`waiting`、`blocked`。
- `steps[].sourceLayer`：对应数据源层级。
- `steps[].reason`：为什么要执行这一步。
- `steps[].action` / `steps[].href`：可点击执行入口。
- 任务流必须由真实数据源状态生成，不能把小红书占位或验证码失败当成采集成功。

`GET /api/v2/dashboard.collectionFallbackDesk`

用途：

- 把采集失败后的替代方案集中成一个执行台。
- 让运营直接看到“当前主动作、可用兜底动作、完成标准和入口”，不用在数据源矩阵、任务流、任务日志之间来回找。

返回：

- `summary`：兜底执行规则摘要。
- `level`：`ready`、`fallback` 或 `waiting`。
- `primary`：当前最优先执行动作，包含 `title`、`status`、`evidence`、`action`、`href`、`completion`。
- `cards[]`：可执行兜底动作卡片，覆盖登录态失败转人工、人工导入、第三方表格、小红书人工导入、字幕结构化。
- `rules[]`：兜底执行约束，例如自动失败不硬跑、人工/第三方是正式入口、素材必须结构化后再生成。

`GET /api/v2/dashboard.collectionFallbackTrace`

用途：

- 把采集失败或人工/第三方兜底任务串成可追溯链路。
- 让运营能看到失败证据、JSON/截图产物、是否已经导入内容池、是否已加入生成工作流、是否已结构化。
- 匹配不到内容池素材时必须显示“等待人工导入”，不能把计划任务当作真实导入。

返回：

- `version`：当前为 `collection_fallback_trace_v1`。
- `level`：`needs_import`、`imported`、`trace_ready`、`empty`。
- `summary`
- `counts.traces`
- `counts.waitingImport`
- `counts.matchedImport`
- `counts.structured`
- `items[]`
- `items[].taskId`
- `items[].status`
- `items[].artifacts[]`：来自 `collection_tasks.output.artifacts`。
- `items[].manualImport.href`：带入对标内容池的人工导入链接。
- `items[].matchedSources[]`：匹配到的 `content_sources`。
- `items[].steps[]`：采集任务、失败证据/产物、人工/第三方导入、结构摘要四步状态。
- `rules[]`

## 6. 采集替代方案落地

### A 稳定自动源

入口：

- `scripts/fetch_douyin_hot_search.py`

V2 落地：

- 包装为采集任务。
- 写入 `trend_items`。
- 记录最近成功时间。

### B 登录态浏览器采集

入口：

- `scripts/douyin_login_init.js`
- `scripts/douyin_category_capture.js`

V2 落地：

- 只允许小批量任务。
- 失败保存截图和错误文本。
- 登录态失效时提示人工处理。

### C 人工导入

入口：

- 页面表单。
- 批量文本框。
- CSV/飞书表格导入。

V2 落地：

- 写入 `content_sources`。
- 可直接进入字幕和结构摘要任务。
- CSV/飞书表格导入优先通过 `POST /api/v2/content-sources/batch` 落库，失败行必须展示原因。
- 导入后通过 `bulk-select` 和 `bulk-structure` 进入生成工作流，不要求运营逐条处理。

### D 第三方数据

入口：

- CSV/Excel。
- 后续 API。

V2 落地：

- 先按 `third_party_row` 导入。
- 必须保留来源平台和导入时间。
- 当前已支持 CSV/TSV 表格复制粘贴，来源平台可在行内字段中保留。

## 7. 质量评分规则

每条脚本生成后计算：

- `shootability`：镜头、场景、出镜人、道具是否具体。
- `hook_strength`：前 3 秒是否有真实注意力。
- `brand_fit`：是否符合品牌语气和目标人群。
- `conversion_clarity`：CTA 是否明确。
- `risk_level`：是否涉及虚假承诺、未授权、敏感内容。

建议阈值：

- 总分 `>= 80`：通过。
- `60-79`：需要人工复核。
- `< 60`：自动重写一次。
- 风险命中高危：直接 blocked。

## 8. 迁移策略

现有表不立即删除。

映射方式：

- `hot_search_items` -> `trend_items`
- `benchmark_video_subtitles` -> `subtitle_jobs` + `content_structures`
- `prototype_generation_runs` -> `generation_jobs`
- `daily_script_candidates` -> `script_candidates`

迁移优先级：

1. 新增 V2 表。
2. 新接口优先写 V2 表。
3. 旧接口继续可用。
4. 前端逐页切到 V2 接口。
5. 稳定后停用 `data.js` 导出模式。

## 9. 开发验收

V2.0 技术验收：

- `GET /api/v2/dashboard` 能返回今日工作台数据。
- 刷新页面不会把历史脚本当作今日结果。
- 脚本库能独立读取历史脚本。
- `stats.scripts` 与 `historyStats.scripts` 能区分今日脚本和历史脚本。
- `GET /api/v2/workday/today` 能返回今日工作日。
- `POST /api/v2/workday/reset` 能重新开启今日工作流且不删除历史脚本。
- `POST /api/v2/workday/close` 能结束今日工作日。
- V2 首页能展示 `workflowOverview`，并明确告诉运营当前卡在哪一步和下一步动作。
- V2 首页能展示 `reviewQueue`，把“今日产出”作为审核采用入口；点击采用、待改或弃用后，待审核数量和 `workflowOverview` 同步刷新。
- V2 首页能展示 `productVisionMap`，明确当前只是 MVP 小版本，并用真实数据解释最终目标、当前阶段、下一步动作和数据采集替代方案。
- V2 首页能展示 `targetSystemPlan`，把产品功能、运营体验、最终目标、数据采集替代方案和大版本拆包集中到一个可扫读面板。
- V2 首页能展示 `developmentBoard`，把“下一大版本怎么做”从静态路线改成可执行看板，包含当前阶段、下一版本、P0/P1 缺口、验收进度和入口。
- V2 首页能展示 `developmentBoard.implementationPlan`，让产品和研发看到当前先做哪个任务包、为什么做、谁负责、怎么验收和点哪里继续。
- V2 首页能展示 `releaseReadiness`，把 R1-R4 从静态路线变成真实验收看板，显示进度、证据、缺口和下一步。
- V2 首页必须展示 `releaseReadiness.maturityGaps`，避免把原型验收全绿误解为目标系统完成。
- V2 首页必须展示 `firstBenchmarkMaterialPlan`，从固定对标账号任务中选出一个真实账号素材跑通对象，并显示五步状态、证据要求、替代路径和不计入规则。

V2.1 技术验收：

- 能导入视频链接。
- 能批量导入链接。
- 能手工粘贴字幕。
- 能粘贴第三方 CSV/TSV 表格并按表头别名入库。
- 导入失败必须返回具体行号和失败原因。
- 导入内容进入 `content_sources`。
- 导入内容可批量加入生成工作流。
- 已加入生成工作流的内容可批量生成结构摘要。
- Dashboard 能返回生成准备度，页面能展示缺项和下一步动作。
- V2 工作台能在准备度满足时直接调用生成接口，结果入库并可在脚本库复盘页读取。
- V2 工作台能对刚生成脚本直接审核，审核结果通过脚本库接口持久化。
- V2 工作台能对刚生成脚本直接回填发布表现，表现数据通过脚本库接口持久化并进入复盘统计。
- V2 工作台能展示复盘洞察，包含表现榜、模板榜、聚合表现和下一轮建议。
- V2 工作台今日待办必须由真实数据生成，并提供可点击处理入口。

V2.2 技术验收：

- 一条素材能创建字幕任务。
- 成功任务能保存字幕。
- 字幕能生成结构摘要。

V2.3 技术验收：

- 生成脚本读取结构摘要和商品活动。
- 生成结果有质量评分。
- 低分脚本能自动重写或明确标记。

V2.4 技术验收：

- `GET /api/v2/collection-tasks` 能读取采集任务。
- `POST /api/v2/collection-tasks/run` 能触发抖音总热榜采集。
- 登录态类目采集遇到验证码时能标记失败并显示原因。
- 小红书占位任务能写入失败状态和替代动作。
- 采集任务中心页面能展示任务状态、策略、输出和失败原因。
- 采集任务中心页面能展示验证码失败截图路径。
- 采集任务中心页面能展示 `collectionStrategy` 的今日采集保障结论和四条保障链路。
- 自动采集失败时，页面必须给出人工导入或第三方表格兜底动作，而不是只显示失败。
- 失败任务能跳转到人工导入，并预填平台、标题、来源和备注。
- `GET /api/v2/dashboard` 必须返回 `collectionActionFlow`，把状态卡翻译成可执行顺序。
- 采集任务中心必须展示 `collectionActionFlow.steps[]`，运营能知道今天先做哪一步、失败切哪条兜底、何时进入结构化和生成。
- V2 首页必须展示采集任务流摘要和关键步骤，并把当前阻塞步骤写入 `tasks[]`。
- V2 首页必须展示 `collectionGuaranteeHub` 摘要，让运营在首页先看到今天采集链路是“可生产、需补强、立即兜底还是先补数据”。

V2.5 技术验收：

- `GET /api/v2/script-library` 能独立读取历史脚本。
- `status=published` 能只返回已发布脚本。
- `status=template` 能只返回优质模板。
- `POST /api/v2/script-candidates/{id}/publish-result` 能保存发布链接和表现数据。
- 脚本库页面能展示统计、筛选、发布表现和模板标记。
- 生成接口能读取优质模板并返回 `inputTemplateCount`。
- 新生成脚本能保存 `input_template_json`，前端能展示参考模板名称。
- 生成接口能读取已采用推荐选题并返回 `inputTopicCount`。
- 新生成脚本能保存 `input_topic_json`，脚本流程页和脚本库页能展示采用选题名称。
