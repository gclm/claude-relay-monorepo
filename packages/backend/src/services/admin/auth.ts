/**
 * 管理员认证服务
 */

export class AdminAuthService {
  constructor(private adminKv: KVNamespace) {}

  // 验证管理员凭据
  async verifyAdmin(username: string, password: string, env: any): Promise<boolean> {
    const adminUsername = env.ADMIN_USERNAME || 'admin'
    const adminPassword = env.ADMIN_PASSWORD || 'password123'
    
    return username === adminUsername && password === adminPassword
  }
}