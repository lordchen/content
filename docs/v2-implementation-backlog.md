# ContentWork V2 开发执行清单

本文档用于把 [v2-product-development-plan.md](./v2-product-development-plan.md) 拆成可执行开发任务。

## V2.0 信息架构重构

目标：把当前单页原型拆成真正的内容工作台。

当前已开始落地：

- V2 工作台已改为“今日工作日”口径，`GET /api/v2/dashboard` 返回 `workday.scope = today`。
- 今日工作台只统计当天素材、当天结构、当天脚本和当天采集任务。
- `GET /api/v2/dashboard` 同时返回 `historyStats`，用于提示历史资产规模，但不把历史脚本混进今日产出。
- V2 首页状态卡已显示“今日脚本”和“历史脚本库”的区别。
- 今日产出为空时会提示去脚本库查看历史脚本，而不是用历史脚本填充首页。
- 已新增 `workdays` 表，记录品牌、工作日期、状态和操作备注。
- 已新增 `GET /api/v2/workday/today`、`POST /api/v2/workday/reset`、`POST /api/v2/workday/close`。
- V2 首页已新增“开启新一轮今日工作流”和“结束今日工作日”按钮。
- V2 首页已新增“今日推荐选题”模块，读取 `topicRecommendations`，把真实热点、对标结构、商品活动和高表现模板合成 5 条可执行选题。
- 今日推荐选题已支持“采用选题”，采用后写入 `operator_video_selections` 并自动生成确认包，后续脚本生成会读取这次采用的热点和结构。
- V2 首页已新增“目标系统地图”，读取 `GET /api/v2/dashboard.productVisionMap`，明确展示当前只是 MVP 小版本、最终目标、R1-R4 成熟度路线、角色体验、数据替代方案和下一步缺口。
- V2 首页已新增“目标系统蓝图”，读取 `GET /api/v2/dashboard.targetSystemPlan`，把最终目标、4 个能力包、运营一天的使用路径、四层数据替代方案、R1-R4 拆包和产品原则集中展示。
- V2 首页已新增“目标体验缺口检查”，读取 `GET /api/v2/dashboard.v2ExperienceGapBoard`，按运营、内容负责人、采集维护、品牌负责人 4 个角色判断目标体验是否可用，展示当前证据、体验缺口、负责人和下一步入口。
- V2 首页顶部模块区已从静态 6 张说明卡升级为“V2 核心模块建设看板”，读取 `GET /api/v2/dashboard.v2ModuleBoard`，按今日工作台、热点池、对标内容池、品牌商品、脚本生成工作流、脚本库复盘、采集任务中心 7 个模块展示当前状态、成熟度、真实指标、缺口和入口。
- V2 核心模块建设看板已新增 `primaryPackage`，把当前优先模块缺口拆成可验收任务包；当前优先模块是“对标内容池”，任务包包含补 1 条近期内容、补字幕/正文、加入生成工作流、生成结构摘要、生成候选脚本 5 步。
- `primaryPackage` 已补齐 P0-1 验收口径：必填字段、完成定义和不计入验收规则都会显示在 V2 首页模块任务包内，避免运营只看到步骤但不知道什么算真实跑通。
- 对标内容池导入区已同步读取 `v2ModuleBoard.primaryPackage`：从首页进入内容池后，P0-1 导入指引会显示同一套 5 步任务、必填字段、完成定义和阻塞规则，不再让运营在首页和内容池之间拼口径。
- V2 首页已新增“下一大版本开发看板”，读取 `GET /api/v2/dashboard.developmentBoard`，把当前 MVP 阶段、下一版本、R1-R4 验收进度、P0/P1 缺口和执行入口合成可操作开发顺序。
- 下一大版本开发看板已新增 `implementationPlan`，把路线图拆成 P0-1 首条真实账号素材闭环、P0-2 输入增厚、P1-1 质量学习、P1-2 采集保障四个任务包，并展示当前优先包、负责人、验收和子任务入口。
- V2 首页已新增“V2 大版本产品章程”，读取 `GET /api/v2/dashboard.v2ProductCharter`，把最终目标、当前 MVP 事实、本周开发焦点、P0/P1 开发包、数据采集替代方案、验收红线和当前不做事项放到首页第一屏。
- 产品章程明确“不把局部 MVP 当目标系统完成”：今日脚本不能用历史脚本冒充，R2 输入厚度按真实结构素材计数，测试/验证/示例和占位文本不计入真实闭环。
- V2 首页已新增“目标完成审计”，读取 `GET /api/v2/dashboard.v2ObjectiveAudit`，把用户原始目标拆成产品功能、运营体验、最终目标、采集替代方案、大版本开发、真实数据驱动 6 项逐条审计，区分已规划、部分实现、阻塞和未完成。
- 目标完成审计当前明确显示不能标记为完成：大版本规划已形成，但 P0-1 首条真实账号素材闭环和 R2 输入厚度仍被真实数据阻塞。
- V2 首页已新增“目标审计到开发排期”，读取 `GET /api/v2/dashboard.v2ObjectiveImplementationPlan`，把 6 项目标审计映射到 P0/P1 开发包、R1-R4 发布包、依赖关系、验收证据、负责人和下一动作。
- 目标实施排期当前 Sprint 绑定 `P0-1 首条真实账号素材闭环`，推进顺序明确为先锁定目标和边界，再补真实账号素材，再推进 R2 输入增厚，R2 未过前不宣称 R1 生产闭环完成。
- V2 首页已新增“当前 Sprint 执行台”，读取 `GET /api/v2/dashboard.v2CurrentSprintWorkspace`，把 P0-1 当前卡点、目标账号、验收计数、5 项验收步骤、真实字段要求、采集替代路径和补完后的接力顺序集中到首页靠前位置。
- 当前 Sprint 执行台不创建素材、不自动写库、不把空状态算通过；当前真实状态仍显示 P0-1 `0/5`、今日导入 `0`、有文本 `0`、已结构化 `0`，主动作仍是导入阿迪达斯官方旗舰店近期真实内容。
- 当前 Sprint 执行台已新增 `taskSheetPackage`：在 V2 首页直接展示 P0-1 真实素材补录任务单表头、空白行、字段解释、阻塞规则和内容池批量导入入口；空白任务单只用于分派，不会自动写库或计入验收。
- 从 V2 当前 Sprint 任务单进入内容池后，批量导入框会自动带入空白任务单并立即触发预检；当前空白行显示“整批暂停，0 行会写入”，导入按钮保持禁用，运营必须先补真实链接、字幕或结构观察。
- 内容池顶部来源任务卡已为 V2 当前 Sprint 任务单增加“重新填入空白任务单 / 复制当前任务单”动作；运营误删表格后可恢复格式，复制动作只写剪贴板，不触发入库。
- 内容池顶部来源任务卡已新增“只保留有真实内容的行”安全整理动作：当运营只补了 1 行真实链接/字幕/备注时，可移除剩余空白行再预检；纯空白任务单不会被清空，也不会触发入库。
- 内容池批量预检区已为 V2 当前 Sprint 任务单新增 P0-1 完成度诊断：显示“有效真实行 0/1”、任务单行数、缺失字段和阻塞原因；该诊断读取服务端预检 rows，不改变真实导入规则。
- P0-1 完成度诊断已补行级修正清单：空白任务单会逐行显示第 2/3/4 行缺少真实链接或字幕/正文/备注，提示运营补哪一列后重新预检；该清单仍只读预检结果，不触发入库。
- P0-1 任务单预检通过后，完成度诊断会切换为 ready 状态并展示导入后接力：正式导入、回账号任务卡、加入生成并结构化、进入脚本流程并要求候选脚本引用该素材 sourceId；该提示只在预检通过时出现，不自动导入。
- 内容池导入后接力面板已新增“写库证据”：单条、批量和手工字幕保存成功后会展示返回的 sourceId、标题、平台、账号、绑定任务和下一步状态，并明确“这一步只证明素材进入内容池；还没有生成脚本”。批量整批暂停时继续显示 0 条写入，不会误导运营。
- V2 首页“工程落地规格”已升级为 `Build Manifest`，读取 `GET /api/v2/dashboard.v2BuildManifest`，把产品章程继续落到模块边界、核心数据表、关键接口、当前 Sprint 验收测试、替代采集链路和工程红线。
- Build Manifest 当前 Sprint 绑定 P0-1 首条真实账号素材闭环；验收测试读取 `p01AcceptanceVerifier`，不是静态 checklist，仍显示真实素材、文本、加入生成、结构摘要和候选脚本引用的阻塞状态。
- V2 首页已新增“下一大版本作战区”，读取 `GET /api/v2/dashboard.v2MasterPlan`，把最终目标、当前 MVP 差距、当前优先包、四个开发包、目标运营体验、采集替代方案和大版本验收红线聚合到首页靠前位置。
- V2 首页已新增“V2 大版本验收总表”，读取 `GET /api/v2/dashboard.v2AcceptanceBoard`，按真实 `releaseReadiness` 汇总整体验收进度、阻塞版本数、R1-R4 已满足项/缺口项/当前证据和下一动作。
- V2 首页已新增“V2 大版本发布计划”，读取 `GET /api/v2/dashboard.v2ReleaseRoadmap`，把 R1-R4 从功能清单升级为可发布路线：当前按 `R2 -> R1 -> R4 -> R3` 排序，明确 R1 依赖 R2、R3 依赖 R1/R2，并展示阻塞证据、发布门槛、发布红线和执行入口。
- V2 首页已新增“下一步执行队列”，读取 `GET /api/v2/dashboard.v2ExecutionQueue`，把验收缺口按真实依赖重新排序；当前会优先提示 P0-1 首条真实账号素材，而不是让运营直接点“生成脚本”后被准备度阻塞。
- V2 首页已新增“真实数据闭环体检”，读取 `GET /api/v2/dashboard.realDataLoopAudit`，按真实数据来源、对标素材增厚、生成输入证据、脚本产出审核、复盘学习回流 5 个环节判断当前是否真的跑通，而不是只看页面模块是否存在。
- V2 首页已新增“单条真实素材闭环追踪”，读取 `GET /api/v2/dashboard.singleMaterialLoop`，优先追踪今日最接近生成输入的真实 `content_sources` 记录，展示入库、字幕/正文、加入生成、结构摘要、候选脚本 5 步；没有素材时只显示真实缺口和导入入口，不创建模拟样例。
- V2 首页“单条真实素材闭环追踪”已新增 P0-1 端到端验收看板，合并 `singleMaterialLoop` 和 `firstBenchmarkMaterialPlan`，集中展示导入、文本、加入、结构、脚本读取五步，不需要运营在多个区块之间拼状态。
- P0-1 端到端验收看板当前真实状态显示为未跑通，目标账号为“阿迪达斯官方旗舰店”，脚本证据为“未读取”，主入口仍指向该账号的真实素材导入。
- 单条真实素材追踪已新增候选脚本关联检测：后端会扫描 `daily_script_candidates.input_structure_json` 是否包含该素材 `sourceId`，只有真实素材被候选脚本读取后，第 5 步才算“已生成”。
- 单条真实素材追踪已新增 `acceptance` 验收标准，明确首条真实素材必须具备的证据、真实链接/手工字幕/第三方表格三条替代路径，以及不计入验收的占位数据规则。
- V2 首页已新增“首条真实账号素材跑通计划”，读取 `firstBenchmarkMaterialPlan`，从固定对标账号任务里选择一个账号，展示补近期内容、补字幕/正文、加入生成、结构摘要、生成脚本五步状态。
- `GET /api/v2/dashboard` 已新增 `firstBenchmarkMaterialPlan`，复用 `benchmark_update_tasks.items[].generationReadiness` 和 `singleMaterialLoop.acceptance`，不创建模拟素材；当前没有真实账号素材时明确显示 blocked 和导入入口。
- `firstBenchmarkMaterialPlan` 已新增 `operatorGuide`，把 P0-1 从状态展示推进为运营可执行向导：当前卡点、必填字段、五步执行顺序和完成定义都会返回给 V2 首页。
- V2 首页“首条真实账号素材跑通计划”已新增 P0-1 操作向导，当前卡在“补 1 条近期内容”时会明确告诉运营要补标题、真实链接或字幕正文、账号归因和结构观察，并提供导入入口。
- 对标内容池固定账号任务卡已新增 P0-1 当前下一步卡，会按真实状态切换主按钮：导入真实素材、处理字幕/正文、加入生成工作流、生成结构摘要、去生成候选脚本。
- 对标内容池导入区已新增 P0-1 首条真实素材导入向导；从 V2 执行队列或固定账号任务深链进入时，会在单条/批量导入表单上方直接说明必须填写标题、真实链接或字幕正文、账号归因和结构观察，并列出不会入库的占位数据规则。
- 对标任务单条/批量导入成功后，结果面板已新增 P0-1 接力区，主按钮会把运营带回该账号任务卡，继续看 `P0-1 NEXT STEP` 的下一步，而不是停在导入成功提示。
- 对标任务单条/批量导入成功后，P0-1 接力区已新增“加入生成并结构化”快速推进动作；该动作仍调用真实 `bulk-select` 和 `bulk-structure` 接口，不绕过后端真实素材保护，结构化失败时会提示先补字幕/正文。
- 对标任务导入后不再清空隐藏任务 ID，后续继续补同一账号时仍会绑定到同一个固定对标账号任务。
- 脚本流程页生成前检查区已新增 P0-1 真实输入闸门；当首条真实账号素材没跑通时，会明确显示目标账号、导入/文本/结构/可生成计数，并提供“导入这个账号近期内容”入口。
- 对标内容池到脚本流程已新增 P0-1 输入接力：从账号任务的“进入脚本流程”跳转会携带 `benchmarkTaskId`，脚本流程页会显示该账号任务的输入接力卡，并默认只勾选该任务下的结构素材，避免运营在多个账号结构里手动找输入。
- 生成按钮仍由 `generationReadiness.ready` 禁用，但页面现在会解释真实素材缺口，避免运营误以为只是没有点击确认素材包。
- “批量补这个账号”已改用空白任务单，不再填入 `example.com/replace-video` 占位链接；空白行仍会被预检阻塞，只有真实链接、字幕或备注才允许进入内容池。
- 对标内容池的固定账号更新任务卡已新增“P0-1 真实素材任务单”，显示真实素材字段要求、阻塞原因、排除规则，并提供“填入空白任务单 / 复制空白表头”两个动作。
- P0-1 空白任务单不再填入 `example.com/replace-video` 示例链接；空白行会被本地和服务端预检共同判定为整批暂停，只有补真实链接、字幕或备注后才允许导入。
- 首条真实素材三条替代路径已变成可执行入口：链接会携带 `importPath = real_link / manual_subtitle / third_party_table`，进入内容池后显示对应入口、验收重点和处理步骤。
- 采集任务中心已新增“首条真实对标素材补录包”：读取 `firstBenchmarkMaterialPlan` 和 `collectionFallbackSwitcher`，把当前目标账号、导入/文本/结构/生成计数、4 条采集替代路径和 5 步 P0-1 闭环集中到一个执行包。
- 替代路径说明不会再预填到字幕/正文输入框；后端预检和正式导入都会把“路径说明不是素材正文”作为阻塞项，避免运营一键导入说明文字污染真实素材池。
- 重复链接已升级为真实素材防线：预检、单条正式导入和批量正式导入都会把“内容池已存在该链接”作为阻塞项，避免同一作品重复进入内容池。
- 表内重复链接已升级为批量导入阻塞项：批量正式导入会先做整批预校验，只要存在阻塞行就暂停整批写入，避免第一条写入、第二条失败的半污染状态。
- 批量导入预检已和正式导入口径对齐：只要存在阻塞行，预检返回 `preflightBlocked = true`、`batchImportable = false`、`importableCount = 0`，并用 `rowImportableCount` 保留行级可通过数量，避免运营误以为可以部分写入。
- 批量导入按钮已接入服务端预检状态：空输入时提示先粘贴素材，本地粗预检阶段提示等待服务端预检，服务端预检阻塞或失败时按钮禁用，只有服务端预检通过后才显示“预检通过，解析并导入”。
- 内容池批量导入结果区已支持 `preflightBlocked`：会显示“整批暂停：0 条写入”，每行标记 `未写入`，避免运营误判第一行已经入库。
- 单条真实素材追踪已排除测试、验证、示例和 `example.com` 链接；被排除的素材会在首页展示数量和原因，避免把历史验证数据当成真实运营跑通证据。
- `content_sources` 接口已统一返回 `isOperationalReal`、`realMaterialStatusLabel` 和 `realMaterialReason`；V2 首页最近导入与对标内容池素材卡片都会标出“真实运营素材 / 不计入真实闭环”，避免运营把示例、验证、测试链接误判为真实数据跑通。
- 生成准备度、已选结构素材和脚本生成输入已切换为真实运营素材口径：测试/验证/示例素材可留在内容池里复盘，但不会计入“已加入生成工作流”、不会进入默认结构输入，也不会让 R2 输入增厚误判为已完成。
- 非运营素材选择保护已落地：后端会拒绝把测试/验证/示例素材加入真实生成工作流，内容池和 V2 首页会显示“不能加入真实生成”或“移出历史选中标记”，不再出现“已加入生成”的误导状态。
- 批量加入生成工作流已同步真实素材保护：批量接口会跳过非运营素材并返回 `skipped` 数量与原因，内容池和 V2 首页会提示“没有真实素材可加入 / 跳过非运营素材”，避免批量按钮绕过单条保护。
- 结构摘要也已接入真实素材保护：单条和批量结构化都会拒绝测试/验证/示例素材，批量结果会显示 `skipped` 原因，避免把非运营素材结构化后误送入脚本生成。
- 导入入口已接入真实素材预检：单条导入会拒绝测试/验证/示例素材；批量预检会把示例行标记为不可导入；批量正式导入会跳过非运营素材并返回 `skipped`，避免模板占位行再次污染内容池。
- 单条导入已新增导入前预检接口和页面面板：`POST /api/v2/content-sources/preview` 使用后端同一套真实素材规则判断是否可导入，内容池页和 V2 首页快捷导入都会显示“可导入真实素材 / 暂不能导入”、检查项和下一步，预检不写数据库。
- 对标内容池已新增“旧字幕项目结果导入”正式入口：运营可一键切到手工字幕单条导入，或填入旧字幕项目批量表格模板；导入仍走服务端预检、真实素材保护、入库、加入生成和结构化链路，不把字幕项目输出当模拟数据。
- 后端批量字段模板已新增旧字幕项目字段别名：`字幕文本 / 字幕结果 / 字幕提取结果 / 转写文本 / 转录文本 / 识别文本 / transcript_text / asr_text / ocr_text`，便于承接历史字幕提取项目导出。
- V2 首页单条真实素材追踪已新增“首条真实素材导入向导”：当今天没有真实素材时，页面会说明必须提供真实链接或可结构化文本、建议补账号/结构观察、会拒绝哪些占位数据，并直接跳到内容池单条导入入口。
- 已新增独立热点池页面 `prototype/trend-pool.html`，左侧菜单已接入“热点池”。
- 已新增 `GET /api/v2/trends` 和 `POST /api/v2/trends/{id}/mark`。
- 已新增 `trend_marks` 表，用于保存运营对热点的候选、观察、不相关和风险屏蔽判断。

