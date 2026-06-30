# Local App Lifecycle Scripts

`scripts/` 目录下的这组三个脚本用于在本地以后台进程方式运行当前项目的完整本地应用栈，而不只是公开网站。默认情况下，它们会先启动 `pnpm dev:backend` 作为本地后端服务，监听 `http://127.0.0.1:8001`，再启动 `pnpm dev:site` 作为统一浏览器入口，监听 `http://127.0.0.1:3000`。

## Quick Usage

启动本地应用栈：

```bash
scripts/start.sh
```

停止本地应用栈：

```bash
scripts/stop.sh
```

重启本地应用栈：

```bash
scripts/restart.sh
```

正常启动后，脚本会输出站点 URL、本地后端 URL、两个后台进程的 PID，以及各自的日志文件路径。停止时会按顺序处理站点和后端，并输出最终状态。

## Script Behavior

### `start.sh`

`start.sh` 负责把统一站点和本地后端作为一组受管后台服务拉起。

- 根据当前仓库路径计算一个校验值，并在临时目录下生成默认运行目录，避免不同 checkout 默认共用同一套 PID 或日志文件。
- 创建运行目录，并准备 `site.pid`、`site.log`、`backend.pid` 与 `backend.log`。
- 如果 `site.pid` 与 `backend.pid` 都指向仍然存活的进程，脚本会直接输出“已经运行中”并退出，不重复启动。
- 如果只有一个服务仍然存活，或者任一 PID 文件已经陈旧或无效，脚本会先把现有部分状态当作“半启动状态”清理掉，再执行一次完整的重新启动。
- 进入仓库根目录后，先通过 `nohup pnpm dev:backend` 启动本地后端，并把标准输出与标准错误写入 `backend.log`。
- 后端启动后会短暂等待 2 秒，再用 `kill -0` 检查 PID 是否仍然存活；如果后端已经退出，则输出最近日志并直接终止启动流程。
- 后端确认存活后，再通过 `nohup env PORT="$PORT" pnpm dev:site` 启动统一站点，并把标准输出与标准错误写入 `site.log`。
- 如果站点启动失败，脚本会输出最近的站点日志内容，随后停止刚刚拉起的本地后端，并清理两个 PID 文件。

### `stop.sh`

`stop.sh` 负责根据 `site.pid` 和 `backend.pid` 停止已经启动的本地应用栈。

- 停止顺序固定为：先停站点，再停本地后端，避免浏览器入口仍在运行时继续指向已经准备关闭的后端。
- 如果某个 PID 文件不存在、内容不是合法数字，或者记录的进程已经不在运行，脚本会把它当作局部陈旧状态自动清理，而不会把整个停止流程视为失败。
- 如果某个服务仍然存活，脚本会先递归调用 `pgrep -P` 查找子进程，再对整棵进程树发送 `SIGTERM`。
- 发送终止信号后，会按秒轮询，最多等待 `MIND_WIKI_STOP_TIMEOUT_SECONDS` 秒；如果超时，则回退到 `SIGKILL` 强制结束。
- 只有当站点和后端都没有活跃进程时，脚本才会输出统一的“未运行”状态提示。

### `restart.sh`

`restart.sh` 没有额外状态管理逻辑，只是顺序执行：

1. `stop.sh`
2. `start.sh`

这样“重启”的行为就完全复用到前两个脚本已经定义好的双服务生命周期规则里。

## Technical Principles

### Multi-service Lifecycle

脚本管理的是当前项目的完整本地运行形态：统一站点负责浏览器入口，本地后端负责工作台动作和状态读取。两者被当作一个本地应用栈统一启动和停止。

### Workspace Isolation

默认运行目录不是写死的固定路径，而是由仓库绝对路径的校验值推导出来。这样在同一台机器上存在多个仓库副本时，它们默认不会互相覆盖 PID 文件或日志文件。

### Log Persistence

站点和后端的标准输出、标准错误分别重定向到 `site.log` 与 `backend.log`，这样即使脚本本身已经退出，后续仍然可以查看启动日志、报错信息和运行输出。

### Partial-state Recovery

如果当前只有站点或只有后端仍然存活，或者留下了陈旧 PID 文件，`start.sh` 会先把这类半启动状态清理掉，再执行一次完整启动，避免两个服务来自不同批次。

### Process-tree Shutdown

