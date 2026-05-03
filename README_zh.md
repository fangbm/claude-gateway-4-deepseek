# ClaudeGateway4Deepseek (cg4d)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fangbm/ClaudeGateway4Deepseek)

一个轻量级的 Cloudflare Worker，让 **Claude Desktop**（以及 Claude Code CLI）通过 Anthropic 兼容的 API 适配层，直接调用 **DeepSeek** 模型。

## 它能做什么

| 端点 | 功能 |
|------|------|
| `GET /v1/models` | 返回一个虚拟模型列表，让 Claude Desktop 能够正常启动。 |
| `POST /v1/messages` | 将请求代理转发到 `https://api.deepseek.com/anthropic/v1/messages`。 |

上游的 **DeepSeek API Key 从请求的 `Authorization` 请求头中读取**——Worker 中不会硬编码任何密钥。

## 为什么需要这个项目

Claude Desktop 和 Claude Code CLI 默认只支持 Anthropic 官方的 API 端点。DeepSeek 虽然提供了 Anthropic 兼容的消息接口，但两者的端点格式并不完全一致。cg4d 作为一个中间层，帮你抹平这些差异，让你可以用 DeepSeek 的模型在 Claude 生态中无缝使用，同时享受 DeepSeek 极具竞争力的价格。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Wrangler

```bash
npx wrangler login
```

> 如果你还没有 Cloudflare 账号，请先去 [cloudflare.com](https://www.cloudflare.com) 注册一个（免费套餐即可）。

### 3. 部署

```bash
npx wrangler deploy
```

Wrangler 会输出你的 Worker URL，类似：

```
https://claudegateway4deepseek.<你的子域名>.workers.dev
```

## 配置 Claude Desktop / Claude Code

将 Anthropic 的 base URL 设置为你的 Worker 地址，并将你的 **DeepSeek API Key** 作为 Anthropic API key 传入：

### macOS / Linux

```bash
export ANTHROPIC_BASE_URL=https://claudegateway4deepseek.<你的子域名>.workers.dev
export ANTHROPIC_API_KEY=sk-你的-deepseek-key
claude
```

### Windows (PowerShell)

```powershell
$env:ANTHROPIC_BASE_URL = "https://claudegateway4deepseek.<你的子域名>.workers.dev"
$env:ANTHROPIC_API_KEY = "sk-你的-deepseek-key"
claude
```

### 持久化配置（macOS / Linux）

将以下内容添加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
export ANTHROPIC_BASE_URL=https://claudegateway4deepseek.<你的子域名>.workers.dev
export ANTHROPIC_API_KEY=sk-你的-deepseek-key
```

然后重启 Claude Desktop 即可生效。

### 持久化配置（Windows）

在系统环境变量中添加：

- 变量名：`ANTHROPIC_BASE_URL`，值：`https://claudegateway4deepseek.<你的子域名>.workers.dev`
- 变量名：`ANTHROPIC_API_KEY`，值：`sk-你的-deepseek-key`

设置后重启 Claude Desktop。

## 可选功能：KV 密钥映射

如果你不想在本地环境变量中明文存储真实的 DeepSeek Key，可以绑定一个 **Cloudflare KV 命名空间**，将本地"假密钥"映射到真实的 DeepSeek Key。

### 1. 创建 KV 命名空间

```bash
npx wrangler kv namespace create "API_KEY_MAP"
```

### 2. 将输出的 `id` 填入 `wrangler.toml`

取消 `wrangler.toml` 中 `[[kv_namespaces]]` 块的注释，并替换 ID。

### 3. 添加密钥映射

```bash
npx wrangler kv key put --binding=API_KEY_MAP "sk-local-fake-key-123" "sk-你的-deepseek-key"
```

### 4. 启用代码中的 KV 查找

取消 `src/index.ts` 中 KV 查找相关代码的注释。

完成以上步骤后，你可以在本地设置：

```bash
export ANTHROPIC_API_KEY=sk-local-fake-key-123
```

Worker 会自动将其映射为真实的 DeepSeek Key，再转发给 DeepSeek API。这样可以避免真实密钥泄露到本地日志或配置文件中。

## 项目结构

```
.
├── src/
│   └── index.ts          # Worker 入口文件
├── wrangler.toml         # Wrangler 配置文件
├── package.json
├── tsconfig.json
└── README.md
```

## 技术说明

- **流式响应（SSE）**：Worker 完整支持流式响应（Server-Sent Events），这是 Claude Desktop 实现实时输出所必需的。
- **CORS 支持**：已内置 CORS 响应头，方便浏览器端客户端调用。生产环境中建议根据实际需求收紧 `ALLOWED_ORIGINS` 配置。
- **上游端点**：使用的 DeepSeek 接口为 `https://api.deepseek.com/anthropic/v1/messages`，这是 DeepSeek 官方提供的 Anthropic 兼容端点。
- **零硬编码密钥**：Worker 中不存储任何 API Key，所有密钥均从请求头或 KV 中动态获取。

## 常见问题

**Q: 支持哪些 DeepSeek 模型？**

A: 所有 DeepSeek 支持 Anthropic 格式的模型都可以使用，包括 DeepSeek-V3、DeepSeek-R1 等。具体可参考 [DeepSeek API 文档](https://api-docs.deepseek.com)。

**Q: 需要付费吗？**

A: cg4d 本身是开源免费的。Cloudflare Worker 免费套餐每天有 10 万次请求额度，对个人使用绰绰有余。DeepSeek API 按量计费，价格远低于 Anthropic 官方 API。

**Q: 延迟会增加多少？**

A: Cloudflare Worker 部署在全球边缘节点，代理转发仅增加几毫秒的延迟，几乎无感。

**Q: 除了 Claude Desktop，还能用在其他地方吗？**

A: 任何兼容 Anthropic Messages API 的客户端理论上都可以使用，包括 Claude Code CLI 以及各种第三方客户端。

## 许可证

MIT