### 任务

1. 新增 6 个页面入口：
   - 今日工作台
   - 热点池
   - 对标内容池
   - 品牌与商品
   - 生成工作流
   - 脚本库
2. 调整首页逻辑：
   - 页面刷新默认进入新的工作日状态。
   - 不自动展示历史脚本。
   - 历史脚本只在脚本库页展示。
3. 新增数据状态卡：
   - 最近热榜采集时间。
   - 对标内容数量。
   - 字幕任务状态。
   - 今日生成脚本数量。
4. 保留现有生成闭环：
   - 选择素材。
   - 锁定素材包。
   - 设置数量。
   - 生成脚本。
   - 当前页展示结果。

### 验收

- 刷新首页后不显示旧脚本。
- 用户能从左侧菜单进入 6 个明确页面。
- 今日工作台能展示真实数据驱动的推荐选题，不用静态占位填充。
- 今日工作台必须能说明“真实数据从采集/导入到脚本库复盘”卡在哪一步，不能只展示静态功能地图。
- 今日工作台必须能追踪至少 1 条真实素材是否完成“入库 -> 字幕/正文 -> 加入生成 -> 结构摘要 -> 候选脚本生成”，没有真实素材时明确显示缺口。
- 运营采用推荐选题后，生成准备度和脚本生成输入能同步更新。
- 当前生成页仍然能完成一次生成闭环。
- 脚本库页能查看历史脚本。

### 测试

- 打开首页，检查没有历史脚本污染。
- 打开脚本库，检查能看到数据库里的历史脚本。
- 完成一次新生成，检查当前结果只出现在本次工作流和脚本库。

### 当前验证