停止逻辑不只处理记录在 PID 文件里的父进程，还会递归终止它们的子进程，避免遗留 Next.js、pnpm 或 tsx 的孤儿进程继续占用资源。

### Fixed Backend Port Assumption

脚本始终把本地后端视为 `http://127.0.0.1:8001`。当前浏览器工作台代码仍然硬编码这个后端地址，因此这里故意不暴露后端端口覆盖选项，避免脚本把系统带到一个前后端不一致的状态。

## Environment Variables

这些环境变量就是当前脚本对外暴露的可配置接口。

### `PORT`

- 默认值：`3000`
- 作用：传给 `pnpm dev:site`，控制统一浏览器入口监听的端口。
- 适用场景：本机 `3000` 端口已被占用，或需要并行运行多个站点实例。

### `MIND_WIKI_SITE_URL`

- 默认值：`http://127.0.0.1:${PORT}`
- 作用：控制脚本在启动成功或“已运行中”时输出的站点 URL 文案。
- 适用场景：需要输出自定义访问地址，或在端口映射、代理场景下希望显示不同的访问入口。

### `MIND_WIKI_RUN_DIR`

- 默认值：`${TMPDIR:-/tmp}/mind-wiki-site-${ROOT_KEY}`
- 作用：控制 `site.pid`、`site.log`、`backend.pid` 和 `backend.log` 所在的运行目录。
- 适用场景：希望把运行状态文件集中到自定义目录，或需要和默认目录隔离。

### `MIND_WIKI_PID_FILE`

- 默认值：`${RUN_DIR}/site.pid`
- 作用：覆盖站点默认 PID 文件路径。
- 适用场景：需要把站点 PID 文件写入另一个位置，或和其他自动化脚本对接。

### `MIND_WIKI_LOG_FILE`

- 默认值：`${RUN_DIR}/site.log`
- 作用：覆盖站点默认日志文件路径。
- 适用场景：希望把站点日志接入另一个目录、日志收集器，或区分不同运行实例的输出。

### `MIND_WIKI_BACKEND_PID_FILE`

- 默认值：`${RUN_DIR}/backend.pid`
- 作用：覆盖本地后端默认 PID 文件路径。
- 适用场景：需要把后端 PID 文件写入另一个位置，或和其他自动化脚本对接。

### `MIND_WIKI_BACKEND_LOG_FILE`

- 默认值：`${RUN_DIR}/backend.log`
- 作用：覆盖本地后端默认日志文件路径。
- 适用场景：希望把后端日志接入另一个目录、日志收集器，或区分不同运行实例的输出。

### `MIND_WIKI_STOP_TIMEOUT_SECONDS`

- 默认值：`10`
- 作用：控制 `stop.sh` 在发送 `SIGTERM` 后等待优雅退出的最长秒数；`start.sh` 在清理半启动状态时也会复用这个超时值。
- 适用场景：本机进程退出较慢，需要延长等待时间，或者希望更快进入强制终止流程。

## Troubleshooting

### 显示 “already running”

这表示 `site.pid` 和 `backend.pid` 指向的两个进程当前都仍然存活。脚本会直接复用现有实例，不会重复启动第二套服务。可以先运行 `scripts/stop.sh`，再决定是否重新启动。

### 检测到 partial state

这表示只有一个服务仍然存活，或者留下了无效 / 陈旧 PID 文件。脚本会自动停止仍然活着的那一侧，清理状态文件，然后重新启动整套本地应用栈。

### 显示 “failed to start”

这表示 `start.sh` 在启动后短暂等待 2 秒，再检查 PID 时发现某个进程已经退出。应优先查看脚本打印出来的 `site.log` 或 `backend.log` 路径，确认 `pnpm dev:site` 或 `pnpm dev:backend` 的真实报错信息。

### 后端端口为什么不能覆盖

当前工作台浏览器代码仍默认调用 `http://127.0.0.1:8001`。如果脚本允许把后端启动到别的端口，浏览器入口就会和后端脱节，所以这里故意不暴露后端端口变量。

### 站点端口冲突

如果本机 `3000` 已被其他服务占用，可以在启动前覆盖 `PORT`：

```bash
PORT=3010 scripts/start.sh
```

如果希望输出文案也同步显示新的访问地址，可以同时覆盖 `MIND_WIKI_SITE_URL`。本地后端仍然会固定运行在 `8001`。
