# 内容生产 Agent GitHub 发布流程计划

目标：把发布链路从“本地打包上传跳板机”改成“GitHub 保存代码，服务器按 tag 拉取发布”，同时保证线上数据、飞书配置、image2svc 配置不进入 GitHub。

## 当前已补齐

- `.gitignore` 已排除运行数据、日志、发布包、缓存、虚拟环境和常见密钥文件。
- `scripts/simple_agent_code_release_pack.sh` 可生成 code-only 发布包，不包含 `data/` 和本地密钥。
- `scripts/deploy_from_github.sh` 是服务器端发布脚本模板：
  - 从 GitHub 拉取指定分支或 tag。
  - 发布到 `/home/appadmin/content-agent/releases/<version>`。
  - `data`、`logs`、`run` 链接到 `/home/appadmin/content-agent/shared/`。
  - 复用 `/home/appadmin/content-agent/shared/content-agent.env`。
  - 发布前做 JS / Python 基础检查。
  - 切换 `current` 后做健康检查。
  - 健康检查失败自动回滚到上一版。

## 推荐目录结构

```text
/home/appadmin/content-agent/
  current -> releases/<active-release>
  releases/
    20260614-010000-v1.0.0/
  shared/
    content-agent.env
    data/
      contentwork.db
      simple_agent_videos/
    logs/
    run/
```

## GitHub 仓库策略

- 仓库建议设为 private。
- GitHub 只保存：
  - `prototype/`
  - `scripts/`
  - `docs/`
  - `configs/`
  - `services/`
  - `README.md`
  - `package.json`
  - `package-lock.json`
  - `requirements.txt`
- GitHub 不保存：
  - `data/`
  - `logs/`
  - `run/`
  - `backups/`
  - `releases/`
  - `.env*`
  - 密码、token、飞书 secret、image2svc key

## 一次性搭建步骤

1. 本地初始化 git 仓库。

```bash
git init
git add .gitignore README.md package.json package-lock.json requirements.txt prototype scripts docs configs services
git status --short
```

2. 创建 GitHub private repo，例如：

```text
content-agent
```

3. 配置 remote，优先用 SSH。

```bash
git remote add origin git@github.com:<owner>/content-agent.git
```

4. 提交并推送 main。

```bash
git commit -m "Prepare content agent GitHub release flow"
git branch -M main
git push -u origin main
```

5. 在服务器配置只读 deploy key。

```bash
ssh-keygen -t ed25519 -C "content-agent-deploy" -f ~/.ssh/content_agent_deploy
cat ~/.ssh/content_agent_deploy.pub
```

把公钥添加到 GitHub 仓库的 Deploy keys，权限选择 read-only。

6. 在服务器保存发布脚本。

```bash
mkdir -p /home/appadmin/content-agent/bin
cp scripts/deploy_from_github.sh /home/appadmin/content-agent/bin/deploy_from_github.sh
chmod +x /home/appadmin/content-agent/bin/deploy_from_github.sh
```

7. 在服务器设置仓库地址。

```bash
export CONTENT_AGENT_GIT_REPO_URL=git@github.com:<owner>/content-agent.git
```

建议后续写入 `/home/appadmin/content-agent/shared/deploy.env`，但不要提交到 GitHub。

8. 首次从 GitHub 发布。

```bash
CONTENT_AGENT_GIT_REPO_URL=git@github.com:<owner>/content-agent.git \
/home/appadmin/content-agent/bin/deploy_from_github.sh main
```

9. 验证公网。

```bash
curl -fsS https://ai.guardianhealth.cn/content-agent/api/health
curl -I https://ai.guardianhealth.cn/content-agent/
```

## 日常发布方式

小改动发布：

```bash
git add prototype scripts docs configs services README.md package.json package-lock.json requirements.txt .gitignore
git commit -m "Fix Feishu synced status label"
git tag feishu-status-label-v1
git push origin main --tags
```

服务器发布指定 tag：

```bash
CONTENT_AGENT_GIT_REPO_URL=git@github.com:<owner>/content-agent.git \
/home/appadmin/content-agent/bin/deploy_from_github.sh feishu-status-label-v1
```

## 权限优化

当前手工发布会卡在 `sudo systemctl restart content-agent-api`。建议给 `appadmin` 最小 sudo 权限，只允许重启这个服务：

```text
appadmin ALL=(root) NOPASSWD: /bin/systemctl restart content-agent-api, /bin/systemctl status content-agent-api
```

这样 GitHub 发布脚本可以无交互完成。

## 后续可选升级

- GitHub Actions 只负责检查和打 tag，不直接保存服务器密码。
- 服务器用 webhook 或手工命令拉 tag 发布。
- 增加 `migrations/`，数据库结构变化用 migration 执行，不随代码包覆盖数据库。
- 增加 `scripts/smoke_public.sh`，统一检查入口、登录、素材库、脚本库、飞书配置和 image2svc 健康状态。