- `GET /api/v2/dashboard` 已返回 `workday.mode = daily_workday`、`scope = today`。
- 当前真实数据下，今日脚本 `32` 条，历史脚本 `70` 条，首页只展示今日最近产出。
- V2 首页已验证显示“今日工作台只统计当天素材、任务和脚本；历史资产进入脚本库复盘。”
- `GET /api/v2/dashboard` 已返回 `workflowOverview`，包含采集保障、选择选题、确认输入、生成脚本、审核采用、发布复盘 6 个步骤。
- 打开 `prototype/v2.html?v=workflow-overview-v1` 已验证能看到“今日生产闭环”、采集保障和审核采用；移动端无横向滚动。
- `GET /api/v2/dashboard` 已返回 `reviewQueue`，按今日待审核脚本倒序返回首页审核队列，避免首页只展示最新生成批次而看不到真实待审核量。
- 打开 `prototype/v2.html?v=review-queue-v2` 已验证“今日产出”展示待审核脚本 8 条，并明确说明这里对应“今日生产闭环”的审核采用步骤。
- `GET /api/v2/dashboard.singleMaterialLoop` 已新增候选脚本关联检测；当前真实数据下仍返回 `level = empty`、`excludedCount = 8`，不会把示例素材关联到的历史脚本误算成真实跑通。
- 已只读验证示例素材 `6`、`8` 可关联到脚本 `77`，但二者因 `示例链接` 被真实素材规则排除；打开 `prototype/v2.html?v=single-material-script-link-v1` 已验证首页显示“缺少真实素材”和 5 步缺口，无横向溢出。
- `GET /api/v2/dashboard.singleMaterialLoop.acceptance` 已返回 4 条最小验收证据、3 条替代路径和 3 条不计入验收规则；打开 `prototype/v2.html?v=single-material-acceptance-v1` 已验证桌面端和 390px 移动端无横向溢出。
- `GET /api/v2/dashboard.firstBenchmarkMaterialPlan` 已返回 `version = first_benchmark_material_plan_v1`；当前真实数据下选择“阿迪达斯官方旗舰店”，状态为 `blocked`，五步计划卡在“补 1 条近期内容”，不会把账号名或示例数据算作真实跑通。
- 打开 `prototype/v2.html?v=first-benchmark-material-plan-v1` 已验证“首条真实账号素材跑通计划”展示 5 步状态、证据要求、三条替代路径和不计入规则；桌面端和 390px 移动端均无横向溢出。
- 打开 `prototype/content-pool.html?v=real-task-sheet-v3&benchmarkTaskId=1432#benchmark-update` 已验证固定账号任务卡展示 P0-1 真实素材任务单；点击“填入空白任务单”后不会出现示例链接，预检显示“整批暂停，0 行会写入”，桌面端和 390px 移动端均无横向溢出。
- 已验证三条替代路径分别跳到内容池不同状态：真实链接路径显示 `REAL LINK PATH`，手工字幕路径显示 `MANUAL SUBTITLE PATH`，第三方表格路径显示 `THIRD PARTY TABLE PATH` 且定位到 `#batch-import`；桌面端和 390px 移动端均无横向溢出。
- 已验证 `real_link` 和 `manual_subtitle` 路径打开后 `contentRawText` 为空，只显示不要粘贴路径说明的 placeholder；`third_party_table` 路径打开后批量输入框为空。`POST /api/v2/content-sources/preview` 会拦截路径说明文本，返回 `blockingWarnings = [路径说明不是素材正文]`。
- 已验证正式导入防线：单条导入路径说明返回 `400`，批量导入路径说明返回 `success = 0 / failed = 1`，验证前后 `content_sources` 总数保持 `8`，没有写入污染素材。
- 已验证重复链接防线：已有链接再次单条导入返回 `400`，批量导入返回 `success = 0 / failed = 1`，验证前后 `content_sources` 总数保持 `8`。
- 已验证表内重复链接防线：批量预检会把重复行标记为不可导入；正式批量导入返回 `preflightBlocked = true`、`success = 0`，所有行 `notWritten = true`，验证前后 `content_sources` 总数保持 `8`。
- 已验证批量暂停返回：后端返回 `preflightBlocked = true`、批量级错误和每行 `notWritten`；前端已按这些字段渲染“整批暂停”和未写入行。
- 已验证批量预检和正式导入一致性：两行表格中第一行行级可通过、第二行 `表内重复链接` 时，预检返回 `importableCount = 0`、`rowImportableCount = 1`、`preflightBlocked = true`，正式导入返回 `success = 0` 且所有行 `notWritten = true`，`content_sources` 总数仍为 `8`。
- 已用按钮状态验证覆盖批量导入 4 种状态：空输入 `先粘贴素材`、本地预检后 `等待服务端预检`、服务端阻塞 `先修正阻塞行`、服务端通过 `预检通过，解析并导入`。
- 已在 V2 首页把脚本 `70` 标记为待改，待审核数量从 `29` 变为 `28`，`workflowOverview` 的审核证据同步刷新。
- `GET /api/v2/dashboard` 已返回 `topicRecommendations`，页面能展示推荐度、来源热点、结构、商品、模板和下一步动作。
- `POST /api/v2/topic-recommendations/adopt` 已验证能采用推荐选题并生成确认包。
- `POST /api/generate` 已验证会把已采用推荐选题写入新脚本的 `inputTopics`，并落库到 `daily_script_candidates.input_topic_json`。
- 打开脚本流程页和脚本库页已验证能展示“采用选题”，可以追溯选题如何进入脚本和脚本库。
- `GET /api/v2/dashboard` 已返回 `productVisionMap.version = product_vision_map_v1`，用于区分“目标系统完成度”和“当前原型验收度”。
- `GET /api/v2/dashboard` 已返回 `targetSystemPlan.version = target_system_plan_v1`，用于把产品功能、体验闭环、最终目标和数据采集替代方案统一成可视化工作台能力。
- `GET /api/v2/dashboard.v2ExperienceGapBoard` 已返回 `version = v2_experience_gap_board_v1`，用于把目标体验拆成角色验收；当前真实状态下 3/4 个角色体验可用，主缺口是运营端仍需补齐生产闭环和生成准备度。
- `GET /api/v2/dashboard.v2ModuleBoard` 已返回 `version = v2_module_board_v1`，用于把 V2 模块规划转换成真实状态驱动的建设看板；当前 4/7 个模块可用，优先缺口是对标内容池和脚本生成工作流。
- `GET /api/v2/dashboard.v2ModuleBoard.primaryPackage` 已返回 `version = module_primary_package_v1`，用于把模块缺口转换成可执行步骤；当前返回 5 个对标内容池任务步骤，并复用 `firstBenchmarkMaterialPlan` 的真实状态，不创建模拟任务。
- `GET /api/v2/dashboard.v2ModuleBoard.primaryPackage` 已同步返回 `requiredFields`、`doneDefinition` 和 `blockedRules`；当前必填字段为标题、链接、账号、字幕/正文、备注，完成定义 4 条，不计入验收规则 3 条。
- 打开 `prototype/content-pool.html?v=module-package-acceptance-v1&benchmarkTaskId=1432#manual-import` 已验证内容池 P0-1 导入指引同步显示 V2 首页任务包：5 个任务步骤、5 个必填字段、4 条完成定义、3 条阻塞规则；390px 移动端任务包单列展示且无横向溢出。
- 打开 `prototype/index.html?v=script-handoff-v2&benchmarkTaskId=1432#stepGenerate` 已验证脚本流程页显示 P0-1 输入接力卡：目标任务为 `1432`，当前真实状态可读结构 `0`、本次勾选 `0`，不会把账号名或空任务算作生成输入；390px 移动端无横向溢出。
- 打开 `prototype/collection-center.html?v=p01-package-v1#p01-collection-package` 已验证采集中心显示 P0-1 补录包：目标账号“阿迪达斯官方旗舰店”，今日导入 `0`、有文本 `0`、已结构化 `0`、可生成 `0/3`，并展示固定对标号、人工链接/正文、旧字幕项目、第三方表格 4 条替代路径和 5 步闭环；390px 移动端无横向溢出。
- `GET /api/v2/dashboard` 已新增 `p01AcceptanceVerifier.version = p01_acceptance_verifier_v1`，把 P0-1 从计划/计数升级为逐项验收：真实素材入库、字幕/正文不少于 30 字、加入生成、结构摘要完成、候选脚本输入引用 `sourceId` 五项必须都有证据。
- 当前真实状态下 `p01AcceptanceVerifier.level = blocked`，目标任务仍为 `1432 / 阿迪达斯官方旗舰店`，5 项验收全部阻塞，`candidateSources = 0`，不会把历史示例、测试或验证素材算作通过。
- 采集任务中心 P0-1 补录包已新增“真实闭环验收器”展示区，读取同一份 `p01AcceptanceVerifier`，运营能直接看到每项证据、阻塞原因、sourceId 和下一步动作。
- 打开 `prototype/collection-center.html?v=p01-verifier-v1#p01-collection-package` 已验证桌面端显示 5 项验收卡，当前全部为 blocked；390px 移动端单列展示且无横向溢出。
- P0-1 验收器到内容池已新增回跳闭环：从验收器进入内容池时链接会携带 `returnTo=p01_verifier&benchmarkTaskId=1432`，内容池入口会显示“P0-1 验收回跳”，处理完成后的接力面板会提供“回到 P0-1 验收器复核”动作。
- 打开 `prototype/content-pool.html?v=benchmark-task-deeplink-v1&benchmarkTaskId=1432&returnTo=p01_verifier#manual-import` 已验证单条导入入口会带入任务 ID、账号和回跳提示；回跳链接目标为 `prototype/collection-center.html?v=p01-return-v1&benchmarkTaskId=1432#p01-collection-package`；390px 移动端无横向溢出。
- 采集任务中心 P0-1 验收器已新增“重新读取库表证据”按钮：点击后重新请求 `GET /api/v2/dashboard` 并刷新补录包、验收器和页面状态，只读 sourceId、文本、selected、structure_done 和候选脚本引用，不创建素材、不生成脚本。
- 已验证 `prototype/collection-center.html?v=p01-recheck-v1#p01-collection-package`：点击复核后页面状态显示 `P0-1 已复核：P0-1 未通过，0/5 项通过`，`content_sources` 数量保持 `8 -> 8`，桌面端和 390px 移动端均无横向溢出。
- `p01AcceptanceVerifier` 已新增 `candidateSourcesDetail`，把固定对标任务下的真实候选素材逐条返回 sourceId、标题、文本长度、selected、structure_done、候选脚本引用和下一步动作；当前真实状态为空数组，不创建示例素材。
- 采集任务中心 P0-1 验收器已新增 `SOURCE TRACE` 区：没有真实素材时显示“当前没有可追踪的真实素材 sourceId”；后续导入真实素材后，会逐条显示 sourceId 当前卡点（补字幕、加入生成、结构化或生成脚本）。
- 已验证 `prototype/collection-center.html?v=p01-source-trace-v1#p01-collection-package`：当前显示 SOURCE TRACE 空态和 `0/5` 验收状态；桌面端与 390px 移动端均无横向溢出。
- 脚本流程页和脚本库复盘页的“查看生成依据”已显式展示结构素材 `sourceId`，并加上 `P0-1 验收读取 sourceId #...` 标签；运营能直接看到候选脚本的 `input_structure_json` 证据，不再只能从标题推断脚本读了哪条素材。
- 已验证历史脚本 `77` 的 `daily_script_candidates.input_structure_json` 包含 sourceId `[6, 8]`；打开 `prototype/script-library.html?v=sourceid-evidence-v1` 和 `prototype/index.html?v=sourceid-evidence-v1#stepScripts` 均能看到 sourceId 验收标签且无横向溢出。本轮未生成新脚本。
- 脚本流程页生成前检查区已新增 `P0-1 SCRIPT GATE`：根据当前页面勾选的结构输入包、目标账号任务和 `p01AcceptanceVerifier.candidateSourcesDetail`，判断“本次生成能否推进 P0-1 第 5 步”。未勾选目标账号 structure_done 素材时，会明确提示即使生成也不能作为 P0-1 候选脚本读取素材的验收证据。
- 已验证 `prototype/index.html?v=p01-script-gate-v1&benchmarkTaskId=1432#stepGenerate`：当前真实状态显示 `本次生成不会推进 P0-1 第 5 步`，目标账号为“阿迪达斯官方旗舰店”，可读结构 `0`、本次勾选 `0`、已被脚本读取 `无`；桌面端和 390px 移动端无横向溢出。本轮未生成新脚本。
- `GET /api/v2/dashboard` 已新增 `r2InputVerifier.version = r2_input_verifier_v1`，把 R2 输入增厚从“能否点击生成”升级为“输入是否够厚”：逐项校验真实结构素材、热点/选题、品牌商品活动、高表现模板和复盘反馈信号。
- 当前真实状态下 `r2InputVerifier.level = blocked`，必填项 `2/3` 达标；热点/选题、商品活动、模板、复盘信号已达标，但真实结构素材为 `0/3`，因此系统不会把当前生成准备度误判为 R2 输入增厚完成。
- V2 首页“脚本生成准备度”已新增 R2 输入厚度卡，脚本流程页“生成前检查”已新增 R2 详细验收卡，明确说明“生成按钮只看关键输入；R2 验收器判断输入厚度和脚本质量风险”。
- 打开 `prototype/v2.html?v=r2-input-verifier-v1#generationReadinessSection` 和 `prototype/index.html?v=r2-input-verifier-v1#stepGenerate` 已验证 R2 卡均显示 blocked，5 项检查中只有真实结构素材不足；390px 移动端单列展示且无横向溢出。
- 对标内容池导入区已新增 R2 输入增厚任务包，读取 `r2InputVerifier`，把“真实结构素材 0/3”转换成运营可执行任务：真实链接补齐、旧字幕项目补齐、第三方表格补齐三条路径，并同步展示 5 项 R2 检查。
- 打开 `prototype/content-pool.html?v=r2-input-package-v1#manual-import` 已验证 R2 任务包显示 `真实结构素材 0/3、还缺 3 条、可生成否`，三条补齐路径可见；390px 移动端单列展示且无横向溢出。
- R2 输入增厚任务包已新增执行队列按钮：刷新 R2 计数、批量加入生成、批量结构化、进入脚本流程；其中批量动作复用现有真实素材保护接口，不新增绕过规则的数据写入路径。
- 导入、批量导入、批量加入生成和批量结构化完成后，内容池会重新读取 dashboard 与内容池列表，刷新 R2 输入包计数和对标任务状态。
- 打开 `prototype/content-pool.html?v=r2-actions-v1#manual-import` 已验证 R2 执行队列当前 4 个按钮可见；在 `0/3` 状态下“进入脚本流程”禁用，刷新动作不写入数据，API 仍为 `realStructures = 0/3`；390px 移动端按钮单列且无横向溢出。
- R2 输入增厚任务包已新增逐条素材诊断：`GET /api/v2/dashboard.r2InputVerifier.candidateSources` 会返回今天内容池候选素材的加入生成、正文/字幕、结构状态、排除原因和下一步动作。
- 对标内容池 R2 包已新增“R2 SOURCE DIAGNOSIS”区，把 `0/3` 缺口拆成“未加入生成 / 缺字幕正文 / 待结构化 / 不计入真实闭环 / 可进入生成”等运营可处理状态。
- 当前真实状态下 `candidateSources = 0`，页面展示空态并提示先导入真实对标视频/笔记；系统不会为了展示诊断而塞入示例素材。
- R2 批量动作已新增前后进度反馈：刷新、批量加入生成、批量结构化后会展示真实结构素材、候选素材、可进入生成、待加入、待结构化、缺字幕正文的前后变化。
- 当前真实状态下点击“刷新诊断”会显示 `真实结构素材 0/3 → 0/3`，并说明“仍没有可处理的真实候选素材”，避免运营误以为按钮无效或系统已处理完成。
- 对标内容池单条素材卡已新增推进向导：每条素材都会显示“不能推进 / 先提字幕 / 加入生成 / 生成结构 / 可进入脚本”等下一步状态，并复用现有字幕、加入生成、结构化和脚本流程动作。
- 当前真实内容池里的历史验证素材会显示“不能推进，这条素材不计入真实闭环”，不会因为已有字幕或结构摘要而误导进入 R2 计数。
- 单条导入预检已升级为真实闭环门槛卡：服务端返回 `realLoopEligible`、`r2AfterImportStep` 和 `gateItems`，前端逐项展示真实标题、非测试/示例、链接或正文、R2 下一步。
- 已验证 `https://example.com` / 验证素材会被预检阻塞并显示“不会入库”；真实抖音链接可导入为候选，但明确提示“导入后补字幕”，不会误判为 R2 已完成。
- R2 输入增厚任务包已新增 3 个补数槽位：后端 `replenishmentSlots` 会把候选素材填进槽位；没有候选时显示真实链接、旧字幕、第三方表格三条补数路径。
- 当前真实状态下 `candidateSources = 0`，3 个槽位全部为空槽，页面显示“待补”，不会自动生成或占位任何假素材。
- R2 补数槽位链接已带入 `r2Slot=1/2/3`；运营点击槽位进入导入页后，顶部任务单会显示“正在补第 N 条真实结构素材”和完成标准。
- 已验证第 2 个旧字幕槽位进入 `content-pool.html?v=r2-slot-v1&r2Slot=2&importPath=manual_subtitle...` 后，导入页显示 R2 SLOT 2，桌面和移动端均无横向溢出。
- R2 槽位上下文已接入导入后提示：单条导入或保存字幕成功后，`postImportNextPanel` 会显示 `R2 SLOT N` 接力区，提示继续补字幕/正文、加入生成和结构化。
- 为避免污染真实数据，本轮只做代码和页面任务单验证，未点击正式导入按钮；当前 R2 仍保持 `0/3`。
- `GET /api/v2/dashboard` 已返回 `developmentBoard.version = development_board_v1`，用于把静态开发路线升级为真实数据驱动的大版本开发看板。
- `GET /api/v2/dashboard.developmentBoard.implementationPlan` 已返回 `version = implementation_plan_v1`，当前优先包是 P0-1 首条真实账号素材闭环，原因是固定对标账号还没有真实近期内容进入生成。
- `GET /api/v2/dashboard.v2MasterPlan` 已返回 `version = v2_master_plan_v1`，用于把分散的目标蓝图、开发看板和采集替代方案聚合为首页作战区。
- `GET /api/v2/dashboard.v2AcceptanceBoard` 已返回 `version = v2_acceptance_board_v1`，用于把大版本发布门槛变成可检查总表；当前会显示 R1-R4 的真实进度和下一项缺口入口。
- `GET /api/v2/dashboard.v2ReleaseRoadmap` 已返回 `version = v2_release_roadmap_v1`，用于把大版本验收结果转换成发布计划；当前主阻塞是 R2 输入增厚，R1 不能在 R2 真实输入未跑通前宣称生产闭环完成。
- `GET /api/v2/dashboard.v2ExecutionQueue` 已返回 `version = v2_execution_queue_v1`，用于把大版本验收缺口转换成可执行队列，按“真实输入 -> 生成准备度 -> 脚本生成 -> 审核/复盘 -> 采集兜底”的依赖顺序推进。
- `GET /api/v2/workday/today` 已验证会返回今日工作日。
- `POST /api/v2/workday/close` 已验证可把今日工作日置为 `closed`。
- `POST /api/v2/workday/reset` 已验证可恢复 `open`，清空今日选择但保留历史脚本 `70` 条。
- 重置验证后已恢复 3 条今日素材和 1 条商品活动选择，生成准备度仍为 `true`。
- 热点池已验证读取最近抖音真实热榜批次 `50` 条，不是模拟数据。
- 热点池已验证可把“苹果系穿搭深得我心”标记为观察，再标回已加入今日候选，dashboard 仍显示 `hotCount = 3`。
- 浏览器已验证热点池页面显示筛选项、热榜批次、热点卡片和四个运营动作按钮。
- 已验证 `POST /api/v2/content-sources/preview` 对 `https://example.com/replace-video-999` 返回 `importable = false`、`非运营素材：示例链接`；对抖音真实域名样例和正文返回 `importable = true`；验证前后 `content_sources` 仍为 8 条。
- 已验证 `prototype/content-pool.html?v=single-import-preview-v1` 可通过 URL 预填触发单条预检：示例链接显示“暂不能导入”并禁用按钮，真实域名样例显示“导入真实素材”；桌面和 390px 移动端均无横向溢出。

