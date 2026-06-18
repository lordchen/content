# Codex / Image AI Integration

当前原型服务地址：

```text
http://127.0.0.1:8771
```

## 1. Codex 对话

接口：

```text
POST /api/ai/chat
```

请求：

```json
{
  "prompt": "只回复：contentwork-ai-ok",
  "images": ["/absolute/path/to/reference.jpg"],
  "cwd": "/Users/lei/Documents/contentwork",
  "sandbox": "read-only",
  "timeoutSeconds": 180
}
```

底层调用：

```bash
codex --ask-for-approval never exec --skip-git-repo-check --sandbox read-only --output-last-message <file> --image <path> -
```

说明：

- `prompt` 从 stdin 传入，避免和 `--image` 参数冲突。
- `images` 可为空；不为空时用于参考图理解，不会生成图片文件。
- 已验证普通对话和带参考图对话可用。

## 2. 文生图

接口：

```text
POST /api/ai/images/generate
```

请求：

```json
{
  "prompt": "竖屏短视频首帧，adidas门店场景，真实手机拍摄质感。",
  "size": "1024x1536",
  "quality": "auto",
  "outputFormat": "png",
  "n": 1
}
```

底层调用：

```text
OpenAI Images API /v1/images/generations
```

说明：

- 默认模型由 `OPENAI_IMAGE_MODEL` 控制，未设置时使用 `gpt-image-2`。
- 需要环境变量 `OPENAI_API_KEY`。
- 成功后图片保存到 `prototype/generated/`，接口返回本地预览 URL。

## 3. 参考图生图

接口：

```text
POST /api/ai/images/edit
```

请求：

```json
{
  "prompt": "保留参考图主体和构图，改成适合抖音团购短视频首帧的真实门店运动穿搭画面。",
  "images": ["/absolute/path/to/reference.jpg"],
  "size": "1024x1536",
  "quality": "auto",
  "outputFormat": "png",
  "n": 1
}
```

底层调用：

```text
OpenAI Images API /v1/images/edits
```

说明：

- `images` 必须是本地绝对路径数组。
- 当前最多允许 16 张参考图。
- 需要环境变量 `OPENAI_API_KEY`。

## 当前验证结果

- `POST /api/ai/chat` 普通对话已跑通。
- `POST /api/ai/chat` 带 `--image` 参考图输入已跑通。
- 图片端点在缺少 `OPENAI_API_KEY` 时会返回明确错误，不会静默兜底。
