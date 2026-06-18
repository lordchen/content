# Content Ops UI Kit 版本管理规则

## 目标

UI Kit 是长期维护的产品基础设施。任何页面重构、组件调整、密度调整、平台图标补充，都应该先进入 UI Kit，再同步到业务页面，避免不同页面各自散改。

## 文件分层

### 工作稿

```text
prototype/content-ui-kit.html
prototype/content-ui-kit.css
prototype/content-ui-kit.js
```

用途：

- 日常试验。
- 处理评审反馈。
- 验证新组件、新状态、新密度。
- 不作为团队稳定引用入口。

### 稳定快照

```text
prototype/ui-kit/v1/
docs/design/ui-kit-v1/
```

用途：

- 团队引用。
- 页面重构基线。
- 设计和开发对齐。
- 版本验收和回滚。

## 版本号规则

### Patch

示例：`v1.0.1`

适用：

- 修文案错别字。
- 修明显错位。
- 修控制台错误。
- 修平台图标尺寸。
- 不改变组件 API、不改变视觉方向。

### Minor

示例：`v1.1`

适用：

- 新增组件状态。
- 新增业务组件。
- 新增平台图标。
- 补充 density token。
- 改善表格、弹窗、Toast、Empty、Loading 等交互细节。
- 兼容 v1 页面迁移。

### Major

示例：`v2`

适用：

- 改整体视觉语言。
- 改 AppShell 结构。
- 改核心颜色 / 字体系统。
- 改 density 系统。
- 改组件命名或组件结构。
- 需要业务页面按新规则重新适配。

## 升级流程

1. 在工作稿中修改：

```text
prototype/content-ui-kit.html
prototype/content-ui-kit.css
prototype/content-ui-kit.js
```

2. 自测通过：

```text
1280x800
1366x768
1440x900
```

3. 生成或更新截图：

```text
docs/design/ui-kit-v{version}/
```

4. 更新文档：

```text
README.md
CHANGELOG.md
VERSIONING.md
content-ui-kit-spec-v{version}.md
```

5. 冻结快照：

```text
prototype/ui-kit/v{version}/
docs/design/ui-kit-v{version}/
```

6. 通知业务页面迁移范围。

## 发布前检查

每次发布 UI Kit 新版本前必须检查：

- 页面无控制台错误。
- 资源路径无 404。
- 1280x800 无横向溢出。
- 常规表格无横向滚动条。
- Density 四档可切换并可保存。
- AppShell、Table、Modal、RichAssetScriptModal 可正常交互。
- 平台图标无文字占位。
- 弹窗高度受控，tab 切换不抖动。
- 按钮不换行、不贴边、不遮挡。
- 长文本列表中截断，弹窗中展示全文。

## 回滚规则

如果新版本影响业务页面：

1. 业务页面先回到上一稳定 UI Kit 版本。
2. 问题在工作稿中修复。
3. 修复后发布 patch 或 minor 版本。
4. 不直接覆盖旧版本目录。

## 禁止事项

- 禁止直接覆盖 `prototype/ui-kit/v1/`。
- 禁止业务页面私自新增一套按钮、表格、弹窗样式。
- 禁止用文字代替高频平台图标。
- 禁止常规表格默认横向滚动。
- 禁止无功能按钮、临时标签、占位图进入稳定快照。

