# Simple Agent v3.5 发布规范

v3.5 的重点是继续提升前端视觉和交互体验。发布范围限定为代码和静态资源，不迁移、不覆盖、不清理正式环境数据。

## 正式入口

- 素材库：`/content/materials.html`
- 品牌活动：`/content/campaigns.html`
- 脚本生成：`/content/generate.html`
- 脚本库：`/content/scripts.html`
- 旧版本集合：`/content/prototype/v1/index.html`

预览入口 `/content/prototype/v3.5/...` 可以保留，但不作为正式对外链接。

## 发布边界

- 只发布代码、HTML、CSS、JS、文档、脚本和必要模板。
- 不打包 `data/`、`logs/`、`run/`、`backups/`、`releases/`。
- 不打包 `.env`、`.env.*`、数据库文件、账号密钥文件。
- 正式环境继续使用 `/home/appadmin/content-agent/shared/content-agent.env`。
- 正式环境继续使用服务器现有共享数据目录；发布脚本只把新 release 的 `data` 链接到现有数据目录。
- 禁止在发布过程中执行数据导入、数据迁移、账号重置、素材清空、脚本清空。

## 服务器配置检查

发布前后只做只读检查：

- ASR：`SUBTITLE_ENGINE`、`ASR_API_URL`、`ASR_MODEL`、`ASR_API_KEY`、`FFMPEG_BIN`、`FFPROBE_BIN`。
- 脚本生成：`SIMPLE_AGENT_RUNTIME_ENV=production`、`SIMPLE_AGENT_GENERATOR=image2svc_chat`、`IMAGE2SVC_CHAT_URL`。
- 图片服务：`SIMPLE_AGENT_IMAGE_BACKEND=image2svc`、`IMAGE2SVC_IMAGE_URL`。
- 飞书：`LARK_CLI_BIN`、`SIMPLE_AGENT_SCRIPT_LIBRARY_URL`，或 `SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN` + `SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID`。

不在发布脚本里写入或修改这些配置。

## 发布包要求

使用代码包脚本：

```bash
bash scripts/simple_agent_code_release_pack.sh
```

包内正式根入口必须是 v3.5：

- `materials.html`
- `campaigns.html`
- `generate.html`
- `scripts.html`
- `content-center-v3.5.css`
- `content-center-v3.5-materials.js`
- `content-center-v3.5-campaigns.js`
- `content-center-v3.5-generate.js`
- `content-center-v3.5-scripts.js`

发布包生成后必须扫描确认没有数据和配置文件。

## 发布验证

本地验证：

```bash
node --check content-center-v3.5-materials.js
node --check content-center-v3.5-campaigns.js
node --check content-center-v3.5-generate.js
node --check content-center-v3.5-scripts.js
node --check prototype/v3.5/content-center-v3.5-materials.js
node --check prototype/v3.5/content-center-v3.5-campaigns.js
node --check prototype/v3.5/content-center-v3.5-generate.js
node --check prototype/v3.5/content-center-v3.5-scripts.js
python3 -m py_compile scripts/prototype_api_server.py
bash -n scripts/simple_agent_code_release_pack.sh
bash -n scripts/deploy_content_agent_archive.sh
bash -n scripts/simple_agent_healthcheck.sh
```

正式验证：

```bash
WEB_BASE=https://ai.guardianhealth.cn/content scripts/simple_agent_healthcheck.sh
```

人工确认：

- `/content/materials.html` 能打开，素材列表和预览抽屉可用。
- `/content/campaigns.html` 能打开，表格不出现明显横向滚动。
- `/content/generate.html` 能打开，历史任务和生成结果区可见。
- `/content/scripts.html` 能打开，脚本预览抽屉和飞书入口可见。
- `/content/prototype/v1/index.html` 旧版本入口可用。

## 回滚

部署脚本切换 `current` 后会执行健康检查。失败时必须回滚到上一版 `current`，并重启 API。若页面细节问题健康检查未覆盖，也优先切回上一版或发布修复包，不操作正式数据。
