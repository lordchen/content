# Simple Agent v3.4 发布准备清单

v3.4 是新的正式入口，旧版页面保留在独立旧版本入口。

## 页面入口

- 素材库：`/prototype/simple-agent-v3.4-materials.html`
- 品牌活动：`/prototype/simple-agent-v3.4-campaigns.html`
- 脚本生成：`/prototype/simple-agent-v3.4-generate.html`
- 脚本库：`/prototype/simple-agent-v3.4-scripts.html`
- 旧版本集合：`/prototype/v1/index.html`

## 环境切换规则

启动、screen 启动、LaunchAgent 启动和健康检查统一通过 `scripts/simple_agent_env.sh` 读取配置：

- 先读取 `.env`。
- 如果 `SIMPLE_AGENT_RUNTIME_ENV` 或 `APP_ENV` 是 `prod`、`production`、`server`、`release`，再读取 `.env.production`。
- 其他情况读取 `.env.development`。
- GitHub 发布脚本会把服务器共享配置链接为当前 release 的 `.env.production`。

服务器建议把真实配置放在：

```bash
/home/appadmin/content-agent/shared/content-agent.env
```

并由发布脚本链接到：

```bash
/home/appadmin/content-agent/current/.env.production
```

## 正式环境必须配置

参考模板：`configs/simple-agent-production-env.template`。

必填项：

- `SIMPLE_AGENT_RUNTIME_ENV=production`
- `SIMPLE_AGENT_ADMIN_USER`
- `SIMPLE_AGENT_ADMIN_PASSWORD`
- `SIMPLE_AGENT_GENERATOR=image2svc_chat`
- `IMAGE2SVC_CHAT_URL`
- `SIMPLE_AGENT_IMAGE_BACKEND=image2svc`
- `IMAGE2SVC_IMAGE_URL`
- `SUBTITLE_ENGINE=auto`
- `ASR_API_KEY`
- `ASR_API_URL`
- `ASR_MODEL`
- `LARK_CLI_BIN`
- `SIMPLE_AGENT_SCRIPT_LIBRARY_URL`，或同时配置 `SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN` 与 `SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID`

## 飞书授权

正式服务器上的飞书 CLI 授权与本机开发授权相互独立。服务器需要用正式账号在服务器本机完成授权。

需要的 scopes：

```bash
base:app:create base:app:update base:table:read base:table:create base:field:read base:field:create base:field:update base:view:write_only base:record:read base:record:create base:record:update
```

检查授权：

```bash
$LARK_CLI_BIN auth check --scope "base:app:create base:app:update base:table:read base:table:create base:field:read base:field:create base:field:update base:view:write_only base:record:read base:record:create base:record:update"
```

## 发布前本地检查

```bash
node --check prototype/simple-agent.js
node --check prototype/simple-agent-v3.4-materials.js
node --check prototype/simple-agent-v3.4-campaigns.js
node --check prototype/simple-agent-v3.4-generate.js
node --check prototype/simple-agent-v3.4-scripts.js
.venv/bin/python -m py_compile scripts/prototype_api_server.py
bash -n scripts/simple_agent_env.sh
bash -n scripts/simple_agent_start.sh
bash -n scripts/simple_agent_restart_api.sh
bash -n scripts/simple_agent_healthcheck.sh
bash -n scripts/simple_agent_screen_start.sh
bash -n scripts/simple_agent_launchctl_start.sh
bash -n scripts/deploy_from_github.sh
scripts/simple_agent_healthcheck.sh
```

正式服务器如果不是 systemd 托管 API，用后台重启脚本：

```bash
cd /home/appadmin/content-agent/current
scripts/simple_agent_restart_api.sh
```

这条脚本会先读取 `.env.production`，再启动 `prototype_api_server.py`。不要直接执行 `nohup .venv/bin/python scripts/prototype_api_server.py`，否则会退回开发默认生成器。

## 发布后验证

1. 登录管理员账号。
2. 打开 v3.4 四个页面，确认左侧菜单与状态颜色一致。
3. 素材库录入一个视频链接，确认识别预览、下载、字幕状态可见。
4. 脚本生成页选择品牌活动和参考素材，生成脚本。
5. 脚本库点击采用并同步飞书，确认飞书表新增或更新记录。
6. 打开旧版本集合，确认旧链接仍可访问。

## 回滚原则

发布脚本切换 `current` 后会检查 API 健康状态和完整 `simple_agent_healthcheck.sh`，失败会回滚到上一版。若页面交互细节异常但健康检查未覆盖，需要手动切回上一 release 或重新发布修复 tag。
