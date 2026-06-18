# Content Ops UI Kit v1

## 定位

这套 UI Kit 是“内容生产 Agent / 内容中台”的基础前端框架，不是单页视觉稿。目标是沉淀一套可复用的 B2B SaaS 组件系统，后续用于素材库、品牌活动、脚本生成、脚本库，以及新的内容运营系统。

本阶段只定义视觉和交互规则，不改真实业务页面、不改接口、不改数据流。

## 产品气质

- 安静、专业、可信，适合内容运营团队长期高频使用。
- 商用产品质感优先，避免临时原型感。
- 页面信息密度适中，优先适配 1280-1440px 小屏 PC。
- 不做炫酷 AI 风，不用紫色渐变、玻璃拟态、装饰进度条、大面积无意义 KPI。
- 所有可点击元素必须看起来可点击；不可点击状态不能做成按钮样式。

## 视觉基础

### 信息密度

组件库必须支持可配置的信息密度，避免所有产品都使用同一套字号和间距。

- Comfortable / 舒展：适合低频配置页、详情阅读页、对外演示页。字号略大、行高更松、卡片留白更多。
- Standard / 标准：默认模式，适合大多数 B2B SaaS 页面。兼顾清晰度和信息效率。
- Compact / 紧凑：适合素材库、脚本库、运营列表、批量处理等高频工作台。表格、按钮、表单字号和间距更紧凑。
- Dense / 极紧凑：适合超高频批量列表、审核台、脚本库资产管理。只用于列表和工具区，不建议用于长文阅读或对外演示。

实现规则：

- 通过容器级属性控制，例如 `data-density="comfortable|standard|compact|dense"`。
- 字号、控件高度、图标尺寸、缩略图尺寸、表格行距、卡片 padding、区块间距、弹窗 header/footer 高度、富内容弹窗视频区高度都必须跟随密度变量。
- 不允许为三种密度复制三套组件。
- 默认建议使用 Standard；素材库和脚本库可默认使用 Compact。

### 色彩

- App background: `#F6F8FC`
- Surface: `#FFFFFF`
- Surface soft: `#F8FAFD`
- Border: `#DDE5F0`
- Border subtle: `#E8EEF6`
- Graphite text: `#172033`
- Slate text: `#667085`
- Muted text: `#98A2B3`
- Primary blue: `#1266FF`
- Primary hover: `#0B55E8`
- Primary soft: `#EAF2FF`
- Success: `#0A8F68`
- Success soft: `#E7F8F1`
- Warning: `#B56A00`
- Warning soft: `#FFF3DC`
- Danger: `#D13F56`
- Danger soft: `#FFF0F3`

### 字体和字号

优先使用系统中文 UI 字体，后续如果进入正式前端组件库，可再评估是否引入 Geist / Satoshi 一类英文字体作为数字和英文补充。

- Page title: 24px / 32px, weight 800
- Section title: 18px / 26px, weight 750
- Card title: 15px / 22px, weight 750
- Body: 14px / 22px, weight 500
- Table text: 13px / 20px, weight 500
- Label: 13px / 18px, weight 650
- Helper: 12px / 18px, weight 500
- Caption: 11px / 16px, weight 700

### 圆角、边框、阴影

- 页面容器: 0
- 主面板: 12px
- 卡片: 12px
- 输入框 / Select / Tabs: 10px
- 小按钮 / 图标按钮: 8px
- Badge / Chip: 999px
- 边框统一 1px。
- 阴影只用于浮层和高层级面板，不用于所有卡片。

## AppShell

### Sidebar

- 固定左侧导航，默认宽度 184px。
- 导航分组保持简洁，优先展示核心路径。
- 当前核心导航：
  - 工作台
  - 素材库
  - 品牌活动
  - 脚本生成
  - 脚本库
  - 数据报表
  - 系统设置
- Active nav 使用 primary blue 背景或浅蓝底 + 蓝色文字，不能只靠图标区分。
- 图标必须来自同一风格，统一线宽，禁止混用 emoji、字母占位、手写 SVG。
- 用户信息优先放 Topbar。Sidebar 底部如果保留，只显示团队/系统空间，不再重复当前用户。

### Topbar

- 包含当前页面标题、全局搜索、当前用户、系统状态。
- 无功能入口先隐藏，不放假按钮。
- 当前用户菜单负责登录态、管理员全量视图、退出登录等状态。

