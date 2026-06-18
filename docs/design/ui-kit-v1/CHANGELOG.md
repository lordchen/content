# Content Ops UI Kit Changelog

## v1.0.0 - 2026-06-18

### 定位

冻结第一版 Content Ops UI Kit，作为内容生产 Agent / 内容中台的前端组件和 UI 规范基线。

### 新增

- AppShell 基础框架：
  - Sidebar
  - Topbar
  - Brand
  - UserMenu
  - SystemStatus
- 四档 density：
  - Comfortable
  - Standard
  - Compact
  - Dense
- 基础组件：
  - Button
  - IconButton
  - Input
  - Select
  - Textarea
  - Checkbox
  - Badge
  - UploadDropzone
- 数据组件：
  - DataToolbar
  - DataTable
  - RowActionGroup
  - Pagination
  - Skeleton
- 平台图标组件：
  - Douyin
  - Xiaohongshu
  - WeChat Channels
  - Kuaishou
  - Bilibili
- 弹窗组件：
  - 普通编辑弹窗
  - 删除确认弹窗
  - RichAssetScriptModal
- 业务组件示例：
  - 链接录入
  - Excel / 飞书导入
  - 选择商品活动
  - 选择参考素材
  - 已选输入包
- 规范文档：
  - `content-ui-kit-spec-v1.md`
  - `content-agent-v2-restoration-checklist.md`
  - `VERSIONING.md`

### 已修正

- 平台标识从“抖 / 红”等文字占位改为品牌图标组件。
- 表格行内图标、平台 logo、checkbox、缩略图改为列表专用尺寸。
- 常规表格在 1280-1440px 范围内不默认横向滚动。
- Density 不只控制字体，也控制高度、间距、图标、缩略图、弹窗和视频区域。
- 富内容弹窗通过 `body[data-density]` 继承密度变量。

### 验证

已验证：

- `1280x800`
- `1366x768`
- `1392x908`
- `1440x900`

验证项：

- 无控制台错误。
- 无资源加载失败。
- 表格无横向溢出。
- Density 切换可用。
- Density 刷新后可保留。
- 平台图标正常注入。
- RichAssetScriptModal 可打开，tab 可切换。

### 已知边界

- 当前仍是静态组件展厅，不接真实业务接口。
- 当前图标为原型内 SVG 近似标识，正式生产可替换为授权品牌图标资源。
- 当前没有拆成工程化组件包；后续可拆为 `tokens.css / components.css / business-components.css` 或 React 组件库。
- 四页真实业务页面尚未迁移，后续需要按四张设计稿做静态模板，再迁移真实页面。

### 稳定入口

```text
http://127.0.0.1:8782/prototype/ui-kit/v1/index.html
```

