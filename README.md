# ComfyUI Custom Node Manager

[English](./README_EN.md) | 简体中文

一个以 GitHub 和 Git 仓库为核心的 ComfyUI 自定义插件管理器，可直接从 ComfyUI 顶栏打开。

## 为什么做这个插件

我开发这个插件，是因为 ComfyUI 自带的 ComfyUI Manager 在管理自定义插件时不够方便：

1. 默认以 Comfy Registry 而非 GitHub 作为远程来源，许多插件无法搜索；即使能够找到，也可能不是最新版本。
2. 不方便查看远程仓库的近期提交和文件变更，本地存在修改时也难以快速确认具体改动。
3. 无法便捷地打开插件目录和对应的 GitHub 仓库。
4. 查看和更新插件往往需要切换到第三方启动器，无法在 ComfyUI 内完成统一管理。

因此，这个项目以 Git 仓库为主要管理方式，同时保留 Comfy Registry 的搜索与安装支持。

## 核心功能

- 打开面板后立即显示已安装插件、当前分支、状态和最后提交，无需等待联网检查。
- 手动检查远程更新，并逐个刷新检查结果。
- 查看近期提交、待更新提交及每次提交涉及的文件变更。
- 查看本地修改和逐文件差异，并自动忽略 `__pycache__` 等缓存文件。
- 更新单个、选中或全部插件，并在面板底部持续显示更新进度。
- 更新前自动备份，失败时自动回滚；本地修改不会在未确认时被覆盖。
- 点击插件名称打开远程仓库，也可一键打开本地插件目录。
- 从 GitHub、任意 Git 地址或 Comfy Registry 搜索并安装插件。
- 支持禁用、启用、重新安装和卸载插件，并可直接重启 ComfyUI。
- 自动适配 ComfyUI 的浅色/深色主题，面板顶部可一键切换中/英文界面。
- 在管理中心的「依赖冲突」页签中检测已启用插件之间的 Python 依赖版本冲突，以及与当前已安装版本不符的情况。

## 界面预览

### 软件主界面

![插件管理器主界面](./assets/screenshots/main-interface.png)

### 插件安装界面

![插件安装界面](./assets/screenshots/plugin-install.png)

### 最近提交界面

![最近提交界面](./assets/screenshots/recent-commits.png)

## 安装

在 ComfyUI 的 `custom_nodes` 目录中执行：

```bash
git clone https://github.com/nmvjhd/comfyui-custom-node-manager.git
```

重启 ComfyUI 后，顶栏会出现「插件管理器」按钮。

更新管理器：

```bash
cd comfyui-custom-node-manager
git pull
```

## 使用

1. 打开顶栏的「插件管理器」。
2. 点击「检查更新」获取远程状态。
3. 点击状态或最后提交，查看具体改动。
4. 使用单个「更新」或「一键更新」完成升级，其他操作位于 `•••` 菜单。

## 支持项目

如果这个插件对你有帮助，欢迎请我喝杯咖啡。

<a href="./assets/wechat-pay.jpg">
  <img src="./assets/wechat-pay.jpg" width="320" alt="微信收款码">
</a>

## 注意事项

- 安装、更新、禁用、启用或卸载插件后，需要重启 ComfyUI 才能完全生效。
- 强制同步会丢弃本地修改并清理未跟踪文件，请谨慎使用。
- 请勿同时使用多个管理器操作同一个插件，以免发生目录冲突。
