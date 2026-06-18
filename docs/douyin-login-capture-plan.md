# 抖音登录态采集方案

## 目标

为抖音类目词搜索和后续对标账号采集建立稳定的登录态浏览器方案。

## 设计原则

- 只做一次人工登录
- 后续脚本复用本地浏览器 profile
- 登录态失效时显式报错，不偷偷降级成匿名抓取
- profile 和认证状态都只保留在本地，不入 git

## 当前文件

- [scripts/douyin_login_init.js](/Users/lei/Documents/contentwork/scripts/douyin_login_init.js)
- [scripts/douyin_category_capture.js](/Users/lei/Documents/contentwork/scripts/douyin_category_capture.js)

## 使用方式

### 1. 初始化登录态

```bash
npm run douyin:login
```

会打开本地 Chrome 持久化 profile。你手动完成抖音登录后，回到终端按回车，脚本会保存：

- 浏览器 profile：`data/browser-profiles/douyin-auth/`
- storage state：`data/auth/douyin-storage-state.json`

### 2. 运行类目采集

```bash
npm run douyin:category
```

当前这一步先验证：

- 是否成功复用登录态
- 是否能进入类目词搜索页
- 页面里是否仍然要求登录

输出目录：

- `data/browser-captures/douyin-category/`

默认只跑前 `3` 个词，避免一次请求过多触发风控。

如果你想手动指定：

```bash
node scripts/douyin_category_capture.js --query 阿迪达斯
```

或者：

```bash
node scripts/douyin_category_capture.js --queries 阿迪达斯,团购,穿搭
```

### 3. 遇到验证码时的人工验证模式

```bash
npm run douyin:category:headed
```

这个模式会：

- 打开可见浏览器
- 先自动等待和重试
- 只有首个查询确实卡住时才暂停
- 等你手工完成验证
- 你回终端按回车后继续同一轮采集
- 后续查询优先复用已经通过的会话
- 结束时刷新保存登录态

## 当前阶段说明

这版还不是最终结构化搜索结果采集器。

它先做两件更关键的事：

1. 把登录态复用机制跑通
2. 把类目词搜索页面真实拿回来

等这一步稳定后，再继续做：

- 搜索结果结构提取
- 对标账号列表提取
- 同账号近期内容提取