## 基础组件

### Button

按钮类型：

- Primary: 核心动作，例如“识别并预览”“生成脚本”“保存配置”。
- Secondary: 次级动作，例如“确认下载入库”“导出”。
- Ghost: 页面内轻量操作。
- Danger: 删除、弃用、危险确认。
- Icon button: 预览、下载、更多、关闭。

规则：

- 按钮文字桌面端不换行。
- 同一操作区按钮高度一致。
- Disabled 状态必须给出原因，放在按钮旁或摘要区。
- Loading 不用大 spinner，按钮内使用短文本状态，例如“保存中...”。

### Form

- Label 必须在输入框上方，不使用 placeholder 代替 label。
- 错误信息在输入框下方。
- Helper text 用 slate，不抢主信息。
- Textarea 必须给最小高度和最大高度，弹窗内不能被遮挡。

### Tabs / Segmented Control

- Tabs 用于页面主分区。
- Segmented control 用于同一任务内的模式切换。
- 选中态使用浅蓝底或蓝色下划线，不能只靠字体粗细。

### Badge / Chip

状态标签必须语义稳定：

- 已入库: success
- 解析中: warning / blue
- 待确认: warning
- 重复素材: danger / warning
- 已采用: success
- 待改: warning
- 弃用: danger
- 优质样例: blue / violet soft

## 数据组件

### Toolbar

标准顺序：

1. 搜索
2. 主筛选
3. 辅助筛选
4. 批量操作
5. 右侧视图/导出/设置

不可点击说明文本不做成按钮样式。

### Table

通用表格要求：

- 表头背景使用极浅灰。
- 行高稳定，默认 56-64px。
- Hover 行必须清晰。
- Selected 行使用浅蓝底和左侧强调线。
- 长标题单行或两行截断，详情弹窗展示全文。
- 操作列按钮不换行，窄屏时收进“更多”菜单。
- 表格内图标按钮必须有 tooltip 或 aria-label。
- 高频平台必须使用平台品牌图标，例如抖音、小红书、视频号、快手、B 站；不能用“抖 / 红 / 快”等文字占位。低频或未知平台可使用统一的 fallback 平台图标 + 平台名。
- 1280-1440px 工作台宽度内，常规表格不应默认出现横向滚动条；优先使用固定列宽、长文本截断、次要字段收起、操作列进入“更多”菜单。只有超宽字段配置页或审计明细页才允许横向滚动。
- 表格行内的 checkbox、平台 logo、缩略图和操作图标必须使用列表专用尺寸，不能直接套用全局大图标按钮尺寸；在 Compact / Dense 模式下尤其要降低视觉权重。

素材库标准列：

- 选择
- 缩略图
- 标题
- 平台
- 品牌 / 活动
- 状态
- 标签
- 时长
- 归属用户
- 创建时间
- 操作

品牌活动标准列：

- 商品活动
- 品牌 / 渠道
- 卖点
- 活动规则
- 价格边界
- 状态
- 归属用户
- 操作

脚本库标准列：

- 脚本标题 / Hook
- 商品活动
- 参考素材
- 状态
- 质量自检
- 飞书同步
- 创建时间
- 归属用户
- 操作

## 浮层系统

默认统一使用居中 Modal，少用右侧 Drawer。

### Modal

- 最大宽度不超过 `calc(100vw - 48px)`。
- Header、Body、Footer 结构固定。
- 关闭按钮只用图标按钮，不显示“关闭”文字按钮作为 header close。
- Footer 按钮右对齐，主按钮在最右。
- 内容高度固定或设置最大高度，Tab 切换不能造成弹窗抖动。

常用 Modal：

- 素材预览
- 素材 + 脚本富内容详情
- 品牌活动新增 / 编辑
- 脚本详情
- 提示词配置
- 删除确认
- 确认入库

### RichAssetScriptModal

用于承载“视频素材 + 脚本信息 + 分析结果”的复杂详情，不和普通确认弹窗混用。典型使用场景：

- 素材库点击“预览”时查看视频、素材信息、转写文本和脚本片段。
- 脚本生成页查看本次生成脚本及其引用素材。
- 脚本库查看历史脚本资产、质量自检和操作记录。

布局规则：

