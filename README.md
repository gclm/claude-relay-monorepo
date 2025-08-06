# Claude Relay

一个现代化的 Claude API 代理服务，基于 Cloudflare Workers 构建。前端和后端统一部署在单个 Worker 中，提供完整的 Claude API 代理和管理界面。

## 🌟 主要特性

- 🔐 **智能代理** - 支持官方 Claude API 和第三方 LLM 供应商（魔搭 Qwen、智谱 AI、Google Gemini 等）
- 🌐 **全球部署** - 基于 Cloudflare Workers，享受全球边缘网络的低延迟
- 💻 **管理界面** - 直观的 Web 界面管理 Claude 账号、供应商配置和密钥池
- 🔑 **Key Pool 管理** - 企业级 API 密钥池，支持智能轮换和故障恢复
- 🚀 **统一部署** - 前端和后端在同一个 Worker 中，简化部署和维护
- 📊 **监控统计** - 实时查看使用情况、密钥状态和系统健康

## 🚀 一键部署

### 第一步：Fork 仓库

1. 点击右上角的 **Fork** 按钮
2. 选择你的 GitHub 账户
3. 保持默认设置并创建 Fork

### 第二步：准备 Cloudflare 资源

**获取 API Token：**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **My Profile** → **API Tokens** → **Create Token**
3. 使用 **"Edit Cloudflare Workers"** 模板
4. 复制生成的 Token

**获取 Account ID：**
- 在 Cloudflare Dashboard 右侧栏复制 **Account ID**

**创建 KV 数据库：**
1. **Workers & Pages** → **KV** → **Create namespace**
2. 名称：`CLAUDE_RELAY_ADMIN_KV`
3. 复制生成的 **Namespace ID**

### 第三步：配置 GitHub Secrets

进入 Fork 的仓库：**Settings** → **Secrets and variables** → **Actions**

添加以下 6 个 secrets：

| Secret 名称 | 值 | 说明 |
|------------|---|------|
| `CLOUDFLARE_API_TOKEN` | 你的 API Token | Cloudflare API 访问令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | Cloudflare 账户 ID |
| `KV_NAMESPACE_ID` | 你的 Namespace ID | KV 数据库 ID |
| `ADMIN_USERNAME` | 自定义用户名 | 管理后台登录用户名 |
| `ADMIN_PASSWORD` | 自定义密码 | 管理后台登录密码 |
| `NUXT_PUBLIC_API_BASE_URL` | 先留空 | 部署后填入 Worker 域名 |

### 第四步：首次部署

1. **Actions** → **Deploy to Cloudflare Workers (Unified)**
2. **Run workflow** → **Run workflow**
3. 等待部署完成（2-3 分钟）

### 第五步：配置域名

在 GitHub Actions 日志中找到部署域名：
```
https://claude-relay-unified.你的子域名.workers.dev
```

回到 **Settings** → **Secrets**，编辑 `NUXT_PUBLIC_API_BASE_URL`，填入完整域名。

### 第六步：完成部署

再次运行 workflow 应用新配置，部署完成！

## 🎯 开始使用

### 访问管理中心
```
https://claude-relay-unified.你的子域名.workers.dev/admin
```
使用设置的用户名和密码登录。

### API 端点
```
https://claude-relay-unified.你的子域名.workers.dev/v1/messages
```

### 配置 Claude Code

修改 `~/.claude/settings.json`：
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "any",
    "ANTHROPIC_BASE_URL": "https://claude-relay-unified.你的子域名.workers.dev"
  }
}
```

## 🛠️ 本地开发

### 环境要求
- Node.js 20+
- npm 或 bun

### 快速开始
```bash
# 克隆并安装依赖
git clone <your-fork-url>
cd claude-relay-monorepo
npm install

# 启动开发环境
npm run dev:backend   # 后端 (localhost:8787)
npm run dev:frontend  # 前端 (localhost:3000)

# 代码检查
npm run type-check
npm run lint
```

### 项目结构
```
├── packages/
│   ├── frontend/          # Nuxt 4 + Vue 3 + Tailwind CSS
│   └── backend/           # Hono + Cloudflare Workers
├── shared/                # 共享类型和常量
└── .github/workflows/     # GitHub Actions 配置
```

## 📋 主要功能

### Claude 账号管理
- OAuth 认证流程
- Token 自动刷新
- 多账号支持

### 供应商管理
- 添加第三方 LLM 供应商
- 模型配置和切换
- 路由规则管理

### Key Pool 管理
- 批量导入 API 密钥
- 智能轮换和故障恢复
- 状态监控和统计

### 统一代理
- Claude API 格式兼容
- 多供应商智能路由
- 错误处理和重试

## 🔧 高级配置

### 环境变量
- `ADMIN_USERNAME` - 管理员用户名
- `ADMIN_PASSWORD` - 管理员密码  
- `NUXT_PUBLIC_API_BASE_URL` - 前端 API 基础 URL

### KV 存储
所有配置和数据存储在 `CLAUDE_RELAY_ADMIN_KV` namespace 中。

## 📚 相关文档

- [GitHub Actions 部署详细说明](./.github/workflows/README.md)
- [API 文档](./docs/api.md)
- [开发者指南](./docs/development.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

⭐ 如果这个项目对您有帮助，请给我们一个星标！