## V2.1 人工导入和对标内容池

目标：让系统在自动采集不稳定时仍可工作。

当前已开始落地：

- 已新增 `content_sources` 表。
- 已新增 `GET /api/v2/content-sources`。
- 已新增 `POST /api/v2/content-sources`。
- 已新增 `POST /api/v2/content-sources/batch`。
- 已新增 `POST /api/v2/content-sources/{id}/select`。
- 已新增 `POST /api/v2/content-sources/bulk-select`。
- 已新增 `POST /api/v2/content-sources/bulk-structure`。
- 已新增独立页面 `prototype/content-pool.html` 和 `prototype/content-pool.js`。
- 全站左侧菜单已加入“对标内容池”，页面顺序为：V2 工作台、热点池、对标内容池、脚本流程、AI 生成能力、脚本库复盘、采集任务。
- V2 首页已新增“打开对标内容池”的正式入口，首页导入区保留为快捷操作。
- 已在 V2 工作台新增人工导入表单和最近导入列表。
- 已在 V2 工作台新增批量导入框。
- 最近导入列表已支持“加入/移出生成工作流”。
- 批量导入已支持第三方 CSV/TSV 表格粘贴，适配灰豚、蝉妈妈、飞瓜、新榜等工具导出字段。
- 批量导入会返回每行导入明细，失败行保留行号、原始输入和失败原因。
- 对标内容池批量导入已新增导入前预检，提示格式、识别字段、预计可导入行数、风险行和“导入 -> 加入生成工作流 -> 结构化”的下一步动作。
- 已新增 `POST /api/v2/content-sources/batch-preview`，导入前使用后端同一套清洗规则预检第三方表格。
- 第三方表格预检已支持字段映射、来源工具识别、表内重复链接、内容池已存在链接、缺少链接/正文、链接格式不完整和风险词提示。
- 对标内容池预检面板已展示可导入行、重复行、风险词行和行级检查示例，避免把自动采集兜底数据导错。
- 对标内容池已新增“第三方数据清洗看板”，读取真实内容池统计第三方/表格素材、已结构化、待结构化、字段覆盖和风险规则，并给出粘贴预检、批量加入生成、批量结构化动作。
- `GET /api/v2/content-sources` 已返回 `thirdPartyReadiness`，用于把第三方表格兜底从“可导入”升级为“可监控、可清洗、可推进到结构摘要”。
- 最近导入列表已支持导入后的批量处理动作：批量加入生成工作流、批量生成结构摘要。
- 对标内容池已新增“导入后下一步执行面板”，单条导入、批量导入、批量加入生成工作流和批量结构化后都会展示当前进度、下一步动作和入口。
- `GET /api/v2/dashboard` 已返回 `generationReadiness`，统一判断是否能进入脚本生成。
- V2 工作台已新增“脚本生成准备度”模块，显示已确认素材、人工结构、商品活动、优质模板和下一步动作。
- 脚本流程页已新增“生成前检查”模块，读取 `generationReadiness` 并展示四类输入是否就绪。
- 脚本流程页已新增输入证据链，显示本次生成会读取的商品活动、结构素材和对应维护入口。
- 脚本流程页已新增“本次生成会读取的对标结构素材”列表，展示每条已选素材的来源、结构摘要、可用部分、风险和结构化状态。
- 脚本流程页可直接把某条对标结构素材移出本次生成工作流，避免运营不知道 `/api/generate` 实际读取了哪些输入。
- 脚本流程页已支持“本次结构输入包”：运营可临时勾选哪些已结构化素材进入本次生成，`POST /api/generate` 会按 `structureSourceIds` 精确读取。
- 脚本流程页已把结构输入按固定对标号今日更新任务分组，展示任务账号、目标条数、已导入/已结构化数量，并支持一键勾选或取消该任务下的结构素材。
- 脚本流程页已新增“查看生成依据”，每条生成脚本可展开回看本次读取的采用选题、结构素材、商品活动、高表现模板和复盘信号。
- 脚本库复盘页已同步“查看生成依据”，历史脚本也能追溯当次输入包，方便判断脚本质量原因。
- 脚本流程页生成按钮会在关键输入缺失时提示缺项，不再让运营误以为只锁定素材包就一定可生成高质量脚本。
- V2 工作台已新增“直接生成候选脚本”控制台，可从 V2 页面直接调用 `/api/generate`，展示生成结果并写入脚本库。
- V2 工作台生成结果已支持直接审核：采用、待改、弃用，审核状态同步脚本库。
- V2 工作台生成结果已支持轻量发布回填：发布链接、播放、点赞、线索和模板标记，表现数据同步脚本库。
- `GET /api/v2/dashboard` 已返回 `reviewInsights`，聚合已发布脚本、优质模板和下一轮建议。
- V2 工作台已新增“复盘洞察”模块，显示表现最好脚本、可复用模板、聚合播放/点赞/线索和下一轮建议。
- 脚本库复盘页已新增“复盘学习”面板，读取同一份 `reviewInsights`，展示发布表现、优质模板、表现最好脚本和下一轮生成建议。
- `GET /api/v2/dashboard` 的 `tasks` 已由静态规划改为真实数据驱动，根据采集失败、未结构化素材、新脚本待审核、待改脚本和模板数量生成。
- V2 工作台“今日待处理”已展示动态待办、数量、优先级和动作入口。

### 任务

1. 新增统一素材表：
   - 平台
   - 来源类型
   - 标题
   - 链接
   - 账号
   - 备注
   - 状态
   - 创建时间
2. 对标内容池页面新增：
   - 单条链接导入。
   - 批量链接导入。
   - 手工字幕粘贴。
   - 对标账号筛选。
3. 导入后写入数据库。
4. 导入内容可以加入生成工作流。

### 已落地接口

- `GET /api/v2/content-sources`
- `POST /api/v2/content-sources`
- `POST /api/v2/content-sources/batch`
- `POST /api/v2/content-sources/{id}/select`

### 验收

- 能导入 10 条视频链接。
- 能手工粘贴 1 条字幕。
- 能把旧字幕提取项目输出按单条或批量表格导入，且导入前会预检，不写入示例/测试文本。
- 能从第三方表格粘贴导入，表头支持 `标题/链接/账号/平台/字幕/备注` 及常见别名。
- 粘贴第三方表格后，页面能在导入前说明识别到的格式、字段、可导入行数和风险行。
- 缺少链接和字幕/备注的行不会静默失败，必须提示具体行号和原因。
- 导入素材能在对标内容池列表展示。
- 导入素材能进入生成工作流。
- 对标内容池能作为独立页面完成导入、批量导入、批量加入生成工作流和批量生成结构摘要。
- 从任意左侧菜单进入对标内容池时，编号和页面关系一致。
- 批量导入后不需要逐条点击，能批量加入生成工作流并批量生成结构摘要。
- 导入后页面必须明确告诉运营下一步是加入生成工作流、生成结构摘要还是进入脚本流程，不能只显示“导入成功”。
- V2 工作台能明确提示当前是否可以生成脚本，缺项时给出下一步动作。
- 脚本流程页必须展示本次生成会读取的具体结构素材，并区分“会进入生成”和“已加入但未结构化”。
- 脚本流程页必须能看出结构素材来自哪个固定对标号更新任务；运营可以按任务批量勾选或取消结构输入。
- 运营能在脚本流程页直接移出某条结构素材，移出后生成准备度和输入证据链刷新。
- 运营能在脚本流程页临时勾选结构输入包；生成返回的 `inputStructureCount` 必须等于本次勾选且已结构化的素材数。
- 每条脚本必须能回看生成依据，至少展示结构素材、商品活动、模板、复盘信号和采用选题，不能只显示输入数量。
- V2 工作台能在准备度满足时直接生成候选脚本，生成结果显示质量分、输入证据和分镜，并同步进入脚本库。
- V2 工作台生成后能直接标记采用、待改或弃用，无需跳转脚本库完成第一轮筛选。
- V2 工作台生成后能直接回填发布表现，发布后自动进入已采用状态，并可沉淀为模板。
- V2 工作台能把发布表现反哺到下一轮生成前的判断，运营能看到应该复用哪些结构和 CTA。
- 脚本库复盘页能直接解释历史发布表现和模板如何影响下一轮生成，避免复盘数据只停留在列表归档。
- V2 工作台能基于真实数据生成今日待办，而不是展示静态开发计划。

### 测试

- 单条导入有效链接。
- 批量导入 3 条链接。
- 导入重复链接时不重复创建，或明确提示重复。
- 手工字幕为空时提示错误。

