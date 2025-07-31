# GitHub Actions 部署配置

## 前置步骤

1. **断开 Cloudflare Git 集成**
   - 登录 Cloudflare Dashboard
   - Workers & Pages → 选择 `claude-relay-backend`
   - Settings → Git → Disconnect
   - 对 `claude-relay-frontend` 也执行相同操作

2. **获取 Cloudflare API Token**
   - 登录 Cloudflare Dashboard
   - My Profile → API Tokens → Create Token
   - 使用 "Edit Cloudflare Workers" 模板
   - 权限需要包括：
     - Account: Cloudflare Workers Scripts:Edit
     - Account: Cloudflare Pages:Edit
     - Zone: Zone:Read

3. **获取 Account ID**
   - 在 Cloudflare Dashboard 右侧栏可以找到

## 配置 GitHub Secrets

在 GitHub 仓库中设置以下 Secrets：

1. 进入仓库 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下 secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | `your-api-token` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | `your-account-id` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `your-secure-password` |
| `KV_NAMESPACE_ID` | KV Namespace ID | `dc2886d8397f4b75b3970b7c8b167728` |

## 使用说明

1. 配置完成后，每次推送到 `main` 分支都会自动部署
2. 也可以在 Actions 页面手动触发部署（workflow_dispatch）
3. 部署顺序：先部署后端，再部署前端

## 注意事项

- 确保 `wrangler.toml` 中的 KV namespace ID 正确
- 不要在 `wrangler.toml` 中硬编码敏感信息
- GitHub Actions 会自动处理环境变量注入