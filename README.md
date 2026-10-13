# Fast Note Sync Toggle

用一个命令、或笔记页面顶部的一个开关，快速开启/关闭 **Fast Note Sync** 的**只读同步模式**。

Toggle [Fast Note Sync](https://github.com/HaierKeys/obsidian-fast-note-sync)'s read-only sync mode from a command or a switch in the note header.

---

## 中文

### 它做了什么

Fast Note Sync 的**只读同步模式**决定这台设备**能不能上传**本地修改：

> 开启后，本设备仅接收服务端更新，不上传任何本地修改。优先级高于手动同步模式。

这个开关很值得随手拨 —— 在你不确定哪台设备是权威副本的机器上编辑之前打开它，编辑完再关掉 —— 但它藏在那个插件设置页的三层深处。本插件把它放到两个随手可及的地方。

### 三种用法

**1. 命令**

命令面板里搜「只读同步」，一共三条：

| 命令 | 作用 |
|---|---|
| **切换只读同步模式（开 / 关）** | 拨一下就翻转 |
| **开启只读同步模式** | 强制开启（已经是开的时候，这条命令**不会出现**） |
| **关闭只读同步模式** | 强制关闭（同上） |

后两条存在的理由：**给它们各绑一个快捷键**比"用同一个键来回翻"更可靠 —— 你不必记住当前是哪个状态。

**2. 页面顶部的开关**

在页面右上角的按钮栏里放一个图标 —— **Markdown 笔记、Canvas 画布、Excalidraw 图纸都有**（这三类可以分别关掉）：

| 图标 | 含义 |
|---|---|
| 🔒 锁 | 只读同步**已开启**（只收不发） |
| 🔓 开锁 | 只读同步**已关闭**（会正常上传） |
| ? 问号 | 没找到 Fast Note Sync |

点一下即切换，鼠标悬停会写出当前状态和点击的后果。开启时图标会染上强调色。

**3. 状态栏**（默认关闭）

窗口底部的「只读同步：开 / 关」，点击同样可以切换。在「设置 → Fast Note Sync Toggle」里打开。

### 设置

| 设置 | 默认 | 说明 |
|---|---|---|
| 立即切换一次 | — | 等同于命令面板里的切换命令 |
| 在页面顶部显示开关 | 开 | 上面那个锁图标的总开关 |
| ↳ 在 Markdown 笔记里显示 | 开 | |
| ↳ 在 Canvas 画布里显示 | 开 | |
| ↳ 在 Excalidraw 图纸里显示 | 开 | |
| 在状态栏也显示 | 关 | 底部的文字开关 |
| 切换时弹出提示 | 开 | 关掉后切换是静默的 |
| 切换后重载同步服务 | **关** | 见下 |

三类页面用的是 Obsidian 自己的视图类型字符串（`markdown` / `canvas` / `excalidraw`）。不在这个清单里的视图不会被加按钮 —— 那些页面本来也没有可放按钮的标题栏。

### 为什么「重载同步服务」默认关闭

Fast Note Sync 自己的设置页里拨这个开关时，调的是 `saveAndReloadServices()` —— 保存设置，**外加**拆掉并重连它的 websocket、清掉同步定时器。

本插件默认**只做保存那一步**，理由是：只读标志在 Fast Note Sync 里是**每次上传前现读**的（源码里 20 多处 `plugin.settings.readonlySyncEnabled` 全是即时读取，没有任何地方在启动时把它缓存进服务）。所以保存就已经生效，不需要重连。

代价是切换瞬间**不断线**，符合"随手拨一下"的用途。如果你希望行为和它自带设置页完全一致，把这一项打开即可。

### 它怎么连到 Fast Note Sync

通过 `app.plugins.plugins["fast-note-sync"]` 拿到它的实例 —— 这也是 Fast Note Sync 自己去访问别的插件的路径。**没有任何 import**，所以没装、没启用 Fast Note Sync 时，本插件照样加载、不报错，只是开关会显示成"不可用"，点击给出说明。

对它的假设**全部做了运行时校验**：设置对象存在、`readonlySyncEnabled` 是布尔值、`saveSettings` 是函数。任何一条不成立就当作"不可用"，而不是抛错。它以后改设置结构，最坏的结果是这个开关自己停用，不会连累 Obsidian。

### 图标为什么会自己更新

那个标志**也可能从 Fast Note Sync 自己的设置页被改**，而它不会通知任何人。要去挂它的 `saveSettings` 就得猴子补丁它的原型 —— 那正是最容易被对方下一个版本打断的写法。

所以这里**每秒读一次那个布尔值**（一次属性读取，成本可忽略），只有值真的变了才碰 DOM。因此图标**不会过期**。

### iPad / 手机能用吗

**能。** 插件只用了 Obsidian 跨平台的 API，没有碰任何桌面专属的东西（无 `electron`、无 `node:fs`、无 `process`，产物里唯一的 `require` 是 `obsidian` 本身）。逐项对照：

| 功能 | iPad / 手机 |
|---|---|
| 三条命令（命令面板） | ✅ |
| 页面右上角的锁图标 | ✅ |
| 状态栏开关 | ❌ 移动端没有状态栏 |
| 快捷键 | ❌ 没有实体键盘（外接键盘可用） |

**状态栏那一项**：Obsidian 自己的样式里写着 `.is-mobile .status-bar { display: none }` —— 移动端整个状态栏是隐藏的。所以插件在移动端**根本不创建**那个元素，设置页里这一项会显示为**禁用**并说明原因，而不是让你打开一个毫无反应的开关。你在桌面端设的值会**原样保留**，回到桌面照样生效。

> **页首按钮为什么在 iPad 上能显示**：Obsidian 的样式里有 `.is-mobile .view-actions { justify-content: flex-end; … }` 与 `.is-tablet .view-actions { --raised: none; }`，说明按钮栏在移动端是正常渲染的。

**依赖方面**：Fast Note Sync 本身支持移动端（它的 manifest 里 `isDesktopOnly` 为 `false`，并且自带移动端的状态点与提示位置设置）。它没装/没启用时，本插件在 iPad 上同样只是显示成「不可用」。

### 依赖

| 依赖 | 说明 |
|---|---|
| Obsidian | ≥ 1.8.7 |
| **Fast Note Sync** | 必须安装并启用（id 必须是 `fast-note-sync`） |

移动端也能用（命令和页面按钮都不依赖键盘）。

### 开发

```bash
npm install
npm run build     # typecheck + bundle to main.js
npm run dev       # rebuild on change
npm run deploy    # copy the three files into .obsidian/plugins/
npm run ship      # build + deploy
```

源码在 `src/`：`fns.ts`（桥接与运行时校验）、`settings.ts`（设置 + 设置页）、`main.ts`（命令、页首开关、状态栏、轮询）。

---

## English

Fast Note Sync's **read-only sync mode** decides whether this device may upload local changes. It is worth flicking often — turn it on before editing on a machine you do not trust to be authoritative, turn it off when you are done — but it sits three levels deep in that plugin's settings pane. This plugin puts it on a command, on a switch in the page header (**Markdown notes, Canvas boards and Excalidraw drawings**; each can be switched off separately), and optionally in the status bar. Two extra commands set the mode explicitly, because a hotkey that always turns it *on* is more reliable than one that flips whatever the current state happens to be.

It reaches Fast Note Sync through `app.plugins.plugins["fast-note-sync"]` — the same route that plugin itself uses to reach others — and imports nothing from it, so this plugin loads and works fine when Fast Note Sync is absent or disabled. Every assumption about the other plugin is re-validated at runtime; any mismatch is reported as "unavailable" rather than thrown. Saving plainly is enough because the flag is read live at every upload site, so the default path avoids reconnecting Fast Note Sync's websocket; the heavier save it uses in its own settings pane is available as an option. The flag can also be changed from Fast Note Sync's own settings pane, where nothing announces it, so the state is re-read once a second rather than hooked — that costs one property read, and the DOM is only touched when the value actually changed.

Requires Obsidian ≥ 1.8.7 and **Fast Note Sync** installed and enabled (its id must be `fast-note-sync`).

### iPad and phones

It works there. The plugin uses only Obsidian's cross-platform API — no `electron`, no `node:fs`, no `process`, and the only `require` in the build is `obsidian` itself. The commands and the header switch both work; the **status bar option does not**, because Obsidian hides the entire status bar on mobile (`.is-mobile .status-bar { display: none }` in its own stylesheet), so the plugin does not even create the element there and the setting is shown disabled with an explanation rather than silently doing nothing. The value you set on desktop is preserved. Fast Note Sync itself supports mobile, so the whole chain works.

## 许可 / License

MIT
