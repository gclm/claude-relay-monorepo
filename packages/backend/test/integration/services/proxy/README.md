# Proxy Service Integration Tests

本目录包含代理服务的集成测试，使用真实的本地 KV 数据库和真实的 API 进行测试。

## 测试策略

### 1. 使用真实环境
- **本地 KV 数据库**: 使用基于 JSON 文件的本地 KV 存储
- **真实 API 调用**: 直接调用 Claude API 和第三方供应商 API
- **完整数据流**: 测试完整的请求-响应流程

### 2. 测试数据管理
- **预置测试数据**: 在 `data/` 目录下准备各种测试场景的数据
- **隔离测试环境**: 每个测试使用独立的 KV 实例，避免数据污染
- **自动清理**: 测试结束后自动清理生成的数据

### 3. 测试场景覆盖
- **正常流程**: 各种模型和供应商的正常请求
- **错误处理**: API 限流、网络错误、格式错误等
- **边界情况**: 大型请求、流式响应、并发请求等

## 目录结构

```
test/integration/services/proxy/
├── README.md                     # 本文档
├── data/                        # 测试数据
│   ├── providers.json           # 预置的供应商配置
│   ├── route-configs.json       # 预置的路由配置
│   ├── api-keys.json           # 测试用 API 密钥
│   └── requests/               # 各种测试请求样例
├── helpers/                     # 测试辅助工具
│   ├── setup.ts                # 测试环境设置
│   ├── data-loader.ts          # 测试数据加载器
│   └── assertions.ts           # 自定义断言函数
├── engines/                     # Engine 层集成测试
│   ├── claude-engine.test.ts   # Claude Engine 测试
│   ├── provider-engine.test.ts # Provider Engine 测试
│   └── scenarios/              # 复杂场景测试
└── claude-proxy.test.ts         # 主服务集成测试
```

## 测试执行

### 环境准备
1. 确保本地 KV 存储目录存在
2. 配置必要的环境变量（API 密钥等）
3. 准备测试数据文件

### 运行测试
```bash
# 运行所有集成测试
npm run test:integration

# 运行特定测试
npm run test:integration -- claude-engine

# 调试模式
npm run test:integration:debug
```

### 注意事项
1. **API 成本**: 集成测试会产生真实的 API 调用成本
2. **网络依赖**: 需要稳定的网络连接
3. **速率限制**: 避免过于频繁的测试运行
4. **敏感数据**: 不要提交真实的 API 密钥到代码库

## 测试覆盖的关键场景

### 1. Claude Engine
- 直接转发到 Claude API
- Token 认证和刷新
- 流式响应处理
- 错误处理（401、429、500 等）

### 2. Provider Engine
- 多供应商路由（魔搭、智谱、Gemini）
- 格式转换（Claude ↔ OpenAI/Gemini）
- Key Pool 轮换和故障恢复
- 智能模型选择（长上下文、思考模式等）

### 3. 端到端流程
- 完整的请求处理链路
- 并发请求处理
- 大型请求和响应
- 网络异常恢复

## 测试质量保证

1. **可重复性**: 使用固定的测试数据确保结果一致
2. **隔离性**: 每个测试独立运行，不相互影响
3. **可观察性**: 详细的日志和错误报告
4. **性能监控**: 记录每个测试的执行时间

## 贡献指南

添加新的集成测试时，请：
1. 在相应的目录下创建测试文件
2. 在 `data/` 目录下准备必要的测试数据
3. 使用 `helpers/` 中的工具函数
4. 更新本文档说明新的测试场景