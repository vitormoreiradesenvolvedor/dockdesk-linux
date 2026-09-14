<img src="../../build/icon.png" width="72" alt="DockDesk 图标" align="left" />

# DockDesk

**无需记忆命令的 Docker：一款完整的 Linux 图形界面。**

<br clear="left"/>

🌐 [Português (BR)](../../README.md) · [English](README.en.md) · **中文** · [हिन्दी](README.hi.md) · [Español](README.es.md) · [Français](README.fr.md)

---

## 它解决的痛点

每个团队都有那个"docker compose 一下就能跑"的项目……也总有人恰好卡在这一步。
前端开发、QA、技术设计师、刚加入团队的新人：这些人**每天都需要**容器，却不想（也不应该必须）背下 `docker exec -it`、日志参数或服务的启动顺序。

DockDesk 就是为这些人而生：**在使用 Docker 的项目中开发、但不是 Docker 专家的人**。日常所需的一切都只需一次点击，名称清晰，支持六种语言，同时不隐藏底层发生的事情（界面会展示等价的命令）。

## 功能一览

### 容器
- 实时列表：状态、**CPU 和内存**占用、端口映射、搜索；
- 一键**启动、停止、重启、删除**（删除需确认）；
- 容器**按 Compose 项目分组**为手风琴（包括在 DockDesk 之外启动的项目），记住展开/折叠状态并支持**拖拽排序**；
- 详情面板：镜像、内部 IP、网络、端口、卷/挂载和环境变量。

### 终端与命令
- **真正的交互式终端**（等同于 `docker exec -it`），**自动检测**镜像中可用的 shell（bash、zsh、fish、ash、sh…）供你选择；
- **执行命令**：显示输出、stderr 和退出码，无需打开终端；
- **实时日志**，智能自动滚动；
- 切换标签页时保留正在运行的内容，并提供清除按钮。

### 例程（按容器的快捷方式）
- 创建 `htop`、`npm run dev`、`composer install` 之类的按钮；
- **部分命令例程**：固定命令（如 `cd /home/project`）在执行时询问补全（如 `&& npm install`）；
- **`[--]` 标记**：在命令中写入 `[--]`，即可指定补全内容进入的**位置**，而不只是追加到末尾 — 输入的文本会填入**每一个**标记（如 `cd /app/[--] && npm run [--]`）；
- **名称和命令过长时自动换行**，你按 Enter 输入的换行在执行时也会被保留；
- 每个例程都在**挂靠在其所在行的专属终端**中运行，进程存活期间一直可见（特别适合 `npm run dev`），带**运行指示器**、最小化和停止按钮；
- 按容器名保存：容器重建后依然存在。

### Compose 项目
- 指定项目所在文件夹，DockDesk **自动找到 `docker-compose.yml`**（最多 4 层，跳过 `node_modules` 等）；
- 一键**启动（`up -d`）、停止、重启**，实时输出控制台和运行服务计数；
- 上下文按钮：全部运行时"启动"消失；"重启/停止"只在有服务运行时出现。

### 镜像、数据卷和网络
- 全部按其 Compose 项目分组，手风琴可排序；
- 受保护的删除（资源使用中时会提示）；
- Docker 默认网络有标记并防止删除。

### 体验
- 一键**明暗主题**切换；
- **6 种语言**：Português (BR)、English、中文、हिन्दी、Español、Français，覆盖界面和托盘；
- **系统托盘**：关闭窗口隐藏到托盘；支持开机自启动和隐藏启动；
- **单实例**：再次打开只会聚焦已有窗口；
- 分组顺序、主题、语言和手风琴状态在会话间保持。

![DockDesk，容器界面](../screenshot-containers.png)

## 安装

在 [Releases](https://github.com/vitormoreiradesenvolvedor/dockdesk-linux/releases) 下载最新的 `.AppImage`，赋予执行权限并运行：

```bash
chmod +x DockDesk-*.AppImage
./DockDesk-*.AppImage
```

**要求：** 运行 Docker Engine 的 Linux，且你的用户在 `docker` 组中
（`sudo usermod -aG docker $USER`）；项目区域需要 Docker Compose v2。

## 开发

```bash
npm install          # 同时启用项目的 git 钩子
npm start            # 构建 renderer 并打开应用
npm run test:e2e     # 端到端测试（Playwright + 真实 Docker）
npm run dist         # 在 release/ 生成 AppImage
```

- **架构：** `electron/`（主进程：通过 socket 和 dockerode 访问 Docker，经 `contextBridge` 暴露）· `src/`（React + TypeScript + Vite，终端用 xterm.js）· `tests/e2e/`（Playwright 驱动真实应用）。
- **Git 流程与治理：** 分支、提交、PR 规则和自动发布见 [docs/git/governanca.zh.md](../git/governanca.zh.md)。