- 居中大弹窗，建议宽度 960-1120px，高度不超过 `calc(100vh - 64px)`。
- 弹窗内容分为三层：Header、Content、Footer。
- Header 显示标题、来源状态、关闭图标按钮；不放大段说明。
- Content 使用左右结构或上下分区：
  - 左侧为视频 / 素材预览区。
  - 右侧为素材元数据、AI 摘要、风险检查。
  - 下方或主阅读区为脚本文本、转写文本、脚本分析。
- Footer 固定在底部，放主操作和次操作。
- Tab 切换不能改变弹窗整体高度，只切换内容区。
- 长文本区域必须可滚动，不能撑破弹窗。

推荐结构：

- VideoPreview
  - 视频封面 / 播放区域
  - 平台、时长、清晰度、文件大小
  - 下载本地、复制链接、打开原链接
- AssetMetaPanel
  - 标题
  - 平台
  - 品牌 / 活动
  - 达人 / 账号
  - 标签
  - 入库状态
  - 归属用户
- ScriptInfoPanel
  - Hook
  - 四段脚本正文
  - CTA
  - 字数 / 预计时长
  - 适配平台
- AnalysisPanel
  - AI 摘要
  - 为什么适合本次生成
  - 质量自检
  - 风险 / 水印 / 绝对化表达检查
- ReferencePanel
  - 引用素材列表
  - 引用片段
  - 相似脚本提醒
- OperationHistory
  - 生成时间
  - 采用 / 待改 / 弃用记录
  - 飞书同步状态

Tab 建议：

- 预览
- 脚本正文
- AI 分析
- 输入包
- 操作记录

操作按钮建议：

- 下载本地
- 复制脚本
- 采用
- 待改
- 弃用
- 标为优质样例
- 查看详情

状态要求：

- 视频加载中：使用视频区域骨架，不用全屏 spinner。
- 无视频：展示清晰空状态和原链接入口。
- 脚本文本为空：展示“暂无脚本正文”，并给出下一步动作。
- 风险项存在：使用 warning / danger 状态块，不能只用红字。
- 操作成功：在按钮附近显示即时状态。
- 操作失败：在对应区域显示错误原因。

### Toast / Inline Status

- 成功/失败优先放操作按钮附近作为即时反馈。
- 页面顶部不堆叠重复提示。
- Toast 只用于跨区域或异步完成的反馈。

## 业务组件

### 素材录入

组件：

- LinkInputCard
- ExcelFeishuImportCard
- ReferenceAccountCard
- MaterialPreviewModal
- RichAssetScriptModal
- ConfirmImportDialog

要求：

- 录入入口优先于统计展示。
- 统计用窄条，不占用过多首屏空间。
- “下载本地”使用视频原始 URL 或已下载文件地址。

### 品牌活动

组件：

- CampaignTable
- CampaignEditModal
- CampaignDeleteDialog
- MatrixAccountTab

要求：

- 不使用无意义占位图。
- 新增、编辑、删除确认统一居中弹窗。
- 价格边界、渠道范围、活动规则缺失时必须明确显示。

### 脚本生成

组件：

- GenerationTaskPanel
- CampaignPicker
- MaterialPicker
- SelectedInputSummary
- PromptConfigModal
- CurrentGenerationResults

要求：

- 商品活动和参考素材左右排列。
- 底部固定输入包摘要。
- 提示词配置放右上角入口，不作为每次必填区域。
- 本页保留当天生成结果，不刷新即清空。
- 生成按钮禁用时显示缺失原因。

### 脚本库

组件：

- ScriptStatusFilter
- ScriptTable
- ScriptDetailModal
- RichAssetScriptModal
- ScriptActionBar

要求：

- 历史脚本资产独立页面。
- 详情正文提升可读性，避免窄列挤压。
- Tab 必须可点击。
- 采用、待改、弃用、样例等操作清晰区分。

## 状态覆盖

每个组件至少覆盖：

- Default
- Hover
- Active / Selected
- Disabled
- Loading
- Empty
- Error
- Success
- Warning

## 后续实施顺序

1. 完成 UI Kit 视觉板确认。
2. 新增静态组件展厅：`prototype/content-ui-kit.html`。
3. 用组件展厅验证所有状态。
4. 用组件拼四页静态页面。
5. 确认后再迁移真实业务页。