### 当前验证

- 批量导入 2 条手工素材成功。
- 最新素材可加入生成工作流。
- `GET /api/v2/dashboard` 已返回 `selectedContentSources` 和 `currentWorkflow.manualSourceCount`。
- V2 工作台已显示“人工导入 4 条 / 1 条已加入生成工作流”。
- 已通过真实 API 临时导入手工素材，验证单条导入能写入 `content_sources`；验证结束后已清理该测试素材，避免污染运营内容池。
- 已验证 `POST /api/v2/content-sources/bulk-select` 可把最新未选素材批量加入生成工作流。
- 已验证 `POST /api/v2/content-sources/bulk-structure` 通过 Codex CLI 为已选素材生成结构摘要，页面显示“已结构化 / 已加入生成”。
- 已验证 `prototype/content-pool.html?v=post-import-next-v1` 内容池列表无横向滚动，移动端宽度 390px 无横向滚动。
- `GET /api/v2/dashboard` 已新增 `selectedContentSources`，当前返回 8 条已选素材，其中 4 条有结构摘要。
- 已验证 `prototype/index.html?v=input-source-evidence-v4` 的脚本流程页显示 8 条结构输入卡片、4 条“会进入生成”、4 条“已加入但未结构化”，并提供 8 个移出按钮。
- 已验证脚本流程页结构输入列表在 390px 移动端无横向滚动。
- 已验证 `POST /api/generate` 传入 `structureSourceIds = [6, 8]` 时，新脚本 `74` 返回 `inputStructureCount = 2`，输入结构标题为“抖音导购一镜到底”和“V2替代链路验证素材”。
- 已验证 `prototype/index.html?v=structure-input-pack-v1` 默认勾选 4 条已结构化素材；取消 1 条后生成按钮从“结构 4 条”更新为“结构 3 条”。
- 已验证结构输入包在 390px 移动端无横向滚动。
- 已验证 `prototype/index.html?v=script-input-evidence-v1` 的脚本流程页可展开“查看生成依据”，新脚本 `74` 展示 5 类输入依据，结构素材为“抖音导购一镜到底”和“V2替代链路验证素材”。
- 已验证 `prototype/script-library.html?v=script-input-evidence-v1` 的脚本库页可展开“查看生成依据”，历史脚本同样显示 5 类输入依据。
- 已验证脚本库页生成依据展开区在 390px 移动端无横向滚动。

## V2.2 字幕结构化闭环

目标：把视频字幕变成脚本生成的高质量输入。

当前已开始落地：

- 已新增 `content_structures` 表。
- 已新增 `subtitle_jobs` 表。
- 已新增 `POST /api/v2/content-sources/{id}/subtitle-text`。
- 已新增 `POST /api/v2/content-sources/{id}/subtitle-job`。
- 已新增 `POST /api/v2/content-sources/bulk-subtitle-jobs`。
- 已新增 `POST /api/v2/content-sources/{id}/structure`。
- 对标内容池已支持单条素材手工补录/更新字幕文本。
- 手工补录字幕后，素材状态更新为 `subtitle_done`，后续结构摘要会读取该字幕文本。
- 手工补录或自动字幕成功后，对标内容池会立即显示单条下一步面板：生成这条结构摘要、加入生成工作流、查看这条素材或进入脚本流程。
- 对标内容池已支持单条素材创建自动字幕任务，调用本地 `video-tools /api/subtitle`。
- 自动字幕失败时会写入 `subtitle_jobs.status = failed`、失败原因和手工兜底动作，页面会继续允许粘贴字幕。
- 对标内容池已支持批量创建字幕任务，默认处理最近 3 条有链接且没有成功字幕任务的素材。
- 已新增 `benchmark_update_tasks` 表，把固定对标账号池变成“今日更新任务”，每个账号每天默认目标 3 条近期内容。
- 已新增固定对标账号池管理接口和页面入口：`GET /api/v2/benchmark-accounts` 读取账号池，`POST /api/v2/benchmark-accounts` 可新增或更新账号，并自动生成当天更新任务。
- 对标内容池页已新增“固定对标账号池”管理区，运营可维护平台、账号名、账号标识、分类、对标原因和内容结构标签；账号池维护后，下方“今日更新”任务会同步刷新。
- 已新增 `GET /api/v2/benchmark-update-tasks` 和 `POST /api/v2/benchmark-update-tasks/{id}`，可读取今日任务、统计账号已导入/已结构化数量，并标记今日跳过。
- 对标内容池已新增“固定对标号今日更新”面板，运营可按账号一键带入导入表单，补最近视频/笔记链接或字幕。
- 从固定对标号任务导入的单条/批量素材会写入 `content_sources.benchmark_update_task_id`，导入后任务自动进入 `in_progress`，素材结构化成功后任务自动变为 `done`。
- 对标账号任务卡已支持直接推进后续动作：把该账号今日素材加入生成工作流、按任务批量生成结构摘要、结构完成后跳转脚本生成流程。
- 固定对标号任务卡已新增账号级状态说明：为什么是当前状态、下一步动作、完成标准和恢复动作。
- 今日跳过后不再只有“跳过”状态，页面会显示“恢复为待更新”按钮；恢复后任务重新进入待补近期内容。
- 固定对标号任务接口已返回 `qualityCounts` 和 `sourceQueue`，按账号聚合今日已导入素材、字幕/正文、加入生成状态、结构化状态和下一步动作。
- 固定对标号任务接口已新增 `generationReadiness`，按账号判断能否进入脚本生成：必须至少有 1 条素材同时具备字幕/正文、已加入生成和结构摘要；否则明确缺近期内容、缺字幕/正文、未加入生成或缺结构摘要。
- 固定对标号任务卡已新增“今日素材质量”区块，运营能直接看到这个账号今天有没有真实素材、哪些缺字幕、哪些未结构化、哪些已进入生成输入。
- 固定对标号任务卡已新增“生成输入就绪”区块，展示可生成数量、关键缺口和下一步动作；未就绪时“去生成脚本”按钮保持禁用。
- 脚本流程页已接入固定对标账号任务输入状态：生成前检查会展示每个账号是否具备可生成输入、缺哪一步、回内容池处理入口；未就绪账号不会自动进入本次结构输入包。
- 脚本流程页固定对标账号任务卡已新增本次输入包操作：显示该账号可勾选结构数量和已勾选数量；有结构素材时可一键勾选或取消该账号结构，复用现有 `structureSourceIds` 输入包逻辑。
- `POST /api/v2/content-sources/bulk-subtitle-jobs` 已支持 `mode = benchmark_task`，可以按固定对标账号任务批量处理待补字幕素材。
- 固定对标号任务卡已新增“处理待补字幕”按钮；只有该账号今天已有待补字幕素材时才可点击，避免全局批量字幕误处理其他账号素材。
- 从固定对标号任务卡点击“导入这个账号近期内容”后，页面会记录当前账号任务并高亮对应任务卡。
- 单条或批量导入绑定固定对标任务成功后，导入后下一步面板会改成账号专属动作：处理该账号待补字幕、该账号加入生成、该账号生成结构摘要。
- 账号专属动作完成后会刷新内容池和固定对标任务，并自动滚回对应账号任务卡，减少运营在全局内容池里找素材。
- V2 首页、数据源矩阵、今日待办和日终复盘里的固定对标账号任务已支持深链到具体账号卡片；链接会携带 `benchmarkTaskId`，进入对标内容池后自动高亮任务卡，并在导入表单绑定该任务。
- 固定对标账号任务卡已新增“批量补这个账号”：自动填入账号专属表格模板和 `benchmarkUpdateTaskId`，运营替换真实链接/字幕后再解析导入；未点击导入前不会写入数据库。
- 已新增 `GET /api/v2/subtitle-service/health`，只读检测本地 `video-tools /api/health`，区分服务未启动、端口被其他服务占用、非 JSON 返回和健康返回异常。
- 字幕默认引擎已改为 `auto`，与 `video-tools` 当前接口支持的 `auto/asr/ocr` 保持一致。
- 对标内容池已新增“字幕服务诊断”面板，先提示服务地址、默认引擎、健康状态、下一步动作和手工字幕兜底。
- 对标内容池已新增“字幕接入执行看板”，基于真实内容池素材判断每条下一步动作：自动提字幕、手工补字幕、生成结构摘要、加入脚本生成。
- `GET /api/v2/content-sources` 已返回 `subtitleReadiness`，包含字幕服务状态、素材统计、优先处理队列和运营完成标准。
- `subtitleReadiness.jobTrace` 已新增字幕任务追踪摘要，聚合最近展示素材里的成功、失败、运行中任务数，展示最近失败原因和手工字幕兜底动作。
- 对标内容池字幕接入看板已新增“字幕任务追踪”区块；自动字幕失败时会直接显示失败素材、错误信息、“粘贴字幕”和“重新提取”按钮。
- 已复用 Codex CLI 对人工导入素材生成结构摘要。
- 已在 V2 工作台最近导入列表展示结构摘要、可用部分和风险提示。

### 任务

1. 新增字幕任务：
   - 待处理
   - 处理中
   - 成功
   - 失败
2. 接入旧项目：
   - `video-tools /api/subtitle`
3. 保存字幕文本。
4. 用 Codex CLI 生成结构摘要。
5. 页面展示结构摘要：
   - 开头钩子
   - 情绪点
   - 镜头节奏
   - CTA
   - 可借鉴结构
   - 风险
6. 结构摘要可以被脚本生成读取。

### 建议接口 / 当前接口

- `POST /api/subtitle-jobs`
- `GET /api/subtitle-jobs/{id}`
- `POST /api/content-structures`
- `GET /api/content-structures?sourceId=...`
- 当前原型：`POST /api/v2/content-sources/{id}/structure`

### 验收

- 一条视频链接可以创建字幕任务。
- 字幕提取失败时页面显示原因。
- 手工字幕可以直接生成结构摘要。
- 生成脚本时能显示“读取了字幕结构”。

### 测试

- video-tools 在线时跑成功链路。
- video-tools 未启动时返回明确错误。
- 手工字幕不依赖 video-tools。
- Codex CLI 失败时保留字幕原文并标记结构化失败。

### 当前验证

