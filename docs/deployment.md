# 部署指南

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

## 🔧 高级配置

### 环境变量

- `ADMIN_USERNAME` - 管理员用户名
- `ADMIN_PASSWORD` - 管理员密码  
- `NUXT_PUBLIC_API_BASE_URL` - 前端 API 基础 URL

### KV 存储

所有配置和数据存储在 `CLAUDE_RELAY_ADMIN_KV` namespace 中。

### 自定义域名

1. 在 Cloudflare Dashboard 中绑定自定义域名
2. 更新 `NUXT_PUBLIC_API_BASE_URL` 环境变量
3. 重新部署应用

## 🔍 故障排除

### 常见问题

1. **部署失败** - 检查 Secrets 配置是否正确
2. **管理页面无法访问** - 确认 KV namespace 已创建并绑定
3. **API 调用失败** - 验证域名配置和环境变量

### 查看日志

在 Cloudflare Dashboard 的 **Workers & Pages** 中查看实时日志。