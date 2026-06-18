# Content Ops UI Kit v1

## 这是什么

这是“内容生产 Agent / 内容中台”的前端组件和 UI 规范 v1 快照，用于团队后续重构素材库、品牌活动、脚本生成、脚本库，以及新的内容运营系统。

这个版本是可稳定引用的设计系统基线，不再直接跟随 `prototype/content-ui-kit.html` 的后续试验改动。

## 预览入口

本地服务启动后打开：

```text
http://127.0.0.1:8782/prototype/ui-kit/v1/index.html
```

当前工作稿入口：

```text
http://127.0.0.1:8782/prototype/content-ui-kit.html
```

团队评审和开发引用优先使用 v1 快照入口。

## 文件

```text
prototype/ui-kit/v1/index.html
prototype/ui-kit/v1/content-ui-kit.css
prototype/ui-kit/v1/content-ui-kit.js
docs/design/ui-kit-v1/README.md
docs/design/ui-kit-v1/CHANGELOG.md
docs/design/ui-kit-v1/VERSIONING.md
docs/design/ui-kit-v1/content-ui-kit-spec-v1.md
docs/design/ui-kit-v1/content-agent-v2-restoration-checklist.md
```

## 覆盖范围

基础框架：

- AppShell
- Sidebar
- Topbar
- UserMenu
- SystemStatus

基础组件：

- Button
- IconButton
- Input
- Select
- Textarea
- Checkbox
- Segmented density switch
- Badge / Chip
- UploadDropzone

数据组件：

- DataToolbar
- DataTable
- RowActionGroup
- PlatformLogo
- Pagination
- Skeleton
- EmptyState 规范

弹窗：

- 普通编辑弹窗
- 删除确认弹窗
- RichAssetScriptModal
- Toast / InlineStatus

业务组件：

- 链接录入
- Excel / 飞书导入
- 选择商品活动
- 选择参考素材
- 已选输入包

## Density 配置

组件库支持四档密度：

```html
<div class="kit-app" data-density="comfortable">
<div class="kit-app" data-density="standard">
<div class="kit-app" data-density="compact">
<div class="kit-app" data-density="dense">
```

规则：

- `comfortable`：详情阅读、配置页、演示页。
- `standard`：默认 B2B SaaS 页面。
- `compact`：素材库、脚本库、运营列表。
- `dense`：超高频审核台、批量处理、资产管理。

Density 不只控制字体，也控制按钮高度、输入框高度、图标尺寸、缩略图尺寸、表格行距、卡片留白、弹窗高度和视频预览区高度。

## 平台图标

平台图标统一使用：

```html
<span class="platform-logo" data-platform="douyin"></span>
<span class="platform-logo" data-platform="xhs"></span>
<span class="platform-logo" data-platform="wechat"></span>
<span class="platform-logo" data-platform="kuaishou"></span>
<span class="platform-logo" data-platform="bilibili"></span>
```

不要再使用“抖 / 红 / 快”等文字占位。

## 开发使用方式

短期：

1. 真实页面先不要直接复制整页 HTML。
2. 从 `content-ui-kit.css` 中抽取 token 和组件 class。
3. 先迁移 AppShell、Button、Input、Table、Modal。
4. 再迁移素材库、品牌活动、脚本生成、脚本库业务组件。

中期：

1. 如果项目继续保持原生 HTML/CSS/JS，则把 `content-ui-kit.css` 拆成：
   - `tokens.css`
   - `app-shell.css`
   - `components.css`
   - `business-components.css`
2. 如果迁移到 React，则把本版本作为视觉和交互基准，组件按同名拆分。

## 版本规则

详细规则见：

```text
docs/design/ui-kit-v1/VERSIONING.md
docs/design/ui-kit-v1/CHANGELOG.md
```

简化规则：

- `v1`：当前冻结版本，只做严重 bug 修复，不随意改视觉方向。
- `v1.0.x`：修 bug，不改组件结构。
- `v1.1`：补组件状态、小范围新增能力。
- `v2`：视觉方向、组件结构或 density 系统发生明显调整时再开。

新增版本时不要覆盖：

```text
prototype/ui-kit/v1/
docs/design/ui-kit-v1/
```

应新建：

```text
prototype/ui-kit/v1.1/
docs/design/ui-kit-v1.1/
```

## 持续升级流程

1. 日常改动先进入工作稿：

```text
prototype/content-ui-kit.html
prototype/content-ui-kit.css
prototype/content-ui-kit.js
```

2. 自测通过后，再冻结新版本快照。
3. 每次冻结必须更新 `CHANGELOG.md`。
4. 如果影响组件命名、密度系统或页面迁移方式，必须更新 `VERSIONING.md` 和组件规范。
5. 业务页面只引用稳定快照，不直接跟随工作稿。

## 四页还原

后续页面重构必须同时参考：

```text
docs/design/content-agent-v2-materials.png
docs/design/content-agent-v2-campaigns.png
docs/design/content-agent-v2-generate.png
docs/design/content-agent-v2-scripts.png
docs/design/ui-kit-v1/content-agent-v2-restoration-checklist.md
```

组件库提供组件规范，四张页面设计稿决定页面布局。

## 页面模板

第一张基于 UI Kit v1 的业务静态模板：

```text
prototype/content-v2-materials-static.html
prototype/content-v2-materials-static.css
```

第二张基于 UI Kit v1 的业务静态模板：

```text
prototype/content-v2-campaigns-static.html
prototype/content-v2-campaigns-static.css
```

预览地址：

```text
http://127.0.0.1:8782/prototype/content-v2-materials-static.html
http://127.0.0.1:8782/prototype/content-v2-campaigns-static.html
```

使用规则：

1. 静态模板只放示例数据，不接真实接口。
2. 页面级样式写在独立 CSS 中，不直接修改 `prototype/ui-kit/v1/`。
3. 真实业务页迁移时，先对齐静态模板结构，再保留现有接口和业务逻辑。
4. 后续品牌活动、脚本生成、脚本库也按同样方式先产出静态模板，再迁移真实页面。

## 响应式约束

Topbar 右侧操作区必须有收缩策略：

1. 搜索框允许缩短，但不能把用户按钮挤出视口。
2. 用户按钮必须限制最大宽度，姓名和角色用单行截断。
3. 1280-1440px 视口必须检查右侧按钮、头像、状态标签是否溢出。
4. 如果空间不足，优先隐藏低频信息，例如角色副标题，而不是让文字超出。

页面模板验收时至少检查：

```text
1280x800
1366x768
1392x908
1440x900
```

每个视口至少验证 `compact / standard / dense` 三档密度：

1. 页面 `scrollWidth` 必须等于视口宽度，不允许横向溢出。
2. 搜索框、按钮、用户菜单文字必须垂直居中。
3. 表格操作列不能遮挡或顶出右边界。
4. 弹窗必须在视口内，tab 可点击，Esc 可关闭。
5. 控制台不能有错误，平台图标必须正常渲染。