- 已对人工导入素材 `V2验证：导购问答转化结构` 生成结构摘要。
- Codex CLI 成功返回“问答转化型”结构。
- `GET /api/v2/dashboard` 已返回 `stats.contentStructures = 1`。
- V2 工作台已显示结构摘要、可用输入和风险提示。
- 已对内容素材 `8` 创建自动字幕任务；当前本地 `video-tools` 返回 `HTTP Error 502: Bad Gateway`，系统已记录失败任务，并在内容池保留手工字幕兜底。
- 已验证批量字幕任务入口会在对标内容池展示批量按钮和结果区域，失败时展示具体错误并保留手工兜底。
- 当前字幕健康诊断会直接告诉运营：如果 `127.0.0.1:8000` 不是 `video-tools` 或服务未启动，应先启动/换端口；当天生产不等待自动字幕，继续粘贴手工字幕完成结构化。
- 已验证 `GET /api/v2/content-sources` 返回 `subtitleReadiness.jobTrace.level = failed`，当前聚合到 3 条真实失败字幕任务，最近失败原因是 `HTTP Error 502: Bad Gateway`。
- 已验证 `prototype/content-pool.html?v=subtitle-trace-v1` 会展示 3 张失败任务卡，每张都有“粘贴字幕”和“重新提取”动作；桌面端和 390px 移动端均无横向溢出。
- 已验证 `POST /api/v2/content-sources/8/subtitle-text` 会把素材状态更新为 `subtitle_done`、`importMethod = manual_subtitle_patch`；页面 `prototype/content-pool.html?v=manual-subtitle-next-v2` 保存字幕后会展示“手工字幕兜底”下一步面板。
- `GET /api/v2/benchmark-update-tasks` 已验证每个账号任务返回 `statusReason`、`completionStandard` 和 `recoveryAction`。
- `POST /api/v2/benchmark-update-tasks/1` 已验证可从 `pending` 更新为 `skipped`，并返回 `今日跳过 / 恢复为待更新`；再恢复为 `pending`。
- 已验证 `prototype/content-pool.html?v=benchmark-task-brief-v1` 中 3 个固定对标账号任务都展示任务说明和完成标准，无横向溢出。
- 已验证临时跳过一个账号后页面出现 1 个“恢复为待更新”按钮；验证结束后已恢复为待更新，避免污染运营状态。
- `GET /api/v2/benchmark-update-tasks` 已验证返回 `qualityCounts` 和 `sourceQueue`；当前真实状态下 3 个账号今日素材队列均为空，因此页面必须提示“还没有今日素材”。
- 已验证 `prototype/content-pool.html?v=benchmark-source-quality-v1` 中 3 个固定对标账号任务都展示“今日素材质量”区块，无横向溢出；当前显示素材 0、有字幕/正文 0、已加入生成 0、待补字幕 0。
- 已验证固定对标账号池管理：新增「同城运动穿搭观察号」后账号池从 3 个变为 4 个，今日任务从 3 个变为 4 个；同平台同账号名再次保存会更新，不会重复创建。
- 已验证 `prototype/content-pool.html?v=benchmark-account-pool-v1` 展示 4 个固定账号和 4 个今日更新任务，桌面端和 390px 移动端均无横向溢出。
- 已验证 `GET /api/v2/benchmark-update-tasks` 返回 `generationReadiness.level = missing_sources`、`ready = false` 和阻塞原因“还没有导入这个账号的近期内容”；页面 `prototype/content-pool.html?v=benchmark-generation-readiness-v1` 展示 4 个“生成输入就绪”区块，全部生成按钮禁用，桌面端和 390px 移动端无横向溢出。
- 已验证脚本流程页 `prototype/index.html?v=script-benchmark-task-input-v1#stepGenerate` 展示 4 个固定对标账号输入状态卡，均提示缺近期内容；生成按钮显示“2. 关键输入缺失”且禁用，桌面端和 390px 移动端无横向溢出。
- 已验证脚本流程页 `prototype/index.html?v=script-task-package-actions-v1#stepGenerate` 展示 4 个账号任务的“本次输入包”状态，当前均为 `0/0 条结构已勾选`，8 个勾选/取消按钮全部禁用，桌面端和 390px 移动端无横向溢出。
- `POST /api/v2/content-sources/bulk-subtitle-jobs` 已验证 `mode = benchmark_task`、`benchmarkUpdateTaskId = 1` 可用；当前真实状态无素材，返回 `total = 0`、`success = 0`、`failed = 0`，不是接口失败。
- 已验证 `prototype/content-pool.html?v=benchmark-task-subtitle-v1` 中 3 个固定对标账号任务都显示“处理待补字幕”按钮；当前因无今日素材全部禁用，无横向溢出。
- 已验证 `prototype/content-pool.html?v=benchmark-task-focus-v1` 中从第一个固定对标账号点击“导入这个账号近期内容”后，隐藏任务 ID 写入 `1`，对应 `benchmark-task-1` 卡片高亮，无横向溢出。
- 已检查账号专属下一步按钮会携带 `data-next-task-id`，并分别调用账号级字幕、加入生成和结构化函数；本轮未造测试素材，避免污染真实内容池。

## V2.3 脚本质量引擎

目标：让脚本稳定达到“可拍可执行”。

当前已开始落地：

- 生成脚本时已读取已选择的人工结构摘要。
- 生成脚本时已读取已选择的商品活动。
- 已新增 `brand_products` 表。
- 已新增 `GET/POST /api/v2/brand-products`。
- 已新增 `POST /api/v2/brand-products/{id}/select`。
- `daily_script_candidates` 已新增 `quality_json` 和 `input_structure_json`。
- `daily_script_candidates` 已新增 `input_product_json`。
- `daily_script_candidates` 已新增 `input_topic_json`，记录每条脚本生成时采用的推荐选题快照。
- `daily_script_candidates` 已新增 `quality_status`、`review_status`、`review_note`、`rewrite_count`、`parent_script_id`。
- 已新增规则评分 `rule_based_v1`，覆盖可拍性、开头、品牌贴合、转化、合规。
- 脚本卡已展示质量分、评分维度、读取结构数量和评分理由。
- `quality_json` 已新增 `diagnosis`，解释强项、弱项、输入影响和建议改写方向。
- 脚本流程页和脚本库复盘页已展示质量诊断，运营能看出脚本为什么低分、应该改哪里。
- 自动改写已读取原脚本质量诊断，返回 `rewritePlan`、`rewriteReason` 和 `diagnosisUsed`，不再只是黑箱生成一个改写版。
- 脚本操作区已显示“自动改写将优先解决什么”，把质量诊断和改写按钮关联起来。
- 自动改写已升级为优先调用 Codex CLI：输入原脚本、质量诊断、品牌信息、结构素材、商品活动、模板和复盘信号；失败时才使用本地规则兜底。
- 改写版脚本已写入 `quality.rewriteDiff` 和 `quality.rewriteGenerator`，前端可展示改写方式、改动段落、开头变化和移除的风险词。
- 已新增独立品牌商品中心页面 `prototype/brand-center.html` 和 `prototype/brand-center.js`。
- 全站左侧菜单已加入“品牌商品”，页面顺序为：V2 工作台、热点池、对标内容池、品牌商品、脚本流程、AI 生成能力、脚本库复盘、采集任务。
- 品牌商品中心已支持新增商品活动、统计商品活动数量、加入/移出生成输入。
- V2 工作台已新增“品牌商品与活动输入”区。
- 已新增 `POST /api/v2/script-candidates/{id}/review`。
- 已新增 `POST /api/v2/script-candidates/{id}/rewrite`。
- 脚本卡已支持采用、待改、弃用和自动改写按钮。

### 任务

1. 升级生成输入：
   - 热点信息
   - 对标结构摘要
   - 品牌信息
   - 商品活动信息
2. 升级输出字段：
   - 标题
   - 开头
   - 分镜
   - 场景
   - 出镜人
   - 道具
   - 口播
   - 字幕
   - 剪辑提示
   - CTA
   - 来源依据
   - 风险提示
3. 新增质量评分：
   - 可拍性
   - 开头吸引力
   - 品牌贴合度
   - 转化明确度
   - 合规风险
4. 低分脚本自动重写一次。
5. 脚本卡显示评分和可拍理由。

### 建议接口

- `POST /api/generation-jobs`
- `GET /api/generation-jobs/{id}`
- `POST /api/script-candidates/{id}/rewrite`
- `POST /api/script-candidates/{id}/review`

### 验收

- 每条脚本都有具体镜头、场景、道具、口播、字幕、CTA。
- 每条脚本都有评分。
- 每条脚本质量分必须解释强项、弱项、输入影响和改写方向，不能只显示一个数字。
- 低分脚本会标记或自动改写。
- 自动改写必须说明本次采用哪条诊断、优先解决什么问题，并把改写依据写回新脚本。
- 自动改写必须优先尝试 Codex CLI 诊断改写；如果失败，必须明确显示兜底和失败原因。
- 改写版必须能回看“改了哪里”，至少包括开头变化、改动分镜段落和合规风险处理。
- 脚本能标记采用、弃用、待改。

### 测试

- 有字幕结构输入时生成。
- 无字幕结构输入时生成，并标记低信息输入。
- 商品活动为空时不虚构优惠。
- 禁用词命中时标记风险。

### 当前验证

- 已用 1 条已结构化人工素材生成 1 条脚本。
- 生成结果返回 `inputStructureCount = 1`。
- 已用 1 条商品活动再次生成 1 条脚本。
- 生成结果返回 `inputProductCount = 1`。
- 生成结果质量分为 `90`，并返回 5 个维度评分。
- 脚本流程页已显示“质量分 90 / 读取结构 1 条 / 读取商品活动 1 条”。
- 新生成脚本已自动写入 `qualityStatus = passed`、`reviewStatus = new`。
- 已验证脚本可标记为 `needs_edit`。
- 已验证自动改写会创建新候选脚本，并记录 `parentScriptId` 和 `rewriteCount`。
- 已验证 `POST /api/v2/script-candidates/{id}/rewrite` 返回新脚本、`rewritePlan`、`rewriteReason` 和 `diagnosisUsed`。
- 已验证自动改写版的 `quality.diagnosis.rewritePrompt` 会写明“本次按哪条诊断改写”。
- 已验证 `prototype/index.html?v=shot-readable-v1` 的脚本操作区显示“自动改写将优先解决”。
- 已验证脚本流程页和脚本库复盘页都能展示质量诊断。
- 已验证 `quality.rewriteDiff` 可记录改写方式、改动段落、旧开头、新开头和风险词处理。
- 已验证脚本流程页可展开“查看改写前后变化”，移动端无横向滚动。

## V2.4 采集任务中心

目标：把命令行采集变成可监控任务。

当前已开始落地：

- 已新增 `collection_tasks` 表。
- 已新增独立页面 `prototype/collection-center.html`。
- 左侧菜单已统一接入“采集任务”。
- 已新增 `GET /api/v2/collection-tasks`。
- 已新增 `POST /api/v2/collection-tasks/run`。
- 已支持手动触发抖音总热榜采集。
- 已支持手动触发抖音类目小批量采集。
- 类目采集遇到 `captcha_blocked` 时会标记任务失败，并提示改用人工导入。
- 类目采集会保存每个关键词的页面截图。
- 采集任务中心会展示 JSON 结果和截图产物路径。
- 已新增小红书占位任务 `xhs_placeholder`。
- 小红书占位任务会记录为失败状态，并给出人工导入/第三方数据替代动作。
- 采集任务中心的失败任务可跳转到对标内容池人工导入，并预填平台、标题、来源和备注。
- 采集任务中心已新增替代链路提示：公开热榜 → 登录态小批量 → 验证码/登录失效 → 对标内容池人工/第三方导入。
- 已新增 `collection_schedules` 表和 `GET/POST /api/v2/collection-schedules`，用于保存每日采集计划、启用状态、时间、关键词、负责人和失败兜底动作。
- 采集任务中心已新增“每日采集计划”面板，先固定运营节奏，后续再接真正后台定时器。
- 已新增 `POST /api/v2/collection-schedules/{id}/run`，支持按计划运行一次并写入采集任务日志；第三方表格兜底计划会生成一条人工导入任务。
- 已新增 `collectionStrategy` 汇总，把抖音公开热榜、抖音登录态小批量、小红书人工导入、第三方表格兜底合成今日采集保障判断。
- 采集任务中心已新增“今日采集保障”面板，展示每条链路的状态、证据、负责人、建议动作和运行/导入入口。
- 已新增 `dataSourceMatrix`，把公开热榜、登录态采集、人工导入、第三方表格、小红书内容、字幕结构和脚本库复盘统一成数据源分级状态机。
- 采集任务中心已新增“数据源分级状态机”面板，按 A/B/C/D/E/F 展示每个来源的当前状态、证据、能产出什么、风险边界和下一步动作。
- V2 首页“数据采集替代方案”已接入 `dataSourceMatrix`，不再只显示静态 A/B/C/D 说明；首页会展示当前可生产状态、可用来源数量、风险边界和下一步入口。
- `GET /api/v2/dashboard.tasks` 已接入 `dataSourceMatrix`，会把登录态失败、小红书人工兜底、第三方表格导入、字幕结构缺口等数据源阻塞项转成首页今日待办。
- 已新增 `collectionActionFlow`，把数据源状态翻译成每日采集保障任务流：公开热榜打底、失败切人工/第三方、素材结构化、进入脚本生成。
- 采集任务中心已新增“每日采集保障任务流”面板，运营能按顺序处理下一步，而不是只看状态卡。
- 已新增 `collectionFallbackDesk`，把失败/待处理来源收束成“采集失败兜底执行台”，集中展示主动作、人工导入、第三方表格、小红书人工导入、字幕结构化和完成标准。
- V2 首页“数据采集替代方案”已展示采集任务流前三步，并把任务流中的阻塞项写入今日待办。

### 任务

1. 新增采集任务表。
2. 页面展示任务状态：
   - 成功
   - 失败
   - 登录态失效
   - 验证码阻塞
3. 支持手动触发：
   - 抖音总热榜
   - 抖音类目采集
   - 小红书占位采集
4. 保存失败截图或错误文本。
5. 增加小红书占位任务。`已完成`
6. 保存浏览器失败截图。`已完成验证码截图留存`
7. 支持定时任务配置。`已完成最小计划配置，尚未接后台自动执行器`

### 验收

