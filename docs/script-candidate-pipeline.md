# 脚本候选主链

## 当前目标

先绕开抖音搜索验证码问题，搭一条稳定主链：

- 抖音总热榜
- 品牌规则
- 固定对标账号池
- 每日脚本候选库

## 当前输入

### 1. 热榜输入

来自：

- `hot_search_items`
- `brand_hot_candidates`

### 2. 品牌输入

来自：

- [configs/brands/adidas_tuan_gou_douyin.json](/Users/lei/Documents/contentwork/configs/brands/adidas_tuan_gou_douyin.json)

### 3. 对标账号输入

当前先用品牌配置里的固定账号池：

- 官方品牌账号
- 本地团购服饰账号
- 球鞋穿搭账号

后面再接真实账号内容抓取。

## 输出

脚本：

- [scripts/generate_daily_script_candidates.py](/Users/lei/Documents/contentwork/scripts/generate_daily_script_candidates.py)

运行命令：

```bash
npm run scripts:generate
```

输出位置：

- `data/generated/daily_script_candidates/`

数据库表：

- `benchmark_accounts`
- `daily_script_candidates`

## 当前定位

这版不是最终脚本生成器，而是稳定主链的骨架。

它先解决：

- 不依赖抖音搜索页也能产出候选
- 对标账号池有固定结构
- 热榜、品牌、对标三块能进同一个脚本候选层
