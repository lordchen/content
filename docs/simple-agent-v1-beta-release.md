# 内容生产 Agent V1 内测版发布说明

## 版本定位

V1 内测版用于小范围验证内容生产闭环：

1. 录入参考素材
2. 录入品牌活动和商品
3. 调用 AI 服务生成脚本
4. 人工审核、采用、待改或弃用

当前版本不是公开生产版，不承诺自动发布，不绕过平台风控，不替代人工审核。

## 本地入口

- 素材库：http://127.0.0.1:8782/prototype/simple-agent-materials.html?v=simple-agent-v1-beta-auth
- 品牌活动：http://127.0.0.1:8782/prototype/simple-agent-campaigns.html?v=simple-agent-v1-beta-auth
- 脚本生成：http://127.0.0.1:8782/prototype/simple-agent-generate.html?v=simple-agent-v1-beta-auth
- API 健康检查：http://127.0.0.1:8771/api/health

## 用户体系

V1 内测版已加入最小账号体系：

- 用户表：`simple_agent_users`
- 会话表：`simple_agent_sessions`
- 登录接口：`POST /api/simple-agent/login`
- 登出接口：`POST /api/simple-agent/logout`
- 当前用户接口：`GET /api/simple-agent/session`
- 业务接口：`/api/simple-agent/*` 默认要求登录

默认内测账号：

- 账号：`admin`
- 密码：`simple-agent-v1`

可通过启动环境变量覆盖：

```bash
SIMPLE_AGENT_ADMIN_USER=admin SIMPLE_AGENT_ADMIN_PASSWORD='your-password' scripts/simple_agent_start.sh
```

说明：这是 V1 内测最小登录体系，不是完整多租户权限系统。

## 启动

```bash
scripts/simple_agent_start.sh
```

## 停止

```bash
scripts/simple_agent_stop.sh
```

## 发布前检查

```bash
node --check prototype/simple-agent.js
.venv/bin/python -m py_compile scripts/prototype_api_server.py
scripts/simple_agent_healthcheck.sh
```

## 数据备份

```bash
scripts/simple_agent_backup.sh
```

备份会写入 `backups/simple-agent-v1-beta-auth-*`，包含 SQLite 数据库、配置和 manifest。

## 发布包

```bash
scripts/simple_agent_release_pack.sh
```

发布包会写入 `releases/simple-agent-v1-beta-auth-*.tar.gz`。

## 生成链路

脚本生成按环境切换：

- 开发环境默认：`SIMPLE_AGENT_RUNTIME_ENV=development`，使用本机 Codex CLI。
- 线上发布默认：`SIMPLE_AGENT_RUNTIME_ENV=production`，使用 `image2svc` 的 `aichat-service`。
- API：`POST /api/simple-agent/generate`
- 开发配置：`SIMPLE_AGENT_GENERATOR=codex_cli`
- 线上配置：`SIMPLE_AGENT_GENERATOR=image2svc_chat`
- 线上 chat 服务：`IMAGE2SVC_CHAT_URL=http://127.0.0.1:9528`
- 线上图片服务：`IMAGE2SVC_IMAGE_URL=http://127.0.0.1:9527`

本地开发可以直接启动：

```bash
SIMPLE_AGENT_RUNTIME_ENV=development CODEX_BIN=/path/to/codex scripts/simple_agent_start.sh
```

线上发布使用：

```bash
SIMPLE_AGENT_RUNTIME_ENV=production \
SIMPLE_AGENT_GENERATOR=image2svc_chat \
SIMPLE_AGENT_IMAGE_BACKEND=image2svc \
IMAGE2SVC_CHAT_URL=http://127.0.0.1:9528 \
IMAGE2SVC_IMAGE_URL=http://127.0.0.1:9527 \
scripts/simple_agent_start.sh
```

失败策略：

- 生成器未配置或不可用：直接报错
- 开发环境找不到 `CODEX_BIN`：直接报错
- Codex CLI 或 image2svc 调用失败：直接报错
- 返回不是 JSON：直接报错
- 没有 `scripts`：直接报错
- 脚本数量不等于目标数量：直接报错
- 每条脚本不是 4 个镜头：直接报错
- 必填字段缺失：直接报错

## 飞书脚本库同步

V1 内测版支持“采用并入飞书”：

1. 用户在脚本结果里点击“采用并入飞书”。
2. 系统先把本地脚本审核状态改为 `adopted`。
3. 后端调用 `lark-cli base +record-batch-create`。
4. 脚本按日期、品牌、分类写入飞书多维表格脚本库。
5. 同步成功后，本地保存 `feishu_record_id` 和同步时间。
6. 同步失败时，页面显示错误，本地保存失败原因。

需要先配置脚本库目标。任选一种方式：

```bash
SIMPLE_AGENT_SCRIPT_LIBRARY_URL='https://xxx.feishu.cn/base/...?table=tblxxxx' scripts/simple_agent_start.sh
```

或：

```bash
SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN='basexxxx' SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID='tblxxxx' scripts/simple_agent_start.sh
```

脚本库建议字段：

- 本地脚本ID
- 日期
- 品牌
- 分类
- 主题
- 标题
- 开头钩子
- 脚本正文
- CTA
- 质量分
- 审核状态
- 是否优质样例
- 质量说明
- 审核备注
- 商品活动
- 活动规则
- 价格说明
- 渠道范围
- 参考素材
- 参考账号
- 素材平台
- 素材链接
- 生成方式
- 创建时间
- 更新时间

当前本机 `lark-cli` 已配置，但如果 `lark-cli auth status` 显示 `tokenStatus=needs_refresh`，需要先重新登录：

```bash
lark-cli auth login
```

## 内测验收口径

内测通过条件：

- 运营能独立完成一轮素材录入、活动录入、脚本生成和审核
- 生成失败时页面能看到明确错误
- 生成脚本能追溯输入素材和活动
- 审核状态能保存
- 数据可备份和恢复

内测不通过条件：

- 页面无法启动或频繁断服务
- 生成服务失败后仍出现伪生成结果
- 输入缺失时仍然生成脚本
- 用户无法判断脚本来自哪些素材和商品
- 审核结果无法保存

## 当前限制

- 当前为本地原型，只有最小账号登录，没有完整团队、角色权限和审计日志。
- 对外访问前必须更换默认密码，并补充部署层鉴权和访问控制。
- 数据库存储为 SQLite，适合小范围内测，不适合多人高并发。
- 生成内容必须人工审核后才能发布。
- 参考素材只学习结构，不允许直接复制原视频表达。
