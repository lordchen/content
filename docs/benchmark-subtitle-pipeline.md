# 对标视频字幕接入链路

## 目标

把之前 `video-tools` 项目的抖音解析和字幕提取能力接进当前脚本库系统。

新的链路是：

`对标视频链接 -> video-tools /api/subtitle -> 字幕文本 -> 结构摘要 -> 脚本生成器`

## 当前文件

- [configs/benchmark_video_samples.json](/Users/lei/Documents/contentwork/configs/benchmark_video_samples.json)
- [scripts/extract_benchmark_video_subtitles.py](/Users/lei/Documents/contentwork/scripts/extract_benchmark_video_subtitles.py)

## 前置条件

先启动旧项目的后端：

```bash
cd /Users/lei/Documents/video-tools
source .venv/bin/activate
export PYTHONPATH=backend
uvicorn main:app --host 127.0.0.1 --port 8000
```

检查：

```bash
curl http://127.0.0.1:8000/api/health
```

## 使用方式

先在 [benchmark_video_samples.json](/Users/lei/Documents/contentwork/configs/benchmark_video_samples.json) 里填写 `video_url`。

然后运行：

```bash
npm run benchmarks:subtitles
```

输出位置：

- `data/extracted/benchmark_subtitles/`

数据库表：

- `benchmark_video_samples`
- `benchmark_video_subtitles`

## 当前结构摘要

第一版结构摘要会提取：

- 开头 3 句
- CTA 相关句子
- 商品/门店/穿搭相关句子
- 粗分类脚本结构

后续可以再升级为：

- 高频开头模板
- 高频转化话术
- 优惠表达模板
- 口播节奏模板
