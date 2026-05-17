# PR-Agent + GitHub Actions 快速部署清单

适用于任意 GitHub 私有/公开仓库，配置 AI 自动代码审查。

---

## 前置条件

- [ ] 安装 GitHub CLI：`winget install --id GitHub.cli`
- [ ] 登录 GitHub：`gh auth login`
- [ ] 准备好 LLM API Key（DeepSeek / OpenAI / Anthropic 等）

---

## Step 1: 初始化 Git 仓库

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

---

## Step 2: 创建分支结构

```bash
git checkout -b dev
git checkout -b staging
git checkout -b production

# 推送所有分支到 GitHub
git push -u origin dev production staging

# 切回 dev 进行日常开发
git checkout dev
```

---

## Step 3: 创建 PR-Agent GitHub Action

### 3.1 创建 workflow 文件

路径：`.github/workflows/pr-agent.yml`

```yaml
name: PR Agent Code Review

on:
  pull_request:
    types: [opened, reopened, ready_for_review, synchronize]
  issue_comment:
    types: [created, edited]

jobs:
  pr_agent_job:
    if: ${{ github.event.sender.type != 'Bot' }}
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
      contents: write
    name: PR Agent - Auto Review & Describe
    steps:
      - name: PR Agent action step
        id: pragent
        uses: the-pr-agent/pr-agent@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DEEPSEEK.KEY: ${{ secrets.DEEPSEEK_KEY }}
          config.model: "deepseek/deepseek-chat"
          config.fallback_models: '["deepseek/deepseek-chat"]'
          config.custom_model_max_tokens: "131072"
          github_action_config.auto_review: "true"
          github_action_config.auto_describe: "true"
          github_action_config.auto_improve: "true"
          github_action_config.enable_output_relevant: "true"
```

> 换模型只需改 `config.model` 和对应的 `XXX.KEY`，例如：
> - OpenAI: `"gpt-4o"` + `OPENAI_KEY`
> - Claude: `"anthropic/claude-3-opus-20240229"` + `ANTHROPIC.KEY`
> - Gemini: `"gemini/gemini-1.5-flash"` + `GOOGLE_AI_STUDIO.GEMINI_API_KEY`

### 3.2 创建 PR-Agent 配置文件

路径：`.pr_agent.toml`

```toml
[config]
model = "deepseek/deepseek-chat"
fallback_models = ["deepseek/deepseek-chat"]
custom_model_max_tokens = 131072

[pr_reviewer]
extra_instructions = "Focus on: security vulnerabilities, logic bugs, performance issues, and code quality. Write review comments in English."
require_score_review = true
num_code_suggestions = 4

[pr_code_suggestions]
num_code_suggestions = 4
suggestions_score_threshold = 6

[pr_description]
publish_description_as_comment = true
```

---

## Step 4: 配置 GitHub Secrets

1. 打开 `https://github.com/<user>/<repo>/settings/secrets/actions`
2. 点击 **New repository secret**
3. 添加 API Key：
   - Name: `DEEPSEEK_KEY`（或其他 provider 对应名称）
   - Value: `<你的 API Key>`

---

## Step 5: 合并到 main 激活

```bash
git add .github/workflows/pr-agent.yml .pr_agent.toml
git commit -m "Add PR-Agent GitHub Action with DeepSeek configuration"
git push origin dev

# 合并到 main（workflow 需要存在于目标分支才能触发）
git checkout main
git merge dev
git push origin main

# 回到 dev 继续开发
git checkout dev
```

---

## Step 6: 验证

1. 在 `dev` 分支做一个小改动并提交
2. 创建 PR：`gh pr create --base main --head dev --title "test" --body "test pr-agent"`
3. 等待 1-2 分钟，PR Agent 应自动在 PR 评论区发布审查结果
4. 审查内容包括：PR 概述、代码建议、安全/性能问题

---

## 可选增强

- [ ] 启用 `auto_improve`：审查后会尝试自动提交修复建议
- [ ] 添加 `.gitignore` 控制仓库文件
- [ ] 配置分支保护规则（Settings → Branches → 要求 PR 审查通过才能合并）

---

## 模型速查

| Provider      | config.model                        | Secret Name                        |
|---------------|-------------------------------------|------------------------------------|
| DeepSeek      | `deepseek/deepseek-chat`           | `DEEPSEEK.KEY`                    |
| OpenAI        | `gpt-4o`                           | `OPENAI_KEY`                      |
| Claude        | `anthropic/claude-3-opus-20240229` | `ANTHROPIC.KEY`                   |
| Gemini        | `gemini/gemini-1.5-flash`          | `GOOGLE_AI_STUDIO.GEMINI_API_KEY` |
| Azure OpenAI  | `gpt-4o` + `OPENAI.API_TYPE: azure`| `OPENAI_KEY`                      |
