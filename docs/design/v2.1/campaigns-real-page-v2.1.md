# 品牌活动真实页 v2.1 快照

## 状态

当前版本作为品牌活动页第一轮真实还原基线。后续细修可以在这个版本上继续，但不能回退到旧的流程块、重复用户卡、文字图标占位和无动作按钮。

## 页面入口

```text
http://127.0.0.1:8782/prototype/simple-agent-campaigns.html?v=campaign-real-ui-kit-v1
```

## 对齐依据

```text
docs/design/content-agent-v2.1-final-alignment.md
docs/design/content-agent-v2-campaigns.png
prototype/content-v2-campaigns-static.html
prototype/content-v2-campaigns-static.css
prototype/ui-kit/v1/content-ui-kit.css
prototype/ui-kit/v1/content-ui-kit.js
```

## 本版保留

- UI Kit AppShell：Sidebar、Topbar、用户信息、状态标签。
- 顶部业务说明区：品牌活动的事实边界说明和规则自检。
- 品牌活动主体表格：商品活动、卖点、活动规则、价格边界、状态、归属用户、更新时间、操作。
- 品牌矩阵号作为同页 tab 和右侧次级区。
- 新增 / 编辑品牌活动居中弹窗。
- 删除品牌活动居中确认弹窗。
- 真实接口数据渲染，不使用静态假数据替代真实业务数据。

## 本版删除

- 旧版大 KPI 卡作为主视觉。
- “本次生成”“矩阵协同”等解释不清的流程块。
- 页面底部“本次生成输入 / 最近操作”解释型模块。
- 没有真实动作的导出、批量导入、视图设置。
- 左下角重复用户卡。
- “C / M / V”等字母图标占位。

## 验证记录

验证时间：2026-06-19

验证入口：`simple-agent-campaigns.html?v=campaign-real-ui-kit-v1`

已验证：

- `node --check prototype/simple-agent.js` 通过。
- `git diff --check` 通过。
- `1280x800` 无横向溢出。
- `1392x908` 无横向溢出。
- 真实登录态下品牌活动列表渲染 1 条真实数据。
- 删除确认弹窗可打开，宽度为 430px。
- 编辑弹窗可打开，宽度为 640px。
- 编辑弹窗隐藏旧的补充字段，不再出现额外历史字段。
- 浏览器控制台无错误。

当前截图：

```text
docs/design/v2.1/campaigns-real-page-v2.1-1392x908.png
```

## 后续规则

- 后续改品牌活动页时，先保留此版本的页面结构和组件规范，只针对用户反馈做小步修正。
- 如果要新增批量导入、历史版本、投放效果、矩阵账号自动同步，必须先进入 v2.2 或后续版本规划，不直接塞进当前真实页。
- 脚本生成和脚本库重构时，复用此页的 AppShell、表格、弹窗、状态和密度规则。
