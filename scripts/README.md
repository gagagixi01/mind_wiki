# Website Lifecycle Scripts

`scripts/` 目录下的这组三个脚本用于在本地以后台进程方式运行公开网站，方便开发者或运营人员在同一个仓库里进行启动、停止和重启操作。默认目标是仓库根目录下的 `pnpm dev:site`，也就是启动 Next.js 公开站点，并默认监听 `http://127.0.0.1:3000`。

## Quick Usage

启动网站：

```bash
scripts/start.sh
```

停止网站：

```bash
scripts/stop.sh
```

重启网站：

```bash
scripts/restart.sh
```

正常启动后，脚本会输出站点 URL、后台进程 PID，以及日志文件路径。停止时会输出当前处理的 PID 和最终停止结果。

## Script Behavior

### `start.sh`

`start.sh` 负责把公开网站作为后台开发服务拉起。

- 根据当前仓库路径计算一个校验值，并在临时目录下生成默认运行目录，避免不同 checkout 默认共用同一套 PID 或日志文件。
- 创建运行目录，并准备 `site.pid` 与 `site.log`。
- 如果 `site.pid` 已存在，会先读取其中的 PID；如果该 PID 仍然存活，则直接提示“已经运行中”并退出，不重复启动。
- 如果 PID 文件存在但对应进程已经不存在，则删除旧的 `site.pid`，再继续启动。
- 进入仓库根目录后，通过 `nohup env PORT="$PORT" pnpm dev:site` 启动网站，并把标准输出与标准错误都写入 `site.log`。
- 把后台进程 PID 写入 `site.pid`。
- 启动后等待 2 秒，再用 `kill -0` 检查记录下来的 PID 是否仍然存在；如果不存在，则输出最近的日志内容并清理 `site.pid`。

### `stop.sh`

`stop.sh` 负责根据 `site.pid` 停止已经启动的网站进程树。

- 如果 `site.pid` 不存在，会把当前状态当作“未运行”，直接输出说明并退出。
- 如果 `site.pid` 内容不是合法数字，会删除这个无效 PID 文件并退出。
- 如果 `site.pid` 中的 PID 已经不存在，会把它视为陈旧 PID 文件，自动清理并退出。
- 如果进程存在，会先递归调用 `pgrep -P` 查找子进程，再对整棵进程树发送 `SIGTERM`。
- 发送终止信号后，会按秒轮询，最多等待 `MIND_WIKI_STOP_TIMEOUT_SECONDS` 秒。
- 如果超时后主 PID 仍然存在，则回退到 `SIGKILL` 强制结束，并删除 `site.pid`。

### `restart.sh`

`restart.sh` 没有额外状态管理逻辑，只是顺序执行：

1. `stop.sh`
2. `start.sh`

这样可以把“重启”的行为完全复用到前两个脚本已经定义好的生命周期规则里。

## Technical Principles

### PID-based Lifecycle Management

脚本使用稳定的 `site.pid` 文件记录后台进程身份，让后续的停止与重启操作可以指向同一个进程族，而不是依赖人工查找端口或进程名。

### Log Persistence

启动命令的标准输出和标准错误统一重定向到 `site.log`，这样即使脚本本身已经退出，后续仍然可以查看启动日志、报错信息和运行输出。

### Workspace Isolation

默认运行目录不是写死的固定路径，而是由仓库绝对路径的校验值推导出来。这样在同一台机器上存在多个仓库副本时，它们默认不会互相覆盖 PID 文件或日志文件。

### Process-tree Shutdown

停止逻辑不只处理 `site.pid` 对应的父进程，还会递归终止它的子进程，避免遗留 Next.js 或包管理器的孤儿进程继续占用资源。

### Idempotent Operator Experience

重复执行 `start.sh` 时，如果服务已经存活，脚本会直接说明现状；重复执行 `stop.sh` 时，如果 PID 文件缺失、无效或已经陈旧，也会自动清理并平稳退出，而不是把这些状态当作异常失败。

## Environment Variables

这些环境变量就是当前脚本对外暴露的可配置接口。

### `PORT`

- 默认值：`3000`
- 作用：传给 `pnpm dev:site`，控制公开网站监听的端口。
- 适用场景：本机 `3000` 端口已被占用，或需要并行运行多个站点实例。

### `MIND_WIKI_SITE_URL`

- 默认值：`http://127.0.0.1:${PORT}`
- 作用：控制脚本启动成功或“已运行中”时输出的站点 URL 文案。
- 适用场景：需要输出自定义访问地址，或在端口映射、代理场景下希望显示不同的访问入口。

### `MIND_WIKI_RUN_DIR`

- 默认值：`${TMPDIR:-/tmp}/mind-wiki-site-${ROOT_KEY}`
- 作用：控制 `site.pid` 和 `site.log` 所在的运行目录。
- 适用场景：希望把运行状态文件集中到自定义目录，或需要和默认目录隔离。

### `MIND_WIKI_PID_FILE`

- 默认值：`${RUN_DIR}/site.pid`
- 作用：覆盖默认 PID 文件路径。
- 适用场景：需要把 PID 文件写入另一个位置，或和其他自动化脚本对接。

### `MIND_WIKI_LOG_FILE`

- 默认值：`${RUN_DIR}/site.log`
- 作用：覆盖默认日志文件路径。
- 适用场景：希望把日志接入另一个目录、日志收集器，或区分不同运行实例的输出。

### `MIND_WIKI_STOP_TIMEOUT_SECONDS`

- 默认值：`10`
- 作用：控制 `stop.sh` 在发送 `SIGTERM` 后等待优雅退出的最长秒数。
- 适用场景：本机进程退出较慢，需要延长等待时间，或者希望更快进入强制终止流程。

## Troubleshooting

### 显示 “already running”

这表示 `site.pid` 指向的 PID 当前仍然存活。脚本会直接复用现有实例，不会重复启动第二个网站进程。可以先运行 `scripts/stop.sh`，再决定是否重新启动。

### 显示 “failed to start”

这表示 `start.sh` 在启动后短暂等待 2 秒，再检查 PID 时发现进程已经退出。此时应优先查看脚本打印出来的 `site.log` 路径，确认 `pnpm dev:site` 的真实报错信息。

### PID 文件陈旧或无效

如果 `site.pid` 丢失、内容不是数字，或者里面记录的进程已经不存在，`stop.sh` 会自动清理这些状态，不需要手动删文件。

### 端口冲突

如果本机 `3000` 已被其他服务占用，可以在启动前覆盖 `PORT`：

```bash
PORT=3010 scripts/start.sh
```

如果希望输出文案也同步显示新的访问地址，可以同时覆盖 `MIND_WIKI_SITE_URL`。