- 运营能看到最近一次采集是否成功。
- 登录态失效时有明确提示。
- 手动重跑能产生新任务记录。
- 运营能看到每日采集计划、启用状态、建议时间、关键词、负责人和失败兜底动作。
- 修改采集计划后能持久化保存。
- 点击“按计划运行一次”能按计划配置产生采集任务记录，失败或人工处理状态必须进入最近采集任务列表。
- 运营能看到每个数据源属于哪一层，以及自动采集失败后应该切到人工导入、第三方表格、字幕结构化还是脚本复盘。
- 数据源状态必须明确区分真实采集、人工导入、第三方兜底和历史复盘，不能把占位任务当成真实数据。
- V2 首页必须从数据源状态直接生成今日待办，运营不需要先进入采集任务中心才知道该补哪条来源。
- 采集任务中心必须展示“今天按什么顺序执行”：先用哪个自动源，失败后切哪条兜底，什么时候结构化，什么时候进入生成。
- 采集任务中心必须提供一个集中兜底执行台，运营无需在多个状态卡里找入口，就能直接进入人工导入、第三方表格、结构摘要或生成流程。
- V2 首页必须展示采集任务流摘要和至少 3 个关键步骤，避免运营只看到数据源列表但不知道下一步。

### 当前验证

- `POST /api/v2/collection-tasks/run` 触发 `douyin_hot` 成功，生成任务 `1`。
- 热榜采集返回 `status = success`，并刷新热榜数据，当前 `hotItems = 199`。
- `POST /api/v2/collection-tasks/run` 触发 `douyin_category` 时遇到验证码，生成任务 `3`。
- 类目任务返回 `status = failed`，错误为“登录态采集遇到验证码，需稍后重试或改用人工导入。”
- 打开 `prototype/collection-center.html?v=collection-center-v1` 已验证能看到 3 条任务、3 种采集方案和失败原因。
- 复测类目采集生成任务 `4`，失败状态下返回 2 个产物：JSON 结果和验证码截图。
- 已确认截图文件存在：`data/browser-captures/douyin-category/2026-06-08T09-37-16-015Z-阿迪达斯-captcha_blocked.png`。
- 打开 `prototype/collection-center.html?v=collection-artifacts-v1` 已验证页面展示“采集产物”路径。
- `POST /api/v2/collection-tasks/run` 触发 `xhs_placeholder` 成功入库，生成任务 `5`。
- 小红书任务返回 `status = failed`、`strategy = manual_import`，并返回 3 个替代动作。
- 打开 `prototype/collection-center.html?v=xhs-placeholder-v1` 已验证页面展示“小红书热榜/笔记”策略卡和建议动作。
- 点击“带入人工导入”应跳转到 `prototype/content-pool.html#manual-import`，平台预填为 `xhs`，标题预填为“小红书人工导入素材”。
- `GET /api/v2/collection-schedules` 已返回 4 条默认计划：抖音热榜、抖音类目、小红书占位、第三方表格兜底。
- `POST /api/v2/collection-schedules/{id}` 已验证可保存计划时间、关键词、负责人、启用状态和失败兜底动作。
- `POST /api/v2/collection-schedules/{id}/run` 已验证第三方表格兜底计划会生成 `third_party_import` 任务，并提示去对标内容池批量导入。
- `GET /api/v2/dashboard` 已验证返回 `collectionStrategy.level = usable_with_fallback` 和 4 条保障链路。
- 打开 `prototype/collection-center.html?v=collection-guarantee-v1` 已验证能看到“今日采集保障”、抖音公开热榜、小红书人工导入；移动端无横向滚动。
- `GET /api/v2/dashboard` 已返回 `dataSourceMatrix.level`、`sources[]` 和 `rules[]`，当前真实数据下可展示 7 个来源层级。
- 打开 `prototype/collection-center.html?v=data-source-matrix-v1` 已验证页面展示“数据源分级状态机”，运营能看到每个来源的证据、产出、风险和下一步动作。
- `GET /api/v2/dashboard` 已验证 `tasks[]` 包含 `status = data_source` 的首页待办，当前会提示处理登录态小批量和第三方表格等兜底来源。
- 打开 `prototype/v2.html?v=homepage-source-matrix-v1` 已验证首页“数据采集替代方案”展示真实数据源矩阵摘要和来源卡片，移动端无横向滚动。
- 首页第三方表格来源卡和对应 `data_source` 待办已能跳转到 `content-pool.html#batch-import`，并携带 `importPlatform=third_party`、`importMode=batch`、来源工具和提示文案。
- 对标内容池批量导入卡片已新增 `id="batch-import"` 和 `:target` 高亮；从首页跳转后会显示“第三方表格兜底”提示，平台预设为第三方数据，来源预设为灰豚/蝉妈妈/飞瓜/新榜。
- 首页登录态小批量失败来源已改为直接跳转到对标内容池人工导入，携带 `importPlatform=douyin`、标题“抖音登录态采集失败补录”和失败兜底说明。
- 首页小红书内容来源已改为直接跳转到对标内容池人工导入，携带 `importPlatform=xhs`、标题“小红书人工导入素材”和“自动采集暂不接入”的说明。
- 对标内容池已新增“来源待办处理条”，从首页数据源待办跳入时会展示来源平台、来源/账号、当前入口和后续步骤。
- 单条兜底处理条展示 4 步：补充链接或正文/字幕、导入内容池、加入生成工作流、生成结构摘要。
- 批量表格兜底处理条展示 5 步：粘贴第三方表格、查看导入前预检、解析导入、批量加入生成工作流、批量生成结构摘要。
- `GET /api/v2/dashboard` 已返回 `collectionActionFlow.summary`、`nextAction`、`nextHref` 和 `steps[]`。
- 打开 `prototype/collection-center.html?v=collection-action-flow-v1` 已验证页面展示“每日采集保障任务流”。
- 打开 `prototype/v2.html?v=collection-action-flow-v1` 已验证首页展示“今日采集任务流”和前三个执行步骤。

## V2.5 复盘闭环

目标：让系统知道哪些脚本真的有用。

当前已开始落地：

- 已新增独立页面 `prototype/script-library.html`。
- 左侧菜单已统一接入“脚本库复盘”。
- 已新增 `GET /api/v2/script-library`。
- 已新增 `POST /api/v2/script-candidates/{id}/publish-result`。
- `daily_script_candidates` 已新增 `publish_url`、`published_at`、`performance_json`、`is_template`。
- 脚本库页已支持全部、已采用、待改、弃用、已发布、模板筛选。
- 脚本库页已支持回填发布链接、播放、点赞、评论、线索和“沉淀为模板”。
- 生成脚本时已读取 `is_template = 1` 的高表现模板。
- 已新增 `daily_script_candidates.input_template_json`，记录每条脚本生成时参考的模板快照。
- 已新增 `daily_script_candidates.input_topic_json`，记录每条脚本生成时采用的推荐选题快照。
- 脚本流程页已显示“结构 / 商品 / 模板”三类输入证据。
- 脚本库页已显示“生成参考模板”，用于追溯复盘数据如何影响新脚本。
- 脚本库页已显示“采用选题”，用于追溯今日推荐选题如何影响新脚本。
- 脚本库页已新增“新脚本”筛选、勾选脚本、全选当前列表、清空选择和批量采用/待改/弃用。
- 批量审核暂复用现有单条审核接口循环提交，不新增数据库表，失败时显示成功/失败数量和首个失败原因。
- `reviewInsights` 已新增 `learningSignals`，从审核状态、质量分、发布表现、模板标记和结构来源中提炼“优先复用”和“需要避开/改写”的反馈信号。
- 脚本库“复盘学习”面板已展示复用信号和避坑信号，说明下一轮生成应该优先使用哪些结构、降低哪些结构权重。
- `GET /api/v2/dashboard` 已新增 `qualityLearningPlan`，把模板、发布表现、审核状态和复盘信号整理成质量学习成熟度、下一步操作队列和生成影响说明。
- 脚本库“复盘学习”面板已升级为“质量学习控制面板”，运营可以直接看到当前是否可反哺生成、缺什么、先审核/回填/沉淀模板哪一步。
- 质量学习控制面板里的动作按钮可直接切换脚本库筛选或跳转到生成页，减少“洞察展示”和“实际操作”之间的断层。
- 生成前检查已显示复盘学习摘要，让运营知道本次生成会受到模板和历史反馈影响。
- 首页、生成页、脚本库的采用/待改/弃用按钮已写入默认审核原因，避免后续反馈学习只有状态、没有原因。
- 首页和脚本库的单条审核已升级为“可编辑审核原因 + 快捷原因”：运营可在采用/待改/弃用前写清楚原因，快捷填入可拍、开头弱、转化弱、品牌不贴合等常见反馈；后端在原因为空时仍会写入默认原因。
- `reviewInsights.learningSignals` 已新增 `noteLearning`，会计算审核原因覆盖率、缺原因数量、原因主题分布和原因级复用/避坑指令；`qualityLearningPlan` 会把审核原因数量纳入“下一轮生成会读取”的输入说明。
- V2 首页“复盘洞察”和脚本库“质量学习控制面板”已展示审核原因覆盖率和原因主题，避免复盘只停留在采用/待改/弃用计数。

### 任务

1. 脚本卡新增采用状态。
2. 支持填写发布链接。
3. 支持回填表现数据。
4. 标记优质模板。
5. 生成时可引用历史优质模板。
6. 增加复盘维度：
   - 完播率
   - 点击率
   - 私信/团购线索
   - 素材来源
   - 脚本结构
7. 把优质模板重新送回生成提示词。

### 验收

- 可以区分生成脚本、采用脚本、发布脚本、表现优秀脚本。
- 下次生成可以选择引用优质模板。

### 当前验证

- `GET /api/v2/script-library?limit=3` 已返回脚本库数据。
- 已对脚本 `64` 回填发布链接、播放 `1280`、点赞 `86`、评论 `12`、线索 `3`。
- 脚本 `64` 已自动更新为 `reviewStatus = adopted`、`publishUrl != ""`、`isTemplate = true`。
- 打开 `prototype/script-library.html?v=library-bulk-review-v1` 后，统计显示总脚本 `70`、已采用 `2`、已发布 `2`、模板 `2`。
- 模板筛选已验证只返回 1 条优质模板。
- 再次生成 1 条脚本后，接口返回 `inputTemplateCount = 1`，新脚本 ID 为 `65`。
- 脚本 `65` 的质量理由包含“参考了 1 条高表现模板”。
- 脚本流程页已验证显示“结构 1 条 / 商品 1 条 / 模板 1 条”和模板名称。
- 脚本库页已验证显示“生成参考模板：苹果系穿搭来阿迪怎么拍团购”。
- 脚本库页已验证显示“采用选题：哈兰德获哈兰德模仿大赛第二名 × 夏季运动鞋团购活动”。
- 当前真实脚本库共有 `70` 条脚本，其中仍有大量 `new` 状态候选；脚本库批量选择交互已在浏览器验证，选择 2 条后操作条显示“已选 2 条”，清空后恢复为“已选 0 条”。
- 已验证脚本 `77` 通过 `POST /api/v2/script-candidates/77/review` 保存自定义待改原因，并可从脚本库接口读回。
- 已验证 `prototype/script-library.html?v=review-note-v1&status=needs_edit` 展示审核原因、6 个原因输入框和 24 个快捷原因按钮，无横向溢出。
- 已验证 `prototype/v2.html?v=review-note-v1` 今日产出区加载 8 个审核原因输入框和 32 个快捷原因按钮，390px 移动端无横向溢出。
- 已验证 `GET /api/v2/dashboard.qualityLearningPlan.reviewNoteLearning` 返回审核原因覆盖率 `56%`、`5/9 条已写原因`、缺原因 `4` 条、原因主题 `其他原因 4 条 / 开头/钩子 1 条`，并显示下一轮生成会读取 `5 条审核原因`。
- 已验证 `prototype/script-library.html?v=review-note-learning-v1` 的质量学习控制面板展示“审核原因覆盖 56%”和原因主题；`prototype/v2.html?v=review-note-learning-v1` 的复盘洞察展示“原因覆盖 56%”，390px 移动端无横向溢出。

## V2.6 采集保障中枢

目标：让“数据采集替代方案”从规划说明变成运营每天能执行的决策入口。

当前已开始落地：

