# 热榜采集 + 对标账号 + 每日脚本库系统方案

## 1. 先把目标说清楚

你现在真正要的不是“AI 内容系统”这个大概念，而是一个每天稳定产出脚本方向的系统。

最小闭环应该是：

1. 采集抖音热榜
2. 采集小红书热榜
3. 采集对标账号近期高表现内容
4. 结合品牌信息和类目做过滤与重写
5. 生成当天的脚本库

所以系统的主链路应当是：

`热榜池 + 对标账号池 + 品牌知识库 -> 选题判断 -> 脚本库`

## 2. 为什么这条链路要先做

因为它最贴近真实内容团队每天的工作流。

团队每天真正关心的是：

- 今天平台上什么在热
- 同类账号最近什么结构跑得动
- 哪些内容适合我们品牌做
- 今天能不能直接出 5-10 条脚本方向

这比一开始做素材识别、剪辑编排、成片工作流更关键。

## 3. 系统的四个核心模块

### 1. 品牌知识库

作用：

- 约束生成结果不能跑偏
- 让系统知道“什么能说，什么不能说”

建议字段：

- `brand_name`
- `category`
- `sub_category`
- `target_audience`
- `brand_tone`
- `core_products`
- `core_selling_points`
- `taboo_words`
- `forbidden_claims`
- `preferred_script_styles`
- `reference_accounts`

### 2. 热榜采集层

覆盖平台：

- 抖音热榜
- 小红书热榜

建议采集对象：

- 榜单标题
- 热度值
- 标签/话题
- 上榜时间
- 关联类目
- 平台
- 原始链接

这里不要只存“榜单名字”，而要存可用于后续判断的结构化信息。

### 3. 对标账号采集层

采集对象不是账号主页这么简单，而是“账号最近什么结构有效”。

建议字段：

- `account_name`
- `platform`
- `category`
- `persona`
- `content_pillars`
- `recent_top_posts`
- `high_frequency_hooks`
- `high_frequency_formats`
- `cta_patterns`
- `posting_rhythm`

V1 最关键的是把“最近高表现内容”的结构提取出来，而不是只保存链接。

### 4. 每日脚本库生成层

输入：

- 品牌信息
- 类目信息
- 今日热榜
- 对标账号近期结构

输出：

- 今日建议选题
- 每条脚本的 hook
- 核心结构
- 平台建议
- 适用产品
- 风险提示
- 来源依据

## 4. V1 的最小数据流

### Step 1：抓热榜

每天定时抓：

- 抖音热榜候选
- 小红书热榜候选

先进入 `trend_candidates`。

### Step 2：抓对标账号

每天抓一轮重点对标账号：

- 新发内容
- 高互动内容
- 标题结构
- 开头结构

进入 `benchmark_posts` 和 `benchmark_patterns`。

### Step 3：品牌匹配

用品牌类目和禁区规则筛掉不适合的热点。

例如：

- 热点很热，但类目不匹配
- 热点可借结构，但不能借表述
- 账号结构适合，但语气不适合品牌

### Step 4：脚本生成

对每个有效候选生成脚本卡：

- `script_title`
- `hook`
- `outline`
- `platform`
- `source_trend`
- `source_benchmark_account`
- `fit_reason`
- `risk_notes`

### Step 5：脚本库输出

最终每天沉淀成：

- 今日首推脚本 3 条
- 今日候选脚本 5-10 条
- 每条脚本都带来源和适配理由

## 5. 推荐的页面结构

### 1. 每日看板

今天最重要的总览：

- 今日热榜数量
- 今日新增对标内容
- 过滤后可用选题数
- 已生成脚本数
- 今日首推 3 条

### 2. 热榜池

支持：

- 按平台筛选
- 按类目筛选
- 按热度排序
- 手工标记“可借”“不相关”“待观察”

### 3. 对标账号池

支持：

- 账号分组
- 平台分组
- 最近爆文列表
- 常用开头结构
- 常用 CTA 结构

### 4. 品牌中心

支持：

- 品牌画像
- 类目
- 禁用词
- 话术红线
- 产品卖点
- 推荐风格

### 5. 每日脚本库

支持：

- 查看今日全部脚本卡
- 标记首推
- 复制到脚本工作流
- 回填“已采用/未采用/表现如何”

## 6. 数据表建议

### `brands`

- `id`
- `brand_name`
- `category`
- `sub_category`
- `audience`
- `tone`
- `selling_points_json`
- `taboo_words_json`
- `forbidden_claims_json`

### `trend_candidates`

- `id`
- `platform`
- `title`
- `topic`
- `heat_score`
- `published_at`
- `source_url`
- `category_guess`
- `raw_payload_json`

### `benchmark_accounts`

- `id`
- `platform`
- `account_name`
- `category`
- `persona`
- `profile_url`

### `benchmark_posts`

- `id`
- `account_id`
- `platform`
- `title`
- `hook`
- `format_type`
- `engagement_score`
- `published_at`
- `source_url`

### `script_cards`

- `id`
- `brand_id`
- `date`
- `platform`
- `script_title`
- `hook`
- `outline`
- `fit_reason`
- `risk_notes`
- `trend_candidate_id`
- `benchmark_post_id`
- `status`

## 7. 采集层怎么分阶段做

## V0

目标：

- 先把产品结构定清楚
- 用 mock 数据验证脚本库长什么样

技术：

- 静态前端原型
- 本地 mock 数据

## V1

目标：

- 接入真实热榜采集
- 接入真实对标账号采集
- 每天自动生成脚本库

技术建议：

- 前端：Next.js
- 后端：FastAPI 或 Next.js Route Handlers
- 数据库：PostgreSQL
- 定时任务：cron / queue worker
- 抓取层：独立采集 worker

## V2

目标：

- 增加脚本评分
- 增加历史表现回灌
- 增加品牌风格学习

## 8. 生成脚本时必须保留的判断层

不能把“热榜 + LLM”直接变成脚本。

中间至少要有三层判断：

### 1. 类目匹配

这个热点是不是和品牌类目相关。

### 2. 品牌适配

这个表达方式、冲突点、语气是否适合品牌。

### 3. 平台改写

同一个主题在抖音和小红书不能直接共用一套写法。

所以系统输出不应该是一个统一脚本，而应该至少带：

- 平台建议
- 风格建议
- 风险提示

## 9. 这次原型在演示什么

这次 [prototype/index.html](/Users/lei/Documents/contentwork/prototype/index.html) 演示的是：

- 品牌信息如何约束结果
- 热榜池和对标账号池如何成为脚本来源
- 系统如何生成“今日脚本库”

它不是最终 UI，而是先验证你要的核心逻辑是否正确。

## 10. 下一步最合理的开发顺序

1. 确认品牌字段和脚本卡字段
2. 确认热榜池和对标账号池的必要字段
3. 我把原型升级成真实 Web 后台
4. 接第一版真实采集器
5. 接每天自动生成脚本库
