根据 GitHub issue 实现功能。

## 使用方法
```
/issue-impl [GitHub issue URL]
```

## 工作流程

1. **分析需求**
   - 解析输入内容（GitHub issue URL 或文本描述）
   - 如果是 GitHub URL，使用 gh 命令获取 issue 内容
   - 阅读 @CLAUDE.md 了解项目架构
   - 分析相关代码文件

2. **设计方案**
   - 生成前后端实现方案
   - 设计 API 接口契约
   - 列出具体实现步骤

3. **用户确认**
   - 展示设计方案
   - 等待用户确认（输入 yes 继续）

4. **并行实现**
   - 调用 frontend-implement subagent 实现前端
   - 调用 backend-implement subagent 实现后端
   - 整合实现结果

## 设计原则

- **架构遵循**: 严格遵循项目既定架构（Nuxt 4 + Hono）
- **简洁实现**: 在正确架构下追求最简实现
- **清晰分工**: 前后端职责明确，接口清晰

$ARGUMENTS