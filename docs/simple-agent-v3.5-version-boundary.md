# Simple Agent v3.5 版本边界

## 目标

把当前可发布、可回滚、可核验的正式版本边界固定下来，避免继续依赖口头约定。

## 正式发布分支

- 正式分支：`codex/simple-agent-v3.5-release`
- GitHub remote：`origin`
- 正式环境入口：`https://ai.guardianhealth.cn/content/`

## 正式入口 Source of Truth

以下 9 个根目录文件是 v3.5 正式前端入口的真源：

- `materials.html`
- `campaigns.html`
- `generate.html`
- `scripts.html`
- `content-center-v3.5.css`
- `content-center-v3.5-materials.js`
- `content-center-v3.5-campaigns.js`
- `content-center-v3.5-generate.js`
- `content-center-v3.5-scripts.js`

## 正式运行时文件

以下文件属于正式运行时边界，变更后需要重新核验并按正式流程发布：

- `scripts/prototype_api_server.py`
- `scripts/simple_agent_code_release_pack.sh`
- `scripts/deploy_content_agent_archive.sh`
- `scripts/simple_agent_healthcheck.sh`
- `scripts/simple_agent_restart_api.sh`
- `scripts/simple_agent_screen_start.sh`
- `scripts/simple_video_engine/platform_router.py`
- `scripts/simple_video_engine/universal_parser.py`

## 非正式文件

以下内容默认不算正式版本真源，不应因为它们有改动就阻塞正式发版：

- `prototype/` 下的视觉草稿和实验页面
- `docs/design/` 下的设计稿、截图、评审资料
- `docs/performance/`、`docs/superpowers/` 下的过程文档
- 历史 `simple-agent-v3.4-*` 根目录兼容文件
- 临时脚本、分析脚本、一次性导入脚本

说明：

- 非正式文件可以继续保留在仓库里，但默认不进入“本次正式版本是否完整”的判断。
- 如果后续某个原型文件要升级成正式入口，必须先把它加入正式边界清单，再进入发布流程。

## 发版判断规则

满足以下条件，才算“v3.5 正式版本可发”：

1. 当前分支位于 `codex/simple-agent-v3.5-release`
2. 正式入口 9 个文件存在且通过最小语法检查
3. 正式运行时文件通过最小语法检查
4. 发布包不包含 `data/`、`logs/`、`run/`、`.env*`、数据库文件
5. 正式环境 `current` 指向新的 release 目录，且 `scripts/simple_agent_healthcheck.sh` 通过

## 建议流程

1. 需求完成后，只提交正式边界内文件
2. 先运行：

```bash
bash scripts/simple_agent_v3_5_release_audit.sh
```

3. 再执行打包和发布：

```bash
bash scripts/simple_agent_code_release_pack.sh
```

4. 发布后验证：

```bash
curl -fsS https://ai.guardianhealth.cn/content/api/health
```

## 当前收口结论

- 以后判断“版本是否完整”，优先看这份边界，而不是看整个仓库是否干净。
- 整仓仍然可以继续整理，但正式版本发布不再依赖一次性清空所有历史草稿。
