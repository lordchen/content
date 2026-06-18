# 抖音采集管道运行说明

## 当前已跑通

当前抖音链路已经支持：

- 抖音总热榜采集
- 原始 JSON 落盘
- 标准化 JSON 落盘
- SQLite 入库
- 品牌第一轮筛选
- 品牌候选池输出

入口脚本：

- [scripts/fetch_douyin_hot_search.py](/Users/lei/Documents/contentwork/scripts/fetch_douyin_hot_search.py)
- [scripts/run_douyin_pipeline.sh](/Users/lei/Documents/contentwork/scripts/run_douyin_pipeline.sh)

## 数据位置

- 原始数据：`data/raw/douyin_hot_search/`
- 标准化数据：`data/normalized/douyin_hot_search/`
- 品牌候选结果：`data/filtered/douyin_hot_search/`
- 数据库：`data/contentwork.db`

## 数据表

### `hot_search_runs`

记录每次抖音热榜采集 run。

### `hot_search_items`

记录每次 run 的全部热榜条目。

### `brand_hot_candidates`

记录按品牌配置筛选后的候选结果。

## 建议定时

根据飞书文档里的运营节奏，建议先跑两轮：

- `10:30` 首轮
- `15:00` 二轮

示例 crontab：

```cron
30 10 * * * /bin/zsh /Users/lei/Documents/contentwork/scripts/run_douyin_pipeline.sh >> /Users/lei/Documents/contentwork/data/douyin_pipeline.log 2>&1
0 15 * * * /bin/zsh /Users/lei/Documents/contentwork/scripts/run_douyin_pipeline.sh >> /Users/lei/Documents/contentwork/data/douyin_pipeline.log 2>&1
```

## 当前边界

当前拿到的是：

- 抖音总热榜

当前还没稳定拿到的是：

- 抖音登录态搜索结果
- 类目词搜索结果
- 对标账号内容流

原因不是脚本没写，而是抖音搜索内容接口当前会直接要求登录。

## 下一阶段

下一步应该拆成两条：

### 1. 保持总热榜自动化稳定运行

这是当前已经真实可用的链路。

### 2. 补浏览器态类目采集

目标词：

- 团购
- 本地
- 服装
- 阿迪达斯
- 穿搭
- 球鞋
- 商场活动

这部分更可能要走浏览器态、登录态或账号侧采集，而不是裸接口。
