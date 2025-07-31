# GitHub Secrets 配置指南

## 需要配置的 Secrets

### 1. CLOUDFLARE_API_TOKEN
- **获取方式**：
  1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
  2. 点击右上角头像 → **My Profile**
  3. 选择 **API Tokens** 标签
  4. 点击 **Create Token**
  5. 使用 **Custom token** 创建自定义令牌
  6. 设置权限：
     - Account - Cloudflare Workers Scripts:Edit
     - Account - Workers KV Storage:Edit
     - Account - Cloudflare Pages:Edit
     - Zone - Zone:Read
  7. 点击 **Continue to summary** → **Create Token**
  8. 复制生成的 Token

### 2. CLOUDFLARE_ACCOUNT_ID
- **获取方式**：
  1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
  2. 选择你的账户
  3. 在右侧边栏找到 **Account ID**
  4. 复制该 ID

### 3. ADMIN_USERNAME
- **说明**：管理中心登录用户名
- **示例**：`admin` 或你自定义的用户名

### 4. ADMIN_PASSWORD
- **说明**：管理中心登录密码
- **建议**：使用强密码，避免使用默认密码

## 在 GitHub 中添加 Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings** (需要仓库管理员权限)
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 输入 Name 和 Value
6. 点击 **Add secret**

## 验证配置

配置完成后，可以手动触发一次部署来验证：

1. 进入仓库的 **Actions** 标签
2. 选择 **Deploy to Cloudflare** workflow
3. 点击 **Run workflow** → **Run workflow**
4. 查看运行日志确认部署成功

## 安全提示

- 不要在代码中硬编码这些敏感信息
- 定期轮换 API Token
- 使用最小权限原则配置 API Token