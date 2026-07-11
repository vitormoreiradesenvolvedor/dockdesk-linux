# Git 治理规范 — DockDesk

🌐 [Português (BR)](governanca.pt.md) · [English](governanca.en.md) · **中文** · [हिन्दी](governanca.hi.md) · [Español](governanca.es.md) · [Français](governanca.fr.md)

只有一条流程：**master ⬅ development**。规则由两层机制保障：

1. **本地钩子**（`.githooks/`）— 由 `npm install` 自动启用
   （`prepare` 脚本配置 `core.hooksPath`）；
2. **GitHub 工作流**（`.github/workflows/guard-*.yml`）。

授权用户白名单位于
[`.github/authorized-users.json`](../../.github/authorized-users.json)
（字段：`github`、`name`、`email`），两层机制共用。

## 不在白名单中的用户须遵守

- **不得从 `master` 创建分支** — 请从 `development` 创建；
- **不得在本地修改 `master`**（commit、merge、reset）。唯一允许的合并方向是更新
  自己的分支：`git checkout 你的分支 && git merge master`；
- **不得向 `master` 发起 PR**，也不得发起**来自** `master` 的 PR（包括发往
  `development`）— 违规 PR 会被自动判失败并关闭；
- **分支名**：`动作/kebab-case-描述`
  （动作：`feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`）；
- **提交信息**：`**动作:** 描述`（例如 `**Add:** Open Modal`）；
- **PR 标题**：与提交信息相同的格式。

完整规范（含示例与检查清单）见
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md)（葡萄牙语）。

## 自动发布

每次 `master` 更新时，发布工作流会：

1. 读取 `package.json` 中的版本号；
2. 若版本号**等于或低于**现有最高 tag → 流水线**失败**；
3. 若**更高** → 创建 `vX.Y.Z` tag，构建 **AppImage**，并发布附带二进制文件的
   GitHub Release。

## 关于本地层的说明

Git 钩子不会随克隆传播（git 自身行为）。它们在克隆后的第一次 `npm install`
之后生效 — 这是任何开发者的正常流程。从不安装依赖的人不会有本地防护，
但仍会被服务端机制（工作流 + 分支保护）拦截。
