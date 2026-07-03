# Simple Agent v3.5.1 - v3.5.4 Release Notes

## 范围

本次整理的是四个连续性能版本：

- `v3.5.1` 统一加载态与处理中反馈
- `v3.5.2` 搜索防抖与过时请求取消
- `v3.5.3` 列表减载、详情按需加载、避免非必要首屏请求
- `v3.5.4` 结构级性能优化与感知速度优化

## 版本说明

### v3.5.1

- 四个页面补齐统一的列表 loading、按钮 busy、处理中提示
- 列表刷新、任务打开、状态切换、删除/保存等操作有明确反馈

### v3.5.2

- `materials` 搜索增加防抖
- `scripts` 搜索增加防抖
- `campaigns` 搜索筛选增加防抖
- `materials` 列表请求增加 `AbortController`
- `scripts` 列表请求增加 `AbortController`
- `generate` 历史任务刷新增加 `AbortController`

### v3.5.3

- `materials` 列表改为轻量接口 + 后端分页/筛选
- `materials` 详情改为抽屉打开时按需加载
- `scripts` 列表改为摘要接口，脚本详情按需加载
- `generate` 历史任务接口改为轻量结果
- `generate` 参考素材改为按需加载
- `campaigns` 首屏先加载品牌活动，矩阵号改为延迟加载

### v3.5.4

- `campaigns` 增加 idle 预取矩阵号，避免阻塞首屏
- `generate` 增加 idle 预取参考素材，避免阻塞首屏
- `materials` 分页按钮改为窗口化渲染，避免大页数时一次性渲染全部页码
- 本地开发环境统一优先走同源 `/api`

## 影响文件

- `content-center-v3.5-materials.js`
- `content-center-v3.5-scripts.js`
- `content-center-v3.5-generate.js`
- `content-center-v3.5-campaigns.js`
- `materials.html`
- `scripts.html`
- `generate.html`
- `campaigns.html`
- `scripts/prototype_api_server.py`
- `scripts/simple_agent_dev_static_server.py`

## 验证

- `node --check content-center-v3.5-materials.js`
- `node --check content-center-v3.5-scripts.js`
- `node --check content-center-v3.5-generate.js`
- `node --check content-center-v3.5-campaigns.js`

## 发布注意

- 不涉及 `.env`、ASR 服务配置、字幕服务配置、飞书配置变更
- 主要为前端加载链路、轻量接口使用方式、本地开发代理与交互反馈优化
