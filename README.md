# Fast Note Sync Toggle

用一个命令、或页面顶部的一个开关，快速切换 **Fast Note Sync** 的两个同步模式：

| 模式 | 作用 |
|---|---|
| **只读同步** | 开启后本设备只接收服务端更新，**不上传**任何本地修改 |
| **手动同步** | 开启后不在启动或文件修改时自动触发同步，**只能手动触发** |

Toggle [Fast Note Sync](https://github.com/HaierKeys/obsidian-fast-note-sync)'s read-only and manual sync modes from a command or a switch in the page header.

---

## 中文

### 为什么需要它

这两个开关都很值得随手拨 —— 在你不确定哪台设备是权威副本的机器上编辑之前打开只读同步，编辑完再关掉 —— 但它们藏在那两个插件设置页的三层深处。

**注意两者不等价**：只读同步连手动触发的上传也拒绝；手动同步只停掉自动触发，你仍然可以手动同步。Fast Note Sync 自己对手动同步的提示是「**请谨慎开启**，该功能会严重影响使用体验」。

### 三种用法

**1. 命令**

命令面板里搜「同步模式」，每个模式三条，一共六条：

| 命令 | 作用 |
|---|---|
| **切换只读 / 手动同步模式（开 / 关）** | 拨一下就翻转 |
| **开启只读 / 手动同步模式** | 强制开启（已经是开的时候，这条命令**不会出现**） |
| **关闭只读 / 手动同步模式** | 强制关闭（同上） |

后两条存在的理由：**给它们各绑一个快捷键**比"用同一个键来回翻"更可靠 —— 你不必记住当前是哪个状态。

**2. 页面顶部的开关**

在页面右上角的按钮栏里放图标 —— **Markdown 笔记、Canvas 画布、Excalidraw 图纸都有**：

| 模式 | 关 | 开 |
|---|---|---|
| 只读同步 | 🔓 开锁 | 🔒 锁 |
| 手动同步 | ⚡ 闪电 | ⏸ 暂停 |

点击即切换，悬停会显示当前状态和点击的后果；开启时染上强调色。三类页面可以分别关掉。

**3. 状态栏**（默认关闭）

窗口底部每个模式一项，形如「只读同步：开」，点击同样可以切换。

### 设置

| 设置 | 默认 | 说明 |
|---|---|---|
| **立即切换一次** | — | 每个模式一个按钮，等同于命令面板里的切换命令 |
| 显示「只读同步」开关 | 开 | 关掉后它没有页面按钮、没有状态栏项，命令也从面板消失 |
| 显示「手动同步」开关 | 开 | 同上 |
| 在页面顶部显示开关 | 开 | 上面那两个图标的总开关 |
| ↳ 在 Markdown 笔记里显示 | 开 | |
| ↳ 在 Canvas 画布里显示 | 开 | |
| ↳ 在 Excalidraw 图纸里显示 | 开 | |
| 在状态栏也显示 | 关 | 底部文字项 |
| 切换时弹出提示 | 开 | 关掉后切换是静默的 |
| 切换后重载同步服务 | **关** | 见下 |

> 把某个模式的开关关掉，**只影响本插件显示什么**，不会去改 Fast Note Sync 里的实际状态。

### 为什么「重载同步服务」默认关闭

Fast Note Sync 自己的设置页拨这两个开关时，调的是 `saveAndReloadServices()` —— 保存设置，**外加**拆掉并重连它的 websocket。

本插件默认**只做保存那一步**：这两个标志在它源码里都是**用到时现读**的（`operator_*.ts` 与 `events_manager.ts` 里全是即时读取，没有任何地方在启动时把它们缓存进服务），所以保存就已经生效。代价是切换瞬间**不断线**，符合"随手拨一下"的用途。想和它自带设置页完全一致就打开这一项。

### 它怎么连到 Fast Note Sync

通过 `app.plugins.plugins["fast-note-sync"]` 拿到实例 —— 这也是 Fast Note Sync 自己访问别的插件时走的路。**没有 import**，所以它没装、没启用时本插件照样加载、不报错，只把开关显示成"不可用"。

对它的假设**全部做了运行时校验**，而且读写是对称的：

- 读：插件在、`settings` 是对象、`saveSettings` 是函数、**要读的那个键是布尔值** —— 任一条不成立就报"不可用"
- 写：**同样要求那个键本来就存在**。键不存在时**拒绝写入**，而不是新建一个 —— 那会让开关看起来能用、实际什么也没发生

所以它以后改设置结构，最坏结果是这个开关自己停用并给出说明，不会连累 Obsidian。

### 图标为什么会自己更新

那两个标志**也可能从 Fast Note Sync 自己的设置页被改**，而它不通知任何人。要去挂它的 `saveSettings` 就得猴子补丁它的原型 —— 那正是最容易被对方下一个版本打断的写法。

所以这里**每秒读一次那两个布尔值**（一次属性读取，成本可忽略），只有值真的变了才碰 DOM。因此图标**不会过期**。

### iPad / 手机能用吗

**能。** 插件只用了 Obsidian 跨平台的 API，没有碰任何桌面专属的东西（无 `electron`、无 `node:fs`、无 `process`，产物里唯一的 `require` 是 `obsidian` 本身）。逐项对照：

| 功能 | iPad / 手机 |
|---|---|
| 命令（命令面板） | ✅ |
| 页面右上角的图标 | ✅ |
| 状态栏 | ❌ 移动端没有状态栏 |
| 快捷键 | ❌ 没有实体键盘（外接键盘可用） |

**状态栏那一项**：Obsidian 自己的样式里写着 `.is-mobile .status-bar { display: none }` —— 移动端整个状态栏是隐藏的。所以插件在移动端**根本不创建**那些元素，设置页里这一项显示为**禁用**并说明原因。你在桌面端设的值会**原样保留**。

> **页首按钮为什么在 iPad 上能显示**：Obsidian 的样式里有 `.is-mobile .view-actions { justify-content: flex-end; … }` 与 `.is-tablet .view-actions { --raised: none; }`，说明按钮栏在移动端是正常渲染的。

### 依赖

| 依赖 | 说明 |
|---|---|
| Obsidian | ≥ 1.8.7 |
| **Fast Note Sync** | 必须安装并启用（id 必须是 `fast-note-sync`） |

### 开发

```bash
npm install
npm run build     # typecheck + bundle to main.js
npm run dev       # rebuild on change
npm run deploy    # copy the three files into .obsidian/plugins/
npm run ship      # build + deploy
```

源码在 `src/`：

| 文件 | 做什么 |
|---|---|
| `flags.ts` | **模式表** —— 两个模式的键、图标、文案、命令名都在这里，加第三个模式只需加一行 |
| `fns.ts` | 桥接与运行时校验（按任意布尔键读写） |
| `settings.ts` | 设置项、校验、设置页 |
| `main.ts` | 命令、页首按钮、状态栏、每秒轮询 |

---

## English

Fast Note Sync has two modes that suppress automatic uploading, and both sit three levels deep in its settings pane: **read-only sync** (receive from the server, never upload) and **manual sync** (never sync on startup or file change, only by hand). They are not equivalent — read-only refuses even a hand-triggered upload, while manual only stops automatic triggering.

This plugin puts each on a command and on a switch in the page header — Markdown notes, Canvas boards and Excalidraw drawings, each switchable off separately — plus optional status bar items. Every mode also gets explicit on/off commands, hidden when already in that state, because a hotkey that always means one thing is more reliable than one that flips whatever the current state happens to be. Which modes are exposed at all is itself a setting, so the header need not carry buttons nobody uses.

It reaches Fast Note Sync through `app.plugins.plugins["fast-note-sync"]` — the same route that plugin itself uses — and imports nothing from it, so this plugin loads and works when Fast Note Sync is absent or disabled. Every assumption is re-validated at runtime, and reads and writes are symmetric: a write also requires the key to already exist, so a renamed setting disables the switch instead of silently doing nothing. Saving plainly is enough because both flags are read live at every point of use, so the default path avoids reconnecting the websocket; the heavier save its own settings pane uses is opt-in. The flags can also be changed from Fast Note Sync's own settings pane, where nothing announces it, so the state is re-read once a second rather than hooked — one property read, with the DOM touched only when a value actually changed.

Works on iPad and phones (only Obsidian's cross-platform API is used); the status bar option cannot, because Obsidian hides the whole status bar on mobile, so the plugin does not create those items there and says so in the settings pane.

Requires Obsidian ≥ 1.8.7 and **Fast Note Sync** installed and enabled (its id must be `fast-note-sync`).

## 许可 / License

MIT
