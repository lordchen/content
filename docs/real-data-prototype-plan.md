# 真实数据驱动原型计划

## 当前已完成

原型已经从纯前端 mock 改成优先读取真实导出数据：

- [prototype/data.js](/Users/lei/Documents/contentwork/prototype/data.js)
- [scripts/export_prototype_data.py](/Users/lei/Documents/contentwork/scripts/export_prototype_data.py)

当前数据来源：

- 品牌信息：`configs/brands/adidas_tuan_gou_douyin.json`
- 抖音总热榜：`hot_search_runs` / `hot_search_items`
- 对标账号池：`benchmark_accounts`
- 候选脚本：`daily_script_candidates`
- 对标字幕结构：`benchmark_video_subtitles`

导出命令：

```bash
npm run prototype:export
```

当前页面打开时会加载：

```html
<script src="./data.js"></script>
```

所以页面上的品牌、热榜、对标结构和脚本候选已经不再完全依赖前端写死数据。

## 当前真实范围

### 已真实

- 抖音总热榜采集
- 热榜入库
- 品牌配置读取
- 对标账号池入库
- 脚本候选读取
- 原型页面读取真实导出数据
- 运营勾选入库
- 小样本真实闭环：已选热点 + 已选对标结构 -> 结构摘要记录 -> 候选脚本入库 -> 页面读取

### 半真实

- 对标视频字幕链路已经有脚本和表，但还需要填真实 `video_url`
- 当前结构摘要先基于真实热榜和真实对标账号池元数据生成，明确标记“待字幕”

### 仍是模拟

- 没有真实视频链接前，字幕文本本身不模拟
- 算法仍是原型规则，未接大模型和真实字幕结构

## 下一阶段

### V1.1 数据闭环

目标：页面选择结果能落库。

已补上：

- `operator_video_selections`
- 保存热点视频选择
- 保存对标视频选择
- 重新导出页面数据

运行方式：

```bash
npm run prototype:api
```

然后打开原型页面。勾选热点或对标视频时，会写入本地 SQLite：

```bash
data/contentwork.db
```

如果页面显示“保存服务未连接，仅页面预览”，说明当前只是前端预览，勾选不会入库。

重新导出页面数据：

```bash
npm run prototype:export
```

导出后刷新页面，已保存的运营选择会恢复。

### V1.1.1 小样本真实闭环

目标：数据可以少，但链路必须闭环。

已补上：

- `operator_selection_confirmations`
- `prototype_generation_runs`
- `prototype_structure_summaries`
- `POST /api/confirm-selection`
- `POST /api/generate`
- 先确认选择，生成固定输入快照
- 再用已确认热点、对标结构和品牌信息调用 Codex CLI 生成候选脚本
- 写入 `daily_script_candidates`
- 自动执行 `prototype:export`

页面操作顺序已经改为四步：

1. 选择热点或对标视频。可以只选热点，也可以只选对标。
2. 选择品牌。当前已接入 `adidas阿迪达斯团购号` 的真实品牌配置。
3. 确认输入并生成脚本。确认后会固化输入快照，生成只读取确认快照。
4. 到脚本列表查看结果。脚本以 15 秒分镜、口播、字幕、拍摄注意事项展示。

兜底规则：

- 只选热点时，使用品牌自有 `门店种草` 结构兜底。
- 只选对标时，使用 `品牌日常选题` 兜底。
- 同时选择热点和对标时，脚本会同时引用两类真实输入。

生成方式：

- 当前优先调用本机 `codex exec --output-last-message` 生成 JSON 脚本。
- 写入库时 `candidate_level = codex_cli`。
- 页面会显示生成状态：调用中、Codex CLI 成功、或 Codex CLI 失败后使用本地规则兜底。
- 如果 Codex CLI 调用失败，系统会使用本地规则兜底，并在接口返回、页面提示和 `fit_reason` 里记录失败原因。

当前已验证的小样本：

- 热点：`直击高考首日`
- 对标：`阿迪达斯官方旗舰店 / 新品发布`
- 结构摘要：2 条，状态为 `metadata_ready`
- 候选脚本：5 条，来源均可追溯到真实热榜、真实对标池和确认快照

### V1.2 字幕任务闭环

目标：运营选择对标视频后能触发字幕提取。

需要新增：

- 字幕任务状态
- 调用 `video-tools /api/subtitle`
- 保存字幕文本
- 保存结构摘要

### V1.3 脚本生成闭环

目标：脚本候选由真实结构摘要生成。

需要新增：

- 脚本生成任务表
- 算法参数持久化
- 生成结果入库
- 页面读取最新候选脚本

### V1.4 后端化

目标：不再靠手动导出 `data.js`。

建议用 FastAPI 或 Next.js Route Handlers 提供：

- `GET /api/dashboard`
- `POST /api/selections`
- `POST /api/subtitle-jobs`
- `POST /api/script-candidates`

## 最近一步建议

先做 V1.1：把页面运营勾选结果保存到 SQLite。

原因：

- 不依赖抖音搜索页
- 不依赖 ASR key
- 能把产品从“可看原型”推进到“可操作系统”