- `GET /api/v2/dashboard` 已新增 `collectionGuaranteeHub`。
- `collectionGuaranteeHub` 聚合 `collectionStrategy`、`dataSourceMatrix`、`collectionActionFlow` 和 `collectionFallbackDesk`，不重新编造状态。
- 采集任务中心顶部已新增“采集保障中枢”，先回答今天应该走自动采集、人工导入、第三方表格还是结构化队列。
- 采集保障中枢已展示 A/B/C/D 四层数据链路、当前模式、下一步动作、就绪/可用/兜底/待处理数量。
- 采集保障中枢已展示失败切换规则：公开热榜失败切 C/D，登录态验证码切 C/D，兜底素材必须进入结构化。
- `collectionGuaranteeHub` 已升级到 `collection_guarantee_hub_v2`，新增 `decisionEngine`，把当前真实状态直接翻译成“当前推荐、触发条件、切换到、完成标准、执行按钮”。
- 采集任务中心顶部已新增“采集替代方案决策器”，当前 `fallback_now` 时会明确提示不要继续硬跑自动采集，优先打开人工/第三方兜底或固定对标账号补录入口。
- 决策器不新增孤立状态，来源仍然只读 `collectionActionFlow`、`collectionFallbackDesk`、`dataSourceMatrix` 和 `collectionStrategy`。
- 已新增 `GET /api/v2/dashboard.collectionFallbackSwitcher`，把自动采集失败后的替代路径拆成 4 个可执行入口：人工链接/正文、旧字幕项目、第三方表格、固定对标号补录。
- 采集任务中心已新增“采集替代方案选择器”，读取 `collectionFallbackSwitcher` 并按真实 `dataSourceMatrix`、`collectionFallbackDesk`、`firstBenchmarkMaterialPlan` 推荐当前路径。
- 当前真实状态下，选择器会推荐 4 条补输入路径，但所有路径仍必须通过内容池预检、真实素材保护、加入生成和结构化，不允许模板/示例文本直接入库。
- 已验证“旧字幕项目”路径从采集任务中心跳转到内容池 `importPath=manual_subtitle`，页面显示旧字幕项目导入入口，平台切到手工素材，不写入任何占位数据。
- 已验证 `prototype/collection-center.html?v=fallback-switcher-v1` 展示 4 张路径卡片；桌面端无横向溢出，390px 移动端单列堆叠。
- V2 首页“数据采集替代方案”已接入 `collectionGuaranteeHub` 摘要，首页先显示当前采集决策，再显示任务流和数据源矩阵。
- 采集保障中枢的每条失败切换规则已补充负责人、SLA、交接动作和证据口径；采集中心展示完整信息，V2 首页展示责任摘要。
- `GET /api/v2/dashboard` 已新增 `collectionFallbackTrace`，从采集失败/兜底任务串起任务结果、截图/JSON 产物、人工导入匹配结果和结构摘要状态。
- V2 首页“数据采集替代方案”已新增“采集替代方案选择器”摘要，读取 `collectionFallbackSwitcher`，把人工链接/正文、旧字幕项目、第三方表格、固定对标号补录四条路径直接放到首页数据策略区，运营不必先进入采集中心才能判断该切哪条兜底。
- 采集任务中心已新增“兜底追溯链路”面板，显示采集任务、失败证据/产物、人工/第三方导入、结构摘要四步状态。
- 追溯链路不改库表、不伪造结果；匹配不到内容池导入时明确显示“等待人工导入”。
- 移动端已保持单列展示，避免中枢卡片挤压。
- 已新增 `GET /api/v2/content-sources/batch-template`，输出第三方/人工表格推荐表头、示例文本、字段别名、适配工具、平台枚举、导入规则和风险词。
- 对标内容池批量导入区已新增“字段模板”卡片，支持复制模板和填入并预检；模板示例不会自动入库，正式导入前必须替换为真实数据。
- V2 首页批量导入区已接入同一模板接口，采集兜底入口进入首页时也能复制或填入模板。
- 固定对标账号池已接入采集保障中枢：`dataSourceMatrix` 新增 `C2 固定对标账号池`，读取 `benchmark_update_tasks` 的待更新、已导入和已结构化数量。
- 采集任务流已新增“补固定对标账号近期内容”步骤；当对标账号只剩账号名单或素材未结构化时，会提示进入对标内容池按账号补 1-3 条近期视频/笔记。
- 兜底执行台已新增对标账号更新动作卡，完成标准为“每个关键对标账号补近期内容并完成结构摘要”。
- 采集保障中枢失败切换规则已新增 `C2 固定对标账号池 -> C 人工链接/字幕 或 D 第三方表格`，明确负责人、SLA、交接动作和证据口径。
- 已新增 `GET /api/v2/dashboard.collectionDailyReview`，从真实采集任务、数据源矩阵、对标账号任务、结构摘要、脚本审核和发布回填生成日终采集复盘。
- `collectionDailyReview` 会输出可否收工、未闭环项、需复核项、高优先级阻塞和明日优先处理，不会自动把缺口改成完成。
- V2 首页“数据采集替代方案”已新增“日终采集复盘”卡片，运营能在首页看到收工前检查结果。
- 已验证 `prototype/v2.html?v=homepage-fallback-switcher-v1` 在首页数据策略区展示 4 条替代路径；桌面端无横向溢出，390px 移动端单列堆叠。
- 采集任务中心已新增独立“日终采集复盘”区，展示所有检查项和明日优先级。
- `POST /api/v2/workday/close` 已返回 `dailyReview`，结束工作日后直接提示今天还有哪些高优先级采集/输入缺口。
- 已新增 `GET /api/v2/dashboard.workdayOpeningReminder`，从 `collectionDailyReview.nextDayPriorities` 生成新一轮开工提醒。
- V2 首页 hero 下方已新增“开工提醒”卡片，把失败来源兜底、固定对标账号更新、脚本审核等遗留优先项前置展示。
- 首页“今日待处理”会把开工提醒注入第一条任务，避免运营必须滚到日终复盘区才知道先处理什么。
- `POST /api/v2/workday/reset` 后，页面会重新读取开工提醒，并在顶部提示本轮应优先处理的遗留项数量和下一步动作。
- 已新增 `operation_handoffs` 表，用于保存运营交接快照。
- 已新增 `GET /api/v2/operation-handoffs` 和 `POST /api/v2/operation-handoffs`，可读取最近交接记录并把当前开工提醒/日终复盘固化为快照。
- V2 首页开工提醒卡片已新增“保存交接记录”按钮，保存后刷新最近交接记录。
- 采集任务中心日终复盘区已展示最近交接记录，方便采集维护和运营交接。

### 任务

1. 将本地运营交接记录进一步接入飞书通知或飞书文档归档。

## 开发顺序

推荐顺序：

1. V2.0 页面与状态重构。
2. V2.1 人工导入。
3. V2.2 字幕结构化。
4. V2.3 质量引擎。
5. V2.4 采集任务中心。
6. V2.5 复盘闭环。

当前 V2.4 已有最小任务中心、失败截图留存、小红书占位任务和失败转人工导入链路。后续不要继续深挖不稳定爬虫，优先补第三方表格导入和定时任务配置，让采集失败时生产链路仍可继续。

## 大版本拆包

后续开发按产品交付包推进，不再按单个按钮零散修补。

### R1 生产闭环版

目标：运营每天能从首页完成“选题 -> 生成 -> 审核 -> 入库 -> 复盘”的最小生产闭环。

必须包含：

- 今日生产闭环。
- 今日推荐选题。
- 直接生成候选脚本。
- 首页待审核脚本队列。
- 脚本库审核、发布回填和模板沉淀。

当前状态：

- 已基本跑通，但还需要继续优化脚本质量和运营批量处理体验。
- `GET /api/v2/dashboard.releaseReadiness` 已能基于今日闭环、候选脚本、首页审核队列和复盘入库计算 R1 验收状态。

### R2 输入增厚版

目标：减少只靠热词生成低质量脚本的问题。

必须包含：

- 对标内容池。
- 字幕任务。
- 手工字幕兜底。
- 结构摘要。
- 品牌商品活动。
- 生成输入证据链。

当前状态：

- 人工导入、手工字幕、结构摘要和商品活动已开始落地；自动字幕服务仍需接入。
- `releaseReadiness` 已能基于对标内容池、结构摘要、商品活动和生成准备度计算 R2 验收状态。

### R3 质量引擎版

目标：让脚本从“能生成”提升到“稳定可拍”。

必须包含：

- 质量评分。
- 风险校验。
- 低分自动改写。
- 分镜可读性。
- 优质模板复用。
- 采用/待改原因沉淀。

当前状态：

- 规则评分、改写、模板复用和分镜可读性已开始落地；还缺更强的质量诊断和人工反馈学习。
- `releaseReadiness` 已能基于质量评分、待改改写、模板复用和分镜可读性计算 R3 验收状态。

### R4 采集保障版

目标：自动采集失败时当天生产不被阻塞。

必须包含：

- 抖音公开热榜自动采集。
- 登录态小批量采集。
- 验证码和登录态失败截图。
- 小红书人工导入占位。
- 第三方表格导入。
- 每日采集计划和兜底动作。

当前状态：

- 抖音公开热榜、登录态失败记录、采集任务中心、第三方表格兜底入口已开始落地；后续应优先完善计划配置和导入清洗，而不是深挖不稳定爬虫。
- `releaseReadiness` 已能基于公开热榜、失败可见、兜底链路和每日采集计划计算 R4 验收状态。

## 下一档成熟度缺口

当前 R1-R4 代表“原型大版本可验收”，不是最终系统完成。下一轮应把验收门槛继续提高。

1. 真实字幕服务接入：
   - 视频链接创建字幕任务。
   - 成功后保存字幕原文。
   - 失败后保存原因并允许手工字幕兜底。
   - 对标内容池显示字幕任务状态。
2. 固定对标号内容更新：
   - 固定账号池不只保存账号名和结构标签。
   - 每周导入近期高表现视频/笔记。
   - 保存链接、字幕、表现指标和结构摘要。
   - 能批量加入今日生成工作流。
3. 质量反馈学习：
   - 采用、待改、弃用必须记录原因。
   - 发布表现要能归因到开头、结构、CTA、商品活动。
   - 下一轮推荐选题和生成提示词要读取这些反馈。
4. 第三方数据清洗：
   - 沉淀灰豚、蝉妈妈、飞瓜、新榜等表格字段映射。
   - 导入前预检要给出去重、缺字段、疑似风险。
   - 导入后支持批量加入生成工作流和批量结构化。

## 运营交接归档

目标：把开工提醒、日终复盘、采集阻塞和明日优先项从页面状态沉淀成可复制、可落飞书/日报的交接文本。

当前已落地：

- 已新增 `operation_handoffs` 表，用于保存交接快照。
- 已新增 `GET /api/v2/operation-handoffs`、`GET /api/v2/operation-handoffs/{id}` 和 `POST /api/v2/operation-handoffs`。
- 交接详情返回 `archiveText`，包含品牌、状态、生成时间、开工提醒、优先处理、复盘检查点和归档规则。
- V2 首页开工提醒区已支持“保存交接记录”和“复制交接文本”。
- 采集任务中心已展示最近交接记录，并支持“复制交接文本”。
- 自动复制被浏览器限制时，会展开只读交接文本框，运营可手动全选复制，不再只显示失败。
- 已新增交接处理状态字段：负责人、处理状态、处理备注和处理完成时间。
- 已新增 `POST /api/v2/operation-handoffs/{id}/process`，支持把交接记录标记为待处理、处理中、已处理或已归档。
- V2 首页和采集任务中心已展示负责人、处理状态和处理备注，并支持“开始处理”“标记已处理”。

当前验证：

- `GET /api/v2/dashboard` 返回 1 条真实交接记录。
- `GET /api/v2/operation-handoffs/1` 返回 `archiveText`，长度 926 字符，首行是 `# 运营交接记录｜2026-06-08`。
- `prototype/v2.html?v=handoff-copy-v2` 已验证加载新版 `v2.js`，复制按钮存在；剪贴板受限时展开 926 字符交接文本，无横向溢出。
- `prototype/collection-center.html?v=handoff-copy-v2` 已验证加载新版 `collection-center.js`，复制按钮存在；剪贴板受限时展开 926 字符交接文本，无横向溢出。
- `GET /api/v2/operation-handoffs/1` 已验证旧记录通过迁移默认返回 `owner = 运营`、`processStatus = pending`、`processStatusLabel = 待处理`。
- `POST /api/v2/operation-handoffs/1/process` 已验证可更新为 `processing` 和 `done`；更新为 `done` 时返回 `processedAt`。
- `prototype/v2.html?v=handoff-process-v1` 已验证展示 `已处理 / 负责人：运营 / 处理备注`，已处理后不再显示重复处理按钮，无横向溢出。
- `prototype/collection-center.html?v=handoff-process-v1` 已验证展示 `已处理 / 负责人：运营 / 处理备注`，已处理后不再显示重复处理按钮，无横向溢出。

下一步：

- 把复制文本进一步接到飞书文档写入动作，但仍保持“先复制预览、再确认写入”的产品边界。
- 给交接记录增加班次、多人协作备注和飞书归档链接，避免只有本地状态没有外部协同凭证。
