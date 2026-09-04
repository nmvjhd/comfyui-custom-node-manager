import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const CACHE_KEY = "custom-node-manager.plugins";
const RESTART_KEY = "custom-node-manager.needsRestart";
let cachedPlugins = [];
try { cachedPlugins = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch (_) {}

if (Array.isArray(cachedPlugins)) {
    cachedPlugins = cachedPlugins.map((plugin) => ({ ...plugin, latest: "", update_available: false, checking: false, checked: false }));
}
const LANG_KEY = "custom-node-manager.lang";
let currentLang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh";
const EN = {
    " · {n} 个失败": " · {n} failed",
    " ⚠ 其中 {n} 个会降级（可能影响其他插件）：{list}": " ⚠ {n} will be downgraded (may affect other plugins): {list}",
    " 启用，每 ": " Enabled, every ",
    " 小时": " hours",
    " 等 {n} 个包": " and {n} more packages",
    " 等 {n} 个文件": " and {n} more files",
    "(没有内容可显示)": "(nothing to show)",
    "Git 仓库": "Git repo",
    "GitHub API 达到限额：{e}": "GitHub API rate limit reached: {e}",
    "GitHub Token：{s}": "GitHub Token: {s}",
    "{action} {name}？此操作只会重命名插件文件夹。": "{action} {name}? This only renames the plugin folder.",
    "{action}失败": "{action} failed",
    "{action}完成": "{action} complete",
    "{action}插件": "{action} Plugin",
    "{a}/{b} · 成功 {s} · 失败 {f}": "{a}/{b} · {s} succeeded · {f} failed",
    "{f} 个失败": "{f} failed",
    "{name} · 最近提交": "{name} · Recent Commits",
    "{name} · 本地修改": "{name} · Local Changes",
    "{name} 已经在处理中，请稍候": "{name} is already being processed, please wait",
    "{name}：{files}": "{name}: {files}",
    "{n} 个可更新": "{n} updates available",
    "{n} 个已忽略": "{n} ignored",
    "{n} 个插件": "{n} plugins",
    "{n} 个本地修改": "{n} with local changes",
    "{n} 个错误": "{n} errors",
    "{s} 个成功": "{s} succeeded",
    "……以及另外 {n} 个插件": "…and {n} more plugins",
    "一键更新": "Update All",
    "上次检查 {time}": "Last checked {time}",
    "与已安装版本不符": "Doesn't match installed version",
    "丢弃本地修改，强制与远端一致": "Discard local changes and force-sync with remote",
    "中间提交已省略，下面是当前版本": "Intermediate commits omitted, current version below",
    "任务": "Task",
    "任务仍在后台进行": "Task still running in the background",
    "任务仍在进行": "Task still in progress",
    "任务状态": "Task Status",
    "任务记录": "Job History",
    "任务进行中": "Task in progress",
    "依赖冲突": "Dependency Conflicts",
    "依赖冲突检测": "Dependency Conflict Check",
    "依赖冲突检测失败": "Dependency conflict check failed",
    "依赖无变化（{s}）": "No dependency changes ({s})",
    "依赖检查失败：{e}": "Dependency check failed: {e}",
    "保存": "Save",
    "修改": "Modified",
    "全选/全不选（当前筛选结果）": "Select/deselect all (current filter)",
    "共 {a} 个文件有改动，仅显示前 {b} 个": "{a} files changed, showing the first {b}",
    "共 {a} 个结果，显示 {b} 个": "{a} results total, showing {b}",
    "共 {n} 份备份，占用 {size}": "{n} backups, using {size}",
    "共占用 {size}": "Using {size}",
    "关闭": "Close",
    "关闭提交记录": "Close commit history",
    "关闭窗口不会取消任务。可以重新打开插件管理器查看进度。是否关闭？": "Closing the window won't cancel the task. You can reopen the Node Manager to check progress. Close anyway?",
    "内容过长，已截断显示": "Content too long, truncated",
    "分叉 · 落后 {n} 次": "Diverged · {n} behind",
    "删除": "Delete",
    "删除后无法恢复这个备份文件。是否继续？": "This backup file can't be recovered once deleted. Continue?",
    "删除备份": "Delete Backup",
    "删除备份失败": "Failed to delete backup",
    "加载更多": "Load More",
    "即将重启 ComfyUI 以加载插件变更。请确认工作流已保存。": "ComfyUI is about to restart to load the plugin changes. Make sure your workflow is saved.",
    "卸载": "Uninstall",
    "卸载 {name}？操作前会自动创建备份，可在管理中心回滚。": "Uninstall {name}? A backup is created automatically first, and can be rolled back from the manager center.",
    "发现 {n} 个更新": "Found {n} updates",
    "取消": "Cancel",
    "取消忽略": "Unignore",
    "取消选择": "Clear Selection",
    "可更新": "Update Available",
    "启用": "Enable",
    "回滚": "Roll Back",
    "回滚到备份": "Roll Back to Backup",
    "回滚失败": "Rollback Failed",
    "回滚完成": "Rollback Complete",
    "回滚插件": "Roll Back Plugin",
    "固定当前版本": "Pin Current Version",
    "处理结果": "Result",
    "备份 {n}": "Backups {n}",
    "备份已删除": "Backup Deleted",
    "失败": "Failed",
    "失败时会自动回滚到更新前备份。": "Automatically rolls back to the pre-update backup on failure.",
    "存在本地修改的插件未强制同步": "Plugins with local changes were not force-synced",
    "安装": "Install",
    "安装 Git 插件": "Install Git Plugin",
    "安装任务完成": "Install Job Complete",
    "安装依赖": "Installing Dependencies",
    "安装失败": "Install Failed",
    "安装官方市场插件": "Install Registry Plugin",
    "安装插件": "Install Plugin",
    "安装新插件": "Install a New Plugin",
    "官方市场": "Registry",
    "对比所有已启用插件声明的 Python 依赖版本范围，找出互相冲突或者与当前已安装版本不符的情况。这是启发式检测，仅供参考。": "Compares the Python dependency ranges declared by every enabled plugin to find conflicts with each other or with what's actually installed. This is a heuristic check, for reference only.",
    "导入插件清单": "Import Plugin List",
    "导出插件清单": "Export Plugin List",
    "将下载 {name} 到 custom_nodes/{id}。安装后需要重启 ComfyUI。是否继续？": "This will download {name} into custom_nodes/{id}. ComfyUI needs to be restarted after installing. Continue?",
    "将丢弃 {n} 个插件的本地修改，恢复到当前已安装版本（没有可用的远端更新）：\n{note}": "This will discard local changes in {n} plugin(s) and restore the currently installed version (no remote update available):\n{note}",
    "将克隆 {target} 到 custom_nodes 文件夹。安装后需要重启 ComfyUI。是否继续？": "This will clone {target} into the custom_nodes folder. ComfyUI needs to be restarted after installing. Continue?",
    "将删除并重新拉取/下载 {name}，本地修改会丢失（操作前会自动备份，可在管理中心回滚）。是否继续？": "This will delete and re-fetch/download {name}; local changes will be lost (a backup is created automatically first and can be rolled back from the manager center). Continue?",
    "将安装：{names}{extra}{warning}": "Will install: {names}{extra}{warning}",
    "将插件恢复到此备份，并覆盖当前目录。是否继续？": "This restores the plugin to this backup, overwriting the current folder. Continue?",
    "将更新 {n} 个插件。是否继续？": "This will update {n} plugin(s). Continue?",
    "将更新 {n} 个插件，其中 {d} 个有本地修改。未勾选强制同步时会跳过这些插件；勾选后这些插件里列出的本地修改会被丢弃：\n{note}": "This will update {n} plugin(s), {d} of which have local changes. Without force-sync checked those are skipped; with it checked, the local changes listed below will be discarded:\n{note}",
    "尚未检查更新": "Not checked yet",
    "已安装": "Installed",
    "已完成": "Complete",
    "已归档": "Archived",
    "已忽略": "Ignored",
    "已禁用": "Disabled",
    "已跳过依赖预检，将直接安装": "Dependency pre-check skipped, installing directly",
    "已跳过正在处理的插件": "Skipped plugins already being processed",
    "已选 {n} 个插件": "{n} selected",
    "已配置": "Configured",
    "当前": "Current",
    "当前 · 最新": "Current · Latest",
    "当前已安装 {v}": "Currently installed {v}",
    "当前插件": "Current Plugin",
    "必须重启 ComfyUI 后才会生效": "Requires a ComfyUI restart to take effect",
    "忽略更新": "Ignore Updates",
    "恢复 {a} 个，跳过 {b} 个，失败 {c} 个": "Restored {a}, skipped {b}, failed {c}",
    "所选插件已经在更新中，请稍候": "The selected plugins are already updating, please wait",
    "打开目录": "Open Folder",
    "打开远程仓库：{url}": "Open remote repository: {url}",
    "拉取代码": "Pulling Code",
    "排序": "Sort",
    "插件安装完成": "Plugin Install Complete",
    "插件忙碌": "Plugin Busy",
    "插件操作": "Plugin Action",
    "插件更新完成": "Plugin Update Complete",
    "插件检查完成": "Plugin Check Complete",
    "插件正在处理中": "Plugin Busy",
    "插件管理器": "Node Manager",
    "插件管理设置": "Node Manager Settings",
    "搜索": "Search",
    "搜索失败时仍可按此地址直接克隆": "Even if search fails, you can still clone directly from this address",
    "搜索官方市场节点名或作者": "Search registry node name or author",
    "搜索未安装的仓库，或粘贴 GitHub / Git 链接、owner/repo": "Search uninstalled repos, or paste a GitHub / Git link or owner/repo",
    "收起": "Collapse",
    "新增": "Added",
    "无提交说明": "No commit message",
    "无法打开文件夹": "Couldn't open folder",
    "无法更新": "Can't Update",
    "无法更新策略": "Couldn't update policy",
    "日志：{path}": "Log: {path}",
    "暂无任务记录": "No job history yet",
    "暂无备份": "No backups yet",
    "暂无描述": "No description",
    "暂无提交信息": "No commit info",
    "更多操作": "More Actions",
    "更新": "Update",
    "更新任务完成": "Update Job Complete",
    "更新出错": "Update Error",
    "更新失败": "Update Failed",
    "更新自定义插件": "Update Custom Plugins",
    "更新选中项": "Update Selected",
    "最新": "Latest",
    "最新版": "Up to Date",
    "最近提交": "Recent Commits",
    "有本地修改": "Locally Modified",
    "服务恢复后会自动刷新": "The page will refresh automatically once the server is back",
    "未发现依赖冲突": "No dependency conflicts found",
    "未托管": "Unmanaged",
    "未检查": "Unchecked",
    "未能自动重启": "Couldn't restart automatically",
    "未识别来源": "Unrecognized Source",
    "未配置": "Not Configured",
    "本地修改": "Local Changes",
    "查看最近提交": "View recent commits",
    "查看最近提交记录": "View recent commit history",
    "查看本地修改的具体内容": "View local change details",
    "查看详情": "View Details",
    "查看详情 · {f} 个失败": "View Details · {f} failed",
    "检查中": "Checking",
    "检查中 {a}/{b}": "Checking {a}/{b}",
    "检查依赖": "Checking Dependencies",
    "检查失败": "Check Failed",
    "检查更新": "Check Updates",
    "正在下载": "Downloading",
    "正在克隆": "Cloning",
    "正在准备": "Preparing",
    "正在处理中": "Processing",
    "正在备份": "Backing Up",
    "正在安装插件": "Installing Plugin",
    "正在搜索 GitHub…": "Searching GitHub…",
    "正在搜索官方市场…": "Searching registry…",
    "正在更新插件": "Updating Plugin",
    "正在检查更新": "Checking for Updates",
    "正在检测依赖冲突…": "Checking for dependency conflicts…",
    "正在读取…": "Loading…",
    "正在读取插件信息…": "Loading plugin info…",
    "正在读取最近提交…": "Loading recent commits…",
    "正在读取本地修改…": "Loading local changes…",
    "正在重启 ComfyUI": "Restarting ComfyUI",
    "正在重启…": "Restarting…",
    "没有可显示的提交记录": "No commit history to show",
    "没有可更新的插件": "No plugins to update",
    "没有找到匹配的仓库": "No matching repositories found",
    "没有找到匹配的市场节点": "No matching registry nodes found",
    "没有检测到 requirements.txt 或 pyproject.toml 依赖": "No requirements.txt or pyproject.toml dependencies detected",
    "没有检测到本地修改": "No local changes detected",
    "没有符合条件的已安装插件": "No installed plugins match",
    "没有符合条件的插件": "No plugins match",
    "清单导入失败": "Import Failed",
    "清单导入完成": "Import Complete",
    "版本范围冲突": "Version Range Conflict",
    "由 ComfyUI 服务端在后台执行，不需要保持这个网页开着或者浏览器标签页处于前台。": "Runs in the background on the ComfyUI server - this page doesn't need to stay open or in the foreground.",
    "直接安装": "Install Directly",
    "确认": "Confirm",
    "确认丢弃本地修改": "Confirm Discard Local Changes",
    "确认操作": "Confirm Action",
    "禁用": "Disable",
    "等待处理": "Waiting",
    "策略已更新": "Policy Updated",
    "筛选插件（名称 / 作者 / 提交内容）": "Filter plugins (name / author / commit)",
    "管理中心": "Manager Center",
    "管理器": "Manager",
    "缺少 Git 或官方市场元数据": "Missing Git or registry metadata",
    "自动检查": "Automatic Checks",
    "自定义插件管理": "Custom Node Management",
    "自定义节点管理": "Custom Node Management",
    "落后 {n} 次": "{n} behind",
    "设置": "Settings",
    "设置已保存": "Settings Saved",
    "该提交没有文件变更详情或发布者未提供更新说明。": "This commit has no file-change details, or the author didn't provide release notes.",
    "请手动重启 ComfyUI": "Please restart ComfyUI manually",
    "读取提交失败": "Failed to load commits",
    "读取插件失败": "Failed to load plugins",
    "读取本地修改失败": "Failed to load local changes",
    "超前 {n} 次": "{n} ahead",
    "输入关键词后点击搜索": "Enter a keyword and click search",
    "迁移": "Migration",
    "还原本地修改": "Revert Local Changes",
    "这里只筛选已经装好的插件。要找新插件，请点「安装插件」。": "This only filters already-installed plugins. To find new ones, click \"Install Plugin\".",
    "重启 ComfyUI": "Restart ComfyUI",
    "重命名": "Renamed",
    "重新安装": "Reinstall",
    "重新安装失败": "Reinstall Failed",
    "重新安装完成": "Reinstall Complete",
    "重新安装插件": "Reinstall Plugin",
    "重新打开插件管理器可查看进度": "Reopen the Node Manager to check progress",
    "重新检测": "Recheck",
    "错误": "Error",
    "需要重启后生效": "Needs restart to take effect",
    "高级信息": "Advanced Info",
    "（文件列表不可用）": "(file list unavailable)"
};
function t(zh, vars) {
    let text = currentLang === "en" ? (EN[zh] ?? zh) : zh;
    if (vars) for (const key in vars) text = text.split(`{${key}}`).join(vars[key]);
    return text;
}
function setLang(lang) {
    currentLang = lang === "en" ? "en" : "zh";
    localStorage.setItem(LANG_KEY, currentLang);
    if (state.dialog) {
        state.dialog.querySelector(".cnm-dialog")?.setAttribute("aria-label", t("自定义插件管理"));
        const kicker = state.dialog.querySelector(".cnm-heading .cnm-kicker");
        if (kicker) kicker.textContent = t("自定义节点管理");
        const heading = state.dialog.querySelector(".cnm-heading h2");
        if (heading) heading.textContent = t("插件管理器");
    }
    const toolbarTrigger = document.querySelector(".cnm-toolbar-trigger span");
    if (toolbarTrigger) toolbarTrigger.textContent = t("插件管理器");
    render();
    renderHeaderActions();
    if (state.githubOpen) renderInstallPanel();
}

const typeLabels = { git: "Git 仓库", registry: "官方市场", unmanaged: "未识别来源", self: "管理器", error: "错误" };
const jobKindLabels = { update: "更新", install: "安装" };
const state = { plugins: Array.isArray(cachedPlugins) ? cachedPlugins : [], loading: false, scanProgress: null, remoteRevision: 0, query: "", statusFilter: "all", sort: "name", centerTab: "settings", activeJobs: new Map(), pendingActions: new Set(), needsRestart: sessionStorage.getItem(RESTART_KEY) === "1", restarting: false, lastScan: null, githubToken: false, dialog: null, content: null, progressHost: null, headerActions: null, historyDialog: null, historyContent: null, historyActions: null, installTab: "github", github: { query: "", results: [], total: 0, loading: false, error: "", requestId: 0, page: 1, search: "", searched: false, appendComfyui: true }, registry: { query: "", results: [], total: 0, loading: false, error: "", requestId: 0, page: 1, searched: false }, githubContent: null, githubOpen: false, selected: new Set(), diskUsage: {}, diskUsageTotal: 0, diskUsageLoading: false, dependencyConflicts: null, dependencyConflictsLoading: false };

function setNeedsRestart(value) {
    state.needsRestart = Boolean(value);
    if (state.needsRestart) sessionStorage.setItem(RESTART_KEY, "1");
    else sessionStorage.removeItem(RESTART_KEY);
    updateToolbarButton();
}

function hasActiveTask() {
    if (state.scanProgress) return true;
    for (const job of state.activeJobs.values()) {
        if (job.status === "queued" || job.status === "running") return true;
    }
    return false;
}

function busyPluginNames() {
    const names = new Set(state.pendingActions);
    for (const job of state.activeJobs.values()) {
        for (const [name, item] of Object.entries(job.plugins || {})) {
            if (item.status === "queued" || item.status === "running") names.add(name);
        }
    }
    return names;
}

function updateToolbarButton() {
    const trigger = document.querySelector(".cnm-toolbar-trigger");
    if (!trigger) return;
    trigger.classList.toggle("needs-restart", state.needsRestart);
    trigger.classList.toggle("busy", hasActiveTask());
    trigger.title = [t("插件管理器"), state.needsRestart ? t("需要重启后生效") : "", hasActiveTask() ? t("任务进行中") : ""].filter(Boolean).join(" · ");
}

function toast(severity, summary, detail) {
    app.extensionManager?.toast?.add({ severity, summary, detail, life: 5000 });
}

async function request(path, options) {
    const response = await api.fetchApi(path, options);
    if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
    return response.json();
}

function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

function button(label, handler, kind = "") {
    const element = el("button", `cnm-button ${kind}`.trim(), label);
    element.type = "button";
    element.onclick = handler;
    return element;
}

function menu(label, items, className = "") {
    const details = el("details", `cnm-menu ${className}`.trim());
    const summary = el("summary", "cnm-button secondary small", label);
    summary.setAttribute("aria-label", label === "•••" ? t("更多操作") : label);
    const popover = el("div", "cnm-menu-popover");
    for (const item of items) {
        const action = button(item.label, () => { details.open = false; item.action(); }, item.danger ? "danger" : "");
        if (item.disabled) action.disabled = true;
        popover.append(action);
    }
    details.ontoggle = () => {
        if (!details.open) return;
        document.querySelectorAll(".cnm-menu[open]").forEach((other) => { if (other !== details) other.open = false; });
    };
    details.append(summary, popover);
    return details;
}

function confirmAction(title, message, destructive = false, extra = null) {
    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const overlay = el("div", "cnm-confirm-overlay");
        const dialog = el("div", "cnm-confirm-card");
        dialog.setAttribute("role", "alertdialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.append(el("span", "cnm-kicker", t("确认操作")), el("h3", "", title), el("p", "", message));
        if (extra?.note) dialog.append(el("p", "cnm-confirm-note", extra.note));
        const extraBox = extra?.label ? document.createElement("input") : null;
        if (extraBox) {
            extraBox.type = "checkbox";
            extraBox.checked = extra.checked === true;
            const extraLabel = el("label", "cnm-confirm-extra");
            extraLabel.append(extraBox, document.createTextNode(` ${extra.label}`));
            dialog.append(extraLabel);
        }
        const actions = el("div", "cnm-confirm-actions");
        const finish = (ok) => {
            overlay.remove();
            previousFocus?.focus?.();
            resolve(ok ? (extraBox ? { extra: extraBox.checked } : true) : false);
        };
        const cancel = button(t("取消"), () => finish(false), "secondary");
        const confirm = button(t("确认"), () => finish(true), destructive ? "danger" : "primary");
        actions.append(cancel, confirm); dialog.append(actions); overlay.append(dialog); document.body.append(overlay);
        overlay.onmousedown = (event) => { if (event.target === overlay) finish(false); };
        overlay.onkeydown = (event) => { if (event.key === "Escape") { event.stopPropagation(); finish(false); } };
        requestAnimationFrame(() => confirm.focus());
    });
}

const stageLabels = { waiting: "等待处理", cloning: "正在克隆", downloading: "正在下载", backup: "正在备份", dependency_preview: "检查依赖", updating_code: "拉取代码", installing_dependencies: "安装依赖", complete: "已完成", failed: "失败", locked: "插件忙碌" };

function dependencyPreviewText(item) {
    const preview = item.dependency_preview;
    if (!preview) return "";
    if (preview.error) return t("依赖检查失败：{e}", { e: preview.error });
    if (preview.skipped) return preview.skip_reason || t("已跳过依赖预检，将直接安装");
    const changes = preview.changes || [];
    if (!preview.has_requirements) return t("没有检测到 requirements.txt 或 pyproject.toml 依赖");
    if (!changes.length) return t("依赖无变化（{s}）", { s: preview.source || "requirements" });
    const names = changes.slice(0, 8).map((change) => change.version ? `${change.name}==${change.version}` : change.name).filter(Boolean);
    const extra = changes.length > names.length ? t(" 等 {n} 个包", { n: changes.length }) : "";
    const downgrades = changes.filter((change) => change.downgrade);
    const warning = downgrades.length ? t(" ⚠ 其中 {n} 个会降级（可能影响其他插件）：{list}", { n: downgrades.length, list: downgrades.map((change) => `${change.name} ${change.current_version}→${change.version}`).join("、") }) : "";
    return t("将安装：{names}{extra}{warning}", { names: names.join("、"), extra, warning });
}

function jobProgressPanel(job) {
    const installing = job.kind === "install";
    const entries = Object.entries(job.plugins || {});
    const successful = entries.filter(([, item]) => item.status === "success").length;
    const failed = entries.filter(([, item]) => item.status === "failed").length;
    const finished = successful + failed;
    const running = entries.find(([, item]) => item.status === "running");
    const done = job.status !== "queued" && job.status !== "running";
    const panel = el("section", `cnm-inline-job ${done ? "complete" : "running"}`);
    panel.dataset.jobPanel = "true";
    panel.dataset.jobId = job.id;
    const header = el("div", "cnm-inline-job-header");
    const title = el("div", "cnm-inline-job-title");
    title.append(el("span", "cnm-live-dot"), el("strong", "", done ? (installing ? t("插件安装完成") : t("插件更新完成")) : (installing ? t("正在安装插件") : t("正在更新插件"))), el("small", "", t("{a}/{b} · 成功 {s} · 失败 {f}", { a: finished, b: entries.length, s: successful, f: failed })));
    header.append(title);
    if (done) {
        const actions = el("div", "cnm-inline-job-actions");
        actions.append(button(t("收起"), () => { state.activeJobs.delete(job.id); render(); }, "secondary small"));
        header.append(actions);
    }
    const track = el("div", "cnm-progress-track");
    const bar = el("div", "cnm-progress-bar");
    bar.style.width = `${entries.length ? finished / entries.length * 100 : 0}%`;
    track.append(bar);
    panel.append(header, track);
    const current = el("div", "cnm-current-task");
    if (running) current.append(el("span", "", t("当前插件")), el("strong", "", running[0]), el("code", "", t(stageLabels[running[1].stage]) || running[1].stage));
    else current.append(el("span", "", done ? t("处理结果") : t("任务状态")), el("strong", "", done ? t("{s} 个成功", { s: successful }) : t("正在准备")), el("code", "", failed ? t("{f} 个失败", { f: failed }) : ""));
    panel.append(current);
    const details = el("details", "cnm-inline-job-details");
    if (failed) details.open = true;
    details.append(el("summary", "", failed ? t("查看详情 · {f} 个失败", { f: failed }) : t("查看详情")));
    const list = el("div", "cnm-inline-job-list");
    for (const [name, item] of entries) {
        const row = el("div", `cnm-inline-job-row job-${item.status}`);
        row.append(el("strong", "", name), el("span", "", t(stageLabels[item.stage]) || item.stage));
        const preview = dependencyPreviewText(item);
        if (preview) row.append(el("small", "cnm-job-preview", preview));
        if (item.error) row.append(el("small", "cnm-job-error", item.error));
        if (item.status === "failed" && item.backup_id && !item.rolled_back) {
            const rollbackBtn = button(t("回滚到备份"), () => rollback(item.backup_id), "danger small");
            row.append(rollbackBtn);
        }
        list.append(row);
    }
    details.append(list);
    panel.append(details);
    return panel;
}

function updateJobProgress(job) {
    state.activeJobs.set(job.id, job);
    const current = state.progressHost?.querySelector(`[data-job-id="${job.id}"]`);
    if (current) current.replaceWith(jobProgressPanel(job));
    else if (state.progressHost) state.progressHost.append(jobProgressPanel(job));
}

function scanProgressPanel(progress) {
    const panel = el("section", "cnm-scan-progress");
    const label = el("div", "cnm-scan-label");
    label.append(el("strong", "", t("正在检查更新")), el("span", "", `${progress.done} / ${progress.total}`));
    const track = el("div", "cnm-progress-track");
    const bar = el("div", "cnm-progress-bar");
    bar.style.width = `${progress.total ? progress.done / progress.total * 100 : 0}%`;
    track.append(bar); panel.append(label, track);
    return panel;
}

function filteredPlugins() {
    const query = state.query.trim().toLowerCase();
    const items = state.plugins.filter((plugin) => {
        if (state.statusFilter === "updates" && !plugin.update_available) return false;
        if (state.statusFilter === "dirty" && !plugin.dirty) return false;
        if (state.statusFilter === "error" && !plugin.error) return false;
        if (state.statusFilter === "git" && plugin.type !== "git") return false;
        if (state.statusFilter === "registry" && plugin.type !== "registry") return false;
        if (state.statusFilter === "unmanaged" && plugin.type !== "unmanaged") return false;
        if (state.statusFilter === "ignored" && !plugin.ignored && !plugin.policy?.ignored) return false;
        if (state.statusFilter === "disabled" && !plugin.disabled) return false;
        if (!query) return true;
        const commit = plugin.last_commit || {};
        const version = plugin.type === "registry" ? `${plugin.installed || ""} ${plugin.latest || ""}` : plugin.branch;
        return [plugin.name, plugin.type, version, commit.author, commit.subject].some((value) => String(value || "").toLowerCase().includes(query));
    });
    return items.sort((a, b) => {
        if (state.sort === "status") return (Number(b.behind) || 0) - (Number(a.behind) || 0) || Number(Boolean(b.update_available)) - Number(Boolean(a.update_available)) || a.name.localeCompare(b.name);
        if (state.sort === "date") return String(b.last_commit?.date || "").localeCompare(String(a.last_commit?.date || ""));
        return a.name.localeCompare(b.name);
    });
}

function gitLagText(plugin) {
    if (plugin.type !== "git" || !plugin.checked) return "";
    const behind = Number(plugin.behind) || 0;
    const ahead = Number(plugin.ahead) || 0;
    if (behind && ahead) return t("分叉 · 落后 {n} 次", { n: behind });
    if (behind) return t("落后 {n} 次", { n: behind });
    if (ahead) return t("超前 {n} 次", { n: ahead });
    return "";
}

function statusFor(plugin) {
    if (plugin.error) return [t("错误"), "error"];
    if (plugin.disabled) return [t("已禁用"), "muted"];
    if (plugin.ignored || plugin.policy?.ignored) return [t("已忽略"), "muted"];
    if (plugin.status === "unsupported") return [plugin.message || t("无法更新"), "muted"];
    if (plugin.checking) return [t("检查中"), "checking"];
    if (!plugin.checked && (plugin.type === "git" || plugin.type === "registry")) return [t("未检查"), "muted"];
    const lag = gitLagText(plugin);
    const behind = Number(plugin.behind) || 0;
    const ahead = Number(plugin.ahead) || 0;
    if (lag && behind) return [lag, "update"];
    if (lag && ahead) return [lag, "ahead"];
    if (plugin.update_available) return [t("可更新"), "update"];
    if (plugin.type === "unmanaged") return [t("未托管"), "muted"];
    if (plugin.type === "self") return [t("管理器"), "muted"];
    return [t("最新版"), "current"];
}

function render(options = {}) {
    const container = state.content;
    if (!container) return;
    const scrollTop = container.scrollTop;
    if (options.searchSelection == null && document.activeElement?.matches?.(".cnm-search input")) options.searchSelection = document.activeElement.selectionStart ?? state.query.length;
    container.replaceChildren();
    const checkable = state.plugins.filter((plugin) => !plugin.disabled && (plugin.type === "git" || plugin.type === "registry"));
    const unchecked = checkable.some((plugin) => !plugin.checked && !plugin.checking);
    const updates = state.plugins.filter((plugin) => plugin.update_available);
    const dirty = state.plugins.filter((plugin) => plugin.dirty);
    const errors = state.plugins.filter((plugin) => plugin.error);
    const ignoredPlugins = state.plugins.filter((plugin) => plugin.ignored || plugin.policy?.ignored);
    const busy = busyPluginNames();

    const overview = el("section", "cnm-overview");
    overview.append(el("strong", "", t("{n} 个插件", { n: state.plugins.length })));
    overview.append(el("span", unchecked ? "muted" : "accent", unchecked ? t("尚未检查更新") : t("{n} 个可更新", { n: updates.length })));
    if (dirty.length) overview.append(el("span", "warning", t("{n} 个本地修改", { n: dirty.length })));
    if (errors.length) overview.append(el("span", "danger", t("{n} 个错误", { n: errors.length })));
    if (ignoredPlugins.length) overview.append(el("span", "muted", t("{n} 个已忽略", { n: ignoredPlugins.length })));
    if (Object.keys(state.diskUsage).length) overview.append(el("span", "muted", t("共占用 {size}", { size: formatBytes(state.diskUsageTotal) })));
    if (state.lastScan) overview.append(el("small", "", t("上次检查 {time}", { time: new Date(state.lastScan).toLocaleString() })));

    const controls = el("section", "cnm-controls");
    const searchWrap = el("label", "cnm-search");
    searchWrap.innerHTML = '<i class="pi pi-search"></i>';
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("筛选插件（名称 / 作者 / 提交内容）");
    search.value = state.query;
    search.oninput = (event) => {
        state.query = search.value;
        if (!event.isComposing) render({ searchSelection: search.selectionStart ?? search.value.length });
    };
    search.oncompositionend = () => {
        state.query = search.value;
        render({ searchSelection: search.value.length });
    };
    searchWrap.append(search);
    const statusFilter = document.createElement("select");
    statusFilter.className = "cnm-select";
    for (const [value, label] of [["all", "全部"], ["updates", "可更新"], ["dirty", "本地修改"], ["error", "错误"], ["disabled", "已禁用"], ["ignored", "已忽略"], ["git", "Git 仓库"], ["registry", "官方市场"], ["unmanaged", "未识别来源"]]) statusFilter.add(new Option(t(label), value));
    statusFilter.value = state.statusFilter;
    statusFilter.onchange = () => { state.statusFilter = statusFilter.value; render(); };
    const sort = menu(t("排序"), [["name", "按名称"], ["status", "按状态"], ["date", "按更新时间"]].map(([value, label]) => ({ label: `${state.sort === value ? "✓ " : ""}${t(label)}`, action: () => { state.sort = value; render(); } })), "cnm-sort-menu");
    const refresh = button(state.loading && state.scanProgress ? t("检查中 {a}/{b}", { a: state.scanProgress.done, b: state.scanProgress.total }) : t("检查更新"), scanPlugins, "secondary");
    refresh.disabled = state.loading;
    const install = button(t("安装插件"), openInstallPanel, "secondary");
    const pendingUpdates = updates.filter((plugin) => !busy.has(plugin.name));
    const updateAll = button(`${t("一键更新")} ${unchecked ? "" : (pendingUpdates.length || "")}`.trim(), () => updatePlugins(pendingUpdates.map((plugin) => plugin.name)), "primary");
    updateAll.disabled = state.loading || unchecked || !pendingUpdates.length;
    controls.append(searchWrap, statusFilter, sort, refresh, install, updateAll);

    let bulkBar = null;
    if (state.selected.size) {
        bulkBar = el("section", "cnm-bulk-bar");
        bulkBar.append(el("span", "", t("已选 {n} 个插件", { n: state.selected.size })));
        const selectableNow = [...state.selected].filter((name) => !busy.has(name));
        const updateSelected = button(t("更新选中项"), () => updatePlugins(selectableNow), "primary small");
        updateSelected.disabled = state.loading || !selectableNow.length;
        const clearSelection = button(t("取消选择"), () => { state.selected.clear(); render(); }, "secondary small");
        bulkBar.append(updateSelected, clearSelection);
    }

    const table = el("section", "cnm-table");
    const head = el("div", "cnm-table-head");
    const headCheckbox = document.createElement("input");
    headCheckbox.type = "checkbox";
    const selectablePlugins = filteredPlugins().filter((plugin) => plugin.type !== "self" && !plugin.disabled);
    headCheckbox.checked = selectablePlugins.length > 0 && selectablePlugins.every((plugin) => state.selected.has(plugin.name));
    headCheckbox.title = t("全选/全不选（当前筛选结果）");
    headCheckbox.onchange = () => {
        if (headCheckbox.checked) selectablePlugins.forEach((plugin) => state.selected.add(plugin.name));
        else selectablePlugins.forEach((plugin) => state.selected.delete(plugin.name));
        render();
    };
    const headCheckboxCell = el("span", "cnm-select-cell");
    headCheckboxCell.append(headCheckbox);
    head.append(headCheckboxCell);
    for (const title of ["插件", "状态", "分支", "占用", "最后更新", "操作"]) head.append(el("span", "", t(title)));
    table.append(head);
    const plugins = filteredPlugins();
    if (!plugins.length) {
        const empty = el("div", "cnm-empty", state.loading ? t("正在读取插件信息…") : (state.query.trim() ? t("没有符合条件的已安装插件") : t("没有符合条件的插件")));
        if (state.query.trim() && !state.loading) {
            empty.append(el("p", "cnm-empty-hint", t("这里只筛选已经装好的插件。要找新插件，请点「安装插件」。")));
            empty.append(button(t("安装插件"), openInstallPanel, "secondary"));
        }
        table.append(empty);
    }

    for (const plugin of plugins) {
        const row = el("div", `cnm-table-row ${plugin.update_available ? "has-update" : ""}`);
        const selectCell = el("div", "cnm-select-cell");
        if (plugin.type !== "self" && !plugin.disabled) {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = state.selected.has(plugin.name);
            checkbox.onchange = () => {
                if (checkbox.checked) state.selected.add(plugin.name);
                else state.selected.delete(plugin.name);
                render();
            };
            selectCell.append(checkbox);
        }
        const identity = el("div", "cnm-identity");
        if (plugin.repository_url) {
            const nameLink = el("a", "cnm-plugin-link", plugin.name);
            nameLink.href = plugin.repository_url;
            nameLink.target = "_blank";
            nameLink.rel = "noopener noreferrer";
            nameLink.title = t("打开远程仓库：{url}", { url: plugin.repository_url });
            identity.append(nameLink);
        } else {
            identity.append(el("strong", "", plugin.name));
        }
        if (!["git", "registry"].includes(plugin.type)) identity.append(el("small", "", t(typeLabels[plugin.type]) || plugin.type || "unknown"));
        const [statusText, statusTone] = statusFor(plugin);
        const status = el("div", "cnm-status-cell");
        const badge = el("span", `cnm-badge ${statusTone}`, statusText);
        if (plugin.type === "git" || plugin.type === "registry") {
            badge.classList.add("clickable");
            badge.tabIndex = 0;
            badge.title = t("查看最近提交记录");
            badge.onclick = () => openHistory(plugin.name);
            badge.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") openHistory(plugin.name); };
        }
        status.append(badge);
        if (plugin.dirty) {
            const dirtyNote = el("small", "cnm-dirty", t("有本地修改"));
            if (plugin.type === "git") {
                dirtyNote.classList.add("clickable");
                dirtyNote.tabIndex = 0;
                dirtyNote.title = t("查看本地修改的具体内容");
                dirtyNote.onclick = () => openLocalDiff(plugin.name);
                dirtyNote.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") openLocalDiff(plugin.name); };
            }
            status.append(dirtyNote);
        }
        const branch = el("div", "cnm-branch");
        branch.append(el("code", "", plugin.branch || "—"));
        const sizeBytes = state.diskUsage[plugin.name];
        const sizeCell = el("div", "cnm-size-cell", sizeBytes != null ? formatBytes(sizeBytes) : (state.diskUsageLoading ? "…" : "—"));
        const commit = plugin.last_commit || {};
        const commitCell = el("div", "cnm-commit");
        const subject = plugin.error || commit.subject || (plugin.type === "unmanaged" ? t("缺少 Git 或官方市场元数据") : t("暂无提交信息"));
        commitCell.append(el("strong", "", subject));
        const meta = [commit.date ? new Date(commit.date).toLocaleString() : "", commit.author].filter(Boolean).join(" · ");
        if (meta) commitCell.append(el("small", "", meta));
        if (plugin.type === "git" || plugin.type === "registry") {
            commitCell.classList.add("clickable");
            commitCell.tabIndex = 0;
            commitCell.title = t("查看最近提交");
            commitCell.onclick = () => openHistory(plugin.name);
            commitCell.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") openHistory(plugin.name); };
        }
        const action = el("div", "cnm-action");
        const pluginBusy = busy.has(plugin.name);
        if (plugin.type !== "self") {
            const more = [];
            if (plugin.disabled) {
                action.append(button(t("启用"), () => lifecycle(plugin.name, "enable"), "primary small"));
            } else {
                if (plugin.update_available) {
                    const update = button(t("更新"), () => updatePlugins([plugin.name]), "primary small");
                    update.disabled = pluginBusy;
                    update.title = pluginBusy ? t("正在处理中") : "";
                    action.append(update);
                }
                if (plugin.status === "unsupported" && plugin.installed) {
                    more.push({ label: t("固定当前版本"), action: () => setPolicy(plugin.name, { strategy: "pinned", pinned_ref: plugin.installed }) });
                }
                // Local edits with no upstream update: offer a reset separate from "更新" (update),
                // since nothing new is actually available - labeling this "更新" reads as if there
                // were a remote change to pull, when it's really just discarding local edits.
                if (plugin.dirty && !plugin.update_available) {
                    more.push({ label: t("还原本地修改"), action: () => updatePlugins([plugin.name]), disabled: pluginBusy });
                }
                if (plugin.type === "git" || plugin.type === "registry") {
                    more.push({ label: t("重新安装"), action: () => reinstallPlugin(plugin.name), disabled: pluginBusy });
                }
                more.push({ label: t("禁用"), action: () => lifecycle(plugin.name, "disable"), disabled: pluginBusy });
            }
            more.unshift({ label: t("打开目录"), action: () => openPluginFolder(plugin.name) });
            if (plugin.ignored || plugin.policy?.ignored) more.push({ label: t("取消忽略"), action: () => setPolicy(plugin.name, { ignored: false, ignore_until: "", ignore_version: "" }) });
            else if (!plugin.disabled) more.push({ label: t("忽略更新"), action: () => setPolicy(plugin.name, { ignored: true, ignore_version: plugin.latest || "" }) });
            more.push({ label: t("卸载"), action: () => lifecycle(plugin.name, "uninstall"), danger: true, disabled: pluginBusy });
            action.append(menu("•••", more, "cnm-row-menu"));
        }
        row.append(selectCell, identity, status, branch, sizeCell, commitCell, action);
        table.append(row);
    }
    container.append(overview, controls);
    if (bulkBar) container.append(bulkBar);
    container.append(table);
    container.scrollTop = options.searchSelection != null ? container.scrollTop : scrollTop;
    state.progressHost.replaceChildren();
    state.progressHost.classList.toggle("open", Boolean(state.scanProgress || state.activeJobs.size));
    if (state.scanProgress) state.progressHost.append(scanProgressPanel(state.scanProgress));
    for (const job of state.activeJobs.values()) state.progressHost.append(jobProgressPanel(job));
    if (options.searchSelection != null) {
        const nextSearch = container.querySelector(".cnm-search input");
        nextSearch.focus({ preventScroll: true });
        nextSearch.setSelectionRange(options.searchSelection, options.searchSelection);
    }
    renderHeaderActions();
    updateToolbarButton();
}

function renderHeaderActions() {
    const host = state.headerActions;
    if (!host) return;
    host.replaceChildren();
    if (state.needsRestart) {
        const restart = button(state.restarting ? t("正在重启…") : t("重启 ComfyUI"), restartComfy, "primary");
        restart.disabled = state.restarting;
        host.append(restart);
    }
    const lang = button(currentLang === "en" ? "中" : "EN", () => setLang(currentLang === "en" ? "zh" : "en"), "icon");
    lang.setAttribute("aria-label", "Language");
    lang.title = currentLang === "en" ? "切换到中文" : "Switch to English";
    lang.style.fontSize = "12px";
    host.append(lang);
    const settings = button("⚙", openManagerCenter, "icon");
    settings.setAttribute("aria-label", t("管理中心"));
    settings.title = t("管理中心");
    host.append(settings);
    const close = button("×", closeDialog, "icon");
    close.setAttribute("aria-label", t("关闭"));
    host.append(close);
    updateToolbarButton();
}

async function restartComfy() {
    if (state.restarting) return;
    if (!(await confirmAction(t("重启 ComfyUI"), t("即将重启 ComfyUI 以加载插件变更。请确认工作流已保存。")))) return;
    state.restarting = true;
    sessionStorage.removeItem(RESTART_KEY);
    render();
    toast("info", t("正在重启 ComfyUI"), t("服务恢复后会自动刷新"));
    const electron = window.comfyElectronApi || window.electronAPI;
    try {
        if (typeof electron?.restartApp === "function") {
            await electron.restartApp();
            return;
        }
        if (typeof electron?.relaunch === "function") {
            await electron.relaunch();
            return;
        }
    } catch (_) {}
    try {
        await request("/custom-node-manager/restart", { method: "POST" });
    } catch (_) {}
    let tries = 0;
    let down = false;
    const timer = setInterval(async () => {
        tries += 1;
        try {
            const response = await fetch("./", { cache: "no-store" });
            if (down && response.ok) {
                clearInterval(timer);
                location.reload();
                return;
            }
        } catch (_) {
            down = true;
        }
        if (tries > 45) {
            clearInterval(timer);
            state.restarting = false;
            setNeedsRestart(true);
            toast("error", t("未能自动重启"), t("请手动重启 ComfyUI"));
            render();
        }
    }, 1000);
}

async function scanPlugins() {
    if (state.loading) return;
    state.loading = true;
    state.remoteRevision += 1;
    const traceId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const targets = state.plugins.filter((plugin) => !plugin.disabled && (plugin.type === "git" || plugin.type === "registry"));
    state.scanProgress = { done: 0, total: targets.length };
    state.plugins = state.plugins.map((plugin) => targets.some((target) => target.name === plugin.name) ? { ...plugin, checking: true } : plugin);
    render();
    try {
        let cursor = 0;
        const worker = async () => {
            while (cursor < targets.length) {
                const target = targets[cursor++];
                try {
                    const result = await request(`/custom-node-manager/scan-one?name=${encodeURIComponent(target.name)}&trace_id=${encodeURIComponent(traceId)}`);
                    const index = state.plugins.findIndex((plugin) => plugin.name === target.name);
                    if (index >= 0) state.plugins[index] = result.plugin;
                } catch (error) {
                    const index = state.plugins.findIndex((plugin) => plugin.name === target.name);
                    if (index >= 0) state.plugins[index] = { ...state.plugins[index], checking: false, checked: true, update_available: false, error: error.message };
                }
                state.scanProgress.done += 1;
                localStorage.setItem(CACHE_KEY, JSON.stringify(state.plugins));
                render();
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
        localStorage.setItem(CACHE_KEY, JSON.stringify(state.plugins));
        toast("info", t("插件检查完成"), t("发现 {n} 个更新", { n: state.plugins.filter((plugin) => plugin.update_available).length }));
        state.lastScan = new Date().toISOString();
    } catch (error) { toast("error", t("检查失败"), error.message); }
    finally { state.loading = false; state.scanProgress = null; render(); }
}

function mergeLocalWithChecked(locals, previous) {
    const priorByName = new Map(previous.map((plugin) => [plugin.name, plugin]));
    return locals.map((plugin) => {
        const prior = priorByName.get(plugin.name);
        if (plugin.disabled || plugin.checked || !prior?.checked || plugin.installed !== prior.installed || (plugin.last_commit?.hash || "") !== (prior.last_commit?.hash || "")) return plugin;
        return {
            ...plugin,
            latest: prior.latest,
            update_available: prior.update_available,
            checking: false,
            checked: true,
            ahead: prior.ahead,
            behind: prior.behind,
            git_state: prior.git_state,
            last_commit: prior.last_commit || plugin.last_commit,
            error: prior.error,
        };
    });
}

function applyJobPluginResults(job) {
    let changed = false;
    for (const [name, item] of Object.entries(job.plugins || {})) {
        if (item.status !== "success" || !item.result) continue;
        const index = state.plugins.findIndex((plugin) => plugin.name === name);
        const next = { ...(index >= 0 ? state.plugins[index] : {}), ...item.result, name, checking: false };
        if (index >= 0) state.plugins[index] = next;
        else state.plugins.push(next);
        changed = true;
    }
    if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(state.plugins));
}

async function loadLocalPlugins() {
    const remoteRevision = state.remoteRevision;
    try {
        const result = await request("/custom-node-manager/local");
        if (state.remoteRevision !== remoteRevision) return;
        let merged = mergeLocalWithChecked(result.plugins, state.plugins);
        // Fill in anything still unchecked (e.g. a fresh page load with an empty local cache) from
        // the server's own background scheduled-check results, so "update available" is visible
        // immediately instead of waiting for the user to click "检查更新" once.
        if (result.background_scan?.plugins?.length) merged = mergeLocalWithChecked(merged, result.background_scan.plugins);
        state.plugins = merged;
        state.lastScan = result.last_scan || state.lastScan;
        state.githubToken = result.github_token === true;
        // Drop selections for plugins that no longer exist or got disabled (e.g. uninstalled, or
        // disabled by a lifecycle action) so a stale checkbox can't be bulk-updated by mistake.
        const stillSelectable = new Set(state.plugins.filter((plugin) => !plugin.disabled).map((plugin) => plugin.name));
        for (const name of [...state.selected]) if (!stillSelectable.has(name)) state.selected.delete(name);
        localStorage.setItem(CACHE_KEY, JSON.stringify(state.plugins));
        render();
    } catch (error) { toast("error", t("读取插件失败"), error.message); }
}

async function openPluginFolder(name) {
    try {
        await request("/custom-node-manager/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    } catch (error) { toast("error", t("无法打开文件夹"), error.message); }
}

function closeHistory() {
    state.historyDialog?.classList.remove("open");
    state.githubOpen = false;
}

function renderHistory(result) {
    const content = state.historyContent;
    content.replaceChildren();
    if (!result.commits.length) {
        content.append(el("div", "cnm-empty", t("没有可显示的提交记录")));
        return;
    }
    for (const [index, commit] of result.commits.entries()) {
        if (commit.truncated) content.append(el("div", "cnm-history-gap", t("中间提交已省略，下面是当前版本")));
        const item = el("details", `cnm-history-item${commit.current ? " current" : ""}${commit.latest ? " latest" : ""}`);
        if (commit.current || commit.latest) item.open = true;
        const summary = el("summary", "cnm-history-summary");
        const marker = el("span", "cnm-history-marker", commit.current && commit.latest ? t("当前 · 最新") : commit.current ? t("当前") : commit.latest ? t("最新") : String(index + 1).padStart(2, "0"));
        const title = el("div", "cnm-history-title");
        title.append(el("strong", "", commit.subject || t("无提交说明")));
        const meta = [commit.date ? new Date(commit.date).toLocaleString() : "", commit.author].filter(Boolean).join(" · ");
        if (meta) title.append(el("small", "", meta));
        summary.append(marker, title);
        const body = el("div", "cnm-history-body");
        if (commit.body) body.append(el("p", "cnm-history-message", commit.body));
        if (commit.changes?.length) {
            const files = el("div", "cnm-history-files");
            for (const change of commit.changes) {
                const file = el("div", "cnm-history-file");
                file.append(el("span", `cnm-file-status status-${change.status?.[0] || "M"}`, change.status || "M"), el("code", "", change.path));
                files.append(file);
            }
            body.append(files);
        } else if (!commit.body) {
            body.append(el("p", "cnm-history-message muted", t("该提交没有文件变更详情或发布者未提供更新说明。")));
        }
        item.append(summary, body);
        content.append(item);
    }
    const currentItem = content.querySelector(".cnm-history-item.current");
    if (currentItem) requestAnimationFrame(() => currentItem.scrollIntoView({ block: "center", behavior: "smooth" }));
}

function ensureHistoryDialog() {
    if (state.historyDialog) return;
    const overlay = el("div", "cnm-history-overlay");
    const dialog = el("div", "cnm-history-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const header = el("header", "cnm-history-header");
    const heading = el("div", "cnm-history-heading");
    heading.append(el("span", "", t("最近提交")), el("h3", "", t("最近提交")));
    const actions = el("div", "cnm-header-actions");
    state.historyActions = el("div", "cnm-header-actions");
    const close = button("×", closeHistory, "icon");
    close.setAttribute("aria-label", t("关闭提交记录"));
    actions.append(state.historyActions, close);
    header.append(heading, actions);
    state.historyContent = el("main", "cnm-history-content");
    dialog.append(header, state.historyContent);
    overlay.append(dialog);
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeHistory(); });
    document.body.append(overlay);
    state.historyDialog = overlay;
}

async function openHistory(name) {
    state.githubOpen = false;
    ensureHistoryDialog();
    state.historyActions.replaceChildren();
    state.historyContent.replaceChildren(el("div", "cnm-empty", t("正在读取最近提交…")));
    state.historyDialog.classList.add("open");
    try {
        const result = await request(`/custom-node-manager/history?name=${encodeURIComponent(name)}`);
        state.historyDialog.querySelector(".cnm-history-heading span").textContent = t("最近提交");
        state.historyDialog.querySelector("h3").textContent = t("{name} · 最近提交", { name: result.name });
        renderHistory(result);
    } catch (error) {
        state.historyContent.replaceChildren(el("div", "cnm-empty", error.message));
        toast("error", t("读取提交失败"), error.message);
    }
}

const diffStatusLabels = { added: "新增", modified: "修改", deleted: "删除", renamed: "重命名" };

// Converts a unified diff (as produced by `git diff`) into side-by-side hunks: each hunk is
// {header, rows: [{left, right, context}]}. Consecutive runs of removed ("-") lines are paired
// row-by-row against the following run of added ("+") lines (GitHub's split-view convention) -
// unequal-length runs leave the shorter side blank for the extra rows, and a pure addition or
// pure deletion naturally has every row blank on one side.
function unifiedToSideBySide(diffText) {
    const hunks = [];
    let current = null;
    let pendingRemoved = [];
    let pendingAdded = [];
    const flushPending = () => {
        if (!current) return;
        const max = Math.max(pendingRemoved.length, pendingAdded.length);
        for (let i = 0; i < max; i++) {
            current.rows.push({ left: pendingRemoved[i] ?? null, right: pendingAdded[i] ?? null });
        }
        pendingRemoved = [];
        pendingAdded = [];
    };
    for (const line of (diffText || "").split("\n")) {
        if (line.startsWith("@@")) {
            flushPending();
            current = { header: line, rows: [] };
            hunks.push(current);
        } else if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")
            || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("similarity index")
            || line.startsWith("rename from") || line.startsWith("rename to") || line.startsWith("\\ ")) {
            // file-level metadata / "no newline at end of file" marker - not a content line
        } else if (!current) {
            // stray line before any hunk header (shouldn't happen for a real diff) - ignore
        } else if (line.startsWith("-")) {
            pendingRemoved.push(line.slice(1));
        } else if (line.startsWith("+")) {
            pendingAdded.push(line.slice(1));
        } else {
            flushPending();
            const text = line.startsWith(" ") ? line.slice(1) : line;
            current.rows.push({ left: text, right: text, context: true });
        }
    }
    flushPending();
    return hunks;
}

function diffCell(text, kind) {
    const cell = el("div", `cnm-diff-cell ${kind}`);
    cell.textContent = text ?? "";
    return cell;
}

function renderSplitDiff(diffText) {
    const hunks = unifiedToSideBySide(diffText);
    if (!hunks.length) return null;
    const grid = el("div", "cnm-diff-split");
    for (const hunk of hunks) {
        grid.append(el("div", "cnm-diff-hunk-header", hunk.header));
        for (const row of hunk.rows) {
            if (row.context) {
                grid.append(diffCell(row.left, "ctx"), diffCell(row.right, "ctx"));
            } else {
                grid.append(
                    diffCell(row.left, row.left == null ? "empty" : "del"),
                    diffCell(row.right, row.right == null ? "empty" : "add"),
                );
            }
        }
    }
    return grid;
}

function renderLocalDiff(result) {
    const content = state.historyContent;
    content.replaceChildren();
    if (!result.files.length) {
        content.append(el("div", "cnm-empty", t("没有检测到本地修改")));
        return;
    }
    if (result.total_changed > result.shown) {
        content.append(el("p", "cnm-history-gap", t("共 {a} 个文件有改动，仅显示前 {b} 个", { a: result.total_changed, b: result.shown })));
    }
    for (const file of result.files) {
        const item = el("details", "cnm-history-item");
        item.open = result.files.length <= 5;
        const summary = el("summary", "cnm-history-summary");
        const marker = el("span", "cnm-history-marker", t(diffStatusLabels[file.status]) || file.status);
        const title = el("div", "cnm-history-title");
        title.append(el("strong", "", file.old_path && file.old_path !== file.path ? `${file.old_path} → ${file.path}` : file.path));
        summary.append(marker, title);
        const body = el("div", "cnm-history-body");
        const split = renderSplitDiff(file.diff);
        if (split) body.append(split);
        else body.append(el("p", "cnm-history-message muted", (file.diff || "").trim() || t("(没有内容可显示)")));
        if (file.truncated) body.append(el("small", "cnm-history-message muted", t("内容过长，已截断显示")));
        item.append(summary, body);
        content.append(item);
    }
}

async function openLocalDiff(name) {
    state.githubOpen = false;
    ensureHistoryDialog();
    state.historyActions.replaceChildren();
    state.historyContent.replaceChildren(el("div", "cnm-empty", t("正在读取本地修改…")));
    state.historyDialog.classList.add("open");
    try {
        const result = await request(`/custom-node-manager/local-diff?name=${encodeURIComponent(name)}`);
        state.historyDialog.querySelector(".cnm-history-heading span").textContent = t("本地修改");
        state.historyDialog.querySelector("h3").textContent = t("{name} · 本地修改", { name: result.name });
        if (result.files.length) {
            const pluginBusy = busyPluginNames().has(name);
            const reset = button(t("还原本地修改"), () => updatePlugins([name]), "danger small");
            reset.disabled = pluginBusy;
            reset.title = pluginBusy ? t("正在处理中") : "";
            state.historyActions.replaceChildren(reset);
        }
        renderLocalDiff(result);
    } catch (error) {
        state.historyContent.replaceChildren(el("div", "cnm-empty", error.message));
        toast("error", t("读取本地修改失败"), error.message);
    }
}

function openUtility(title, kicker) {
    ensureHistoryDialog();
    state.historyActions.replaceChildren();
    state.historyDialog.querySelector(".cnm-history-heading span").textContent = kicker || t("插件操作");
    state.historyDialog.querySelector("h3").textContent = title;
    state.historyContent.replaceChildren(el("div", "cnm-empty", t("正在读取…")));
    state.historyDialog.classList.add("open");
    return state.historyContent;
}

function looksLikeGithub(query) {
    const value = String(query || "").trim();
    return /github\.com[:/]/i.test(value) || /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?$/.test(value);
}

function looksLikeGitUrl(query) {
    const value = String(query || "").trim();
    return looksLikeGithub(value) || /^(https?:\/\/|git@|ssh:\/\/)/i.test(value);
}

function formatStars(count) {
    if (count >= 10000) return `${Math.round(count / 1000)}k`;
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(count);
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = -1;
    do { value /= 1024; unit += 1; } while (value >= 1024 && unit < units.length - 1);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

async function loadDiskUsage() {
    if (state.diskUsageLoading) return;
    state.diskUsageLoading = true;
    try {
        const result = await request("/custom-node-manager/disk-usage");
        state.diskUsage = result.sizes || {};
        state.diskUsageTotal = result.total || 0;
    } catch (_) {
        // best-effort - the table just keeps showing "—" for size if this fails
    } finally {
        state.diskUsageLoading = false;
        render();
    }
}

function repoInstalled(repo) {
    if (repo.installed) return true;
    const url = String(repo.url || repo.repository_url || "").replace(/\.git$/i, "").toLowerCase();
    return state.plugins.some((plugin) => {
        if (plugin.name.toLowerCase() === String(repo.name || repo.id || "").toLowerCase()) return true;
        const remote = String(plugin.repository_url || "").replace(/\.git$/i, "").toLowerCase();
        return Boolean(url) && remote === url;
    });
}

function renderInstallPanel(options = {}) {
    const content = state.githubContent;
    if (!state.githubOpen || !content) return;
    const tab = state.installTab;
    const source = tab === "registry" ? state.registry : state.github;
    if (options.searchSelection == null && document.activeElement?.matches?.(".cnm-github-search input")) options.searchSelection = document.activeElement.selectionStart ?? source.query.length;
    content.replaceChildren();
    const tabs = el("div", "cnm-install-tabs");
    const githubTab = button("GitHub / Git", () => { state.installTab = "github"; renderInstallPanel(); }, state.installTab === "github" ? "primary small" : "secondary small");
    const registryTab = button(t("官方市场"), () => { state.installTab = "registry"; renderInstallPanel(); }, state.installTab === "registry" ? "primary small" : "secondary small");
    tabs.append(githubTab, registryTab);
    content.append(tabs);
    const toolbar = el("div", "cnm-github-toolbar");
    const searchWrap = el("label", "cnm-search cnm-github-search");
    searchWrap.innerHTML = '<i class="pi pi-search"></i>';
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = tab === "registry" ? t("搜索官方市场节点名或作者") : t("搜索未安装的仓库，或粘贴 GitHub / Git 链接、owner/repo");
    search.value = source.query;
    search.oninput = () => { source.query = search.value; };
    const submitSearch = () => { source.query = search.value; tab === "registry" ? searchRegistry(source.query) : searchGithub(source.query); };
    search.onkeydown = (event) => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        submitSearch();
    };
    searchWrap.append(search);
    toolbar.append(searchWrap, button(t("搜索"), submitSearch, "primary"));
    content.append(toolbar);
    if (source.loading) content.append(el("div", "cnm-empty", tab === "registry" ? t("正在搜索官方市场…") : t("正在搜索 GitHub…")));
    else if (source.error) {
        const message = /rate limit/i.test(source.error) ? t("GitHub API 达到限额：{e}", { e: source.error }) : source.error;
        content.append(el("div", "cnm-empty", message));
        if (tab === "github" && looksLikeGitUrl(source.query)) {
            const row = el("div", "cnm-github-row");
            const identity = el("div", "cnm-identity");
            identity.append(el("strong", "", source.query.trim()), el("small", "", t("搜索失败时仍可按此地址直接克隆")));
            const action = el("div", "cnm-action");
            const install = button(t("直接安装"), () => installGithubRepo({ url: source.query.trim(), full_name: source.query.trim() }), "primary small");
            install.disabled = state.loading;
            action.append(install);
            row.append(identity, el("div", "cnm-github-meta"), action);
            content.append(row);
        }
    } else if (!source.searched) content.append(el("div", "cnm-empty", t("输入关键词后点击搜索")));
    else if (!source.results.length) content.append(el("div", "cnm-empty", tab === "registry" ? t("没有找到匹配的市场节点") : t("没有找到匹配的仓库")));
    else if (tab === "github") {
        content.append(el("p", "cnm-github-hint", t("共 {a} 个结果，显示 {b} 个", { a: source.total, b: source.results.length })));
        for (const repo of source.results) {
            const installed = repoInstalled(repo);
            const row = el("div", `cnm-github-row${installed ? " installed" : ""}`);
            const identity = el("div", "cnm-identity");
            if (repo.url) {
                const nameLink = el("a", "cnm-plugin-link", repo.full_name || repo.name);
                nameLink.href = repo.url;
                nameLink.target = "_blank";
                nameLink.rel = "noopener noreferrer";
                identity.append(nameLink);
            } else {
                identity.append(el("strong", "", repo.full_name || repo.name));
            }
            identity.append(el("small", "", repo.description || t("暂无描述")));
            const meta = el("div", "cnm-github-meta");
            meta.append(el("span", "cnm-github-stars", `★ ${formatStars(repo.stars)}`));
            if (repo.language) meta.append(el("span", "", repo.language));
            if (repo.updated_at) meta.append(el("span", "", new Date(repo.updated_at).toLocaleDateString()));
            if (repo.archived) meta.append(el("span", "cnm-badge muted", t("已归档")));
            const action = el("div", "cnm-action");
            if (installed) action.append(el("span", "cnm-badge current", t("已安装")));
            else {
                const install = button(t("安装"), () => installGithubRepo(repo), "primary small");
                install.disabled = state.loading;
                action.append(install);
            }
            row.append(identity, meta, action);
            content.append(row);
        }
        if (source.results.length < source.total) content.append(button(t("加载更多"), () => searchGithub(source.query, source.page + 1, true), "secondary"));
    } else {
        content.append(el("p", "cnm-github-hint", t("共 {a} 个结果，显示 {b} 个", { a: source.total, b: source.results.length })));
        for (const node of source.results) {
            const installed = repoInstalled(node);
            const row = el("div", `cnm-github-row${installed ? " installed" : ""}`);
            const identity = el("div", "cnm-identity");
            identity.append(el("strong", "", node.title || node.name));
            identity.append(el("small", "", [node.id, node.publisher, node.description].filter(Boolean).join(" · ") || t("暂无描述")));
            const meta = el("div", "cnm-github-meta");
            if (node.stars) meta.append(el("span", "cnm-github-stars", `★ ${formatStars(node.stars)}`));
            if (node.version) meta.append(el("span", "", `v${node.version}`));
            if (node.updated_at) meta.append(el("span", "", new Date(node.updated_at).toLocaleDateString()));
            const action = el("div", "cnm-action");
            if (installed) action.append(el("span", "cnm-badge current", t("已安装")));
            else {
                const install = button(t("安装"), () => installRegistryNode(node), "primary small");
                install.disabled = state.loading;
                action.append(install);
            }
            row.append(identity, meta, action);
            content.append(row);
        }
        if (source.results.length < source.total) content.append(button(t("加载更多"), () => searchRegistry(source.query, source.page + 1, true), "secondary"));
    }
    if (options.searchSelection != null) {
        const nextSearch = content.querySelector(".cnm-github-search input");
        nextSearch.focus({ preventScroll: true });
        nextSearch.setSelectionRange(options.searchSelection, options.searchSelection);
    }
}

function githubSelection() {
    return document.activeElement?.matches?.(".cnm-github-search input") ? document.activeElement.selectionStart : null;
}

async function searchGithub(query, page = 1, append = false) {
    const requestId = state.github.requestId + 1;
    state.github.requestId = requestId;
    state.github.query = query;
    state.github.searched = true;
    state.github.page = page;
    state.github.loading = true;
    state.github.error = "";
    renderInstallPanel({ searchSelection: githubSelection() });
    try {
        const result = await request(`/custom-node-manager/github/search?q=${encodeURIComponent(query)}&page=${page}&append_comfyui=${state.github.appendComfyui ? "1" : "0"}`);
        if (state.github.requestId !== requestId) return;
        state.github.results = append ? state.github.results.concat(result.repos || []) : (result.repos || []);
        state.github.total = result.total || 0;
        state.github.search = result.search || query;
        state.github.page = result.page || page;
    } catch (error) {
        if (state.github.requestId !== requestId) return;
        if (!append) {
            state.github.results = [];
            state.github.total = 0;
        }
        state.github.error = error.message;
    } finally {
        if (state.github.requestId === requestId) {
            state.github.loading = false;
            renderInstallPanel({ searchSelection: githubSelection() });
        }
    }
}

async function searchRegistry(query, page = 1, append = false) {
    const requestId = state.registry.requestId + 1;
    state.registry.requestId = requestId;
    state.registry.query = query;
    state.registry.searched = true;
    state.registry.page = page;
    state.registry.loading = true;
    state.registry.error = "";
    renderInstallPanel({ searchSelection: githubSelection() });
    try {
        const result = await request(`/custom-node-manager/registry/search?q=${encodeURIComponent(query)}&page=${page}`);
        if (state.registry.requestId !== requestId) return;
        state.registry.results = append ? state.registry.results.concat(result.nodes || []) : (result.nodes || []);
        state.registry.total = result.total || 0;
        state.registry.page = result.page || page;
    } catch (error) {
        if (state.registry.requestId !== requestId) return;
        if (!append) {
            state.registry.results = [];
            state.registry.total = 0;
        }
        state.registry.error = error.message;
    } finally {
        if (state.registry.requestId === requestId) {
            state.registry.loading = false;
            renderInstallPanel({ searchSelection: githubSelection() });
        }
    }
}

async function startInstallJob(path, body, title) {
    closeHistory();
    state.loading = true;
    render();
    try {
        const result = await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        state.activeJobs.set(result.job.id, result.job);
        state.loading = false;
        render();
        pollJob(result.job.id).catch((error) => toast("error", title, error.message));
    } catch (error) {
        state.loading = false;
        toast("error", title, error.message);
        render();
    }
}

async function installGithubRepo(repo) {
    const target = repo.full_name || repo.url || state.github.query.trim();
    const ref = repo.ref || "";
    if (!(await confirmAction(t("安装 Git 插件"), t("将克隆 {target} 到 custom_nodes 文件夹。安装后需要重启 ComfyUI。是否继续？", { target })))) return;
    await startInstallJob("/custom-node-manager/github/install", { url: repo.url || repo.full_name || state.github.query.trim(), ref }, t("安装失败"));
}

async function installRegistryNode(node) {
    if (!(await confirmAction(t("安装官方市场插件"), t("将下载 {name} 到 custom_nodes/{id}。安装后需要重启 ComfyUI。是否继续？", { name: node.title || node.id, id: node.id })))) return;
    await startInstallJob("/custom-node-manager/registry/install", { id: node.id, folder: node.id }, t("安装失败"));
}

function openInstallPanel() {
    state.githubOpen = true;
    state.githubContent = openUtility(t("安装插件"), t("安装新插件"));
    renderInstallPanel();
}

function propertyRow(label, value) {
    const row = el("div", "cnm-property");
    row.append(el("span", "", label), el("code", "", String(value ?? "—")));
    return row;
}

async function lifecycle(name, action) {
    const labels = { disable: "禁用", enable: "启用", uninstall: "卸载" };
    const actionLabel = t(labels[action]);
    const message = action === "uninstall"
        ? t("卸载 {name}？操作前会自动创建备份，可在管理中心回滚。", { name })
        : t("{action} {name}？此操作只会重命名插件文件夹。", { action: actionLabel, name });
    if (!(await confirmAction(t("{action}插件", { action: actionLabel }), message, action === "uninstall"))) return;
    try {
        await request("/custom-node-manager/lifecycle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, action }) });
        toast("success", t("{action}完成", { action: actionLabel }), t("必须重启 ComfyUI 后才会生效"));
        setNeedsRestart(true);
        closeHistory();
        await loadLocalPlugins();
    } catch (error) { toast("error", t("{action}失败", { action: actionLabel }), error.message); }
}

async function reinstallPlugin(name) {
    if (busyPluginNames().has(name)) {
        toast("warn", t("插件正在处理中"), t("{name} 已经在处理中，请稍候", { name }));
        return;
    }
    if (!(await confirmAction(t("重新安装插件"), t("将删除并重新拉取/下载 {name}，本地修改会丢失（操作前会自动备份，可在管理中心回滚）。是否继续？", { name }), true))) return;
    state.pendingActions.add(name);
    closeHistory();
    render();
    try {
        await request("/custom-node-manager/reinstall", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        toast("success", t("重新安装完成"), t("必须重启 ComfyUI 后才会生效"));
        setNeedsRestart(true);
        await loadLocalPlugins();
    } catch (error) { toast("error", t("重新安装失败"), error.message); }
    finally { state.pendingActions.delete(name); render(); }
}

function downloadJson(data, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function rollback(backupId) {
    if (!(await confirmAction(t("回滚插件"), t("将插件恢复到此备份，并覆盖当前目录。是否继续？"), true))) return;
    try { await request("/custom-node-manager/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup_id: backupId }) }); setNeedsRestart(true); toast("success", t("回滚完成"), t("必须重启 ComfyUI 后才会生效")); await loadLocalPlugins(); }
    catch (error) { toast("error", t("回滚失败"), error.message); }
}

async function deleteBackup(backupId) {
    if (!(await confirmAction(t("删除备份"), t("删除后无法恢复这个备份文件。是否继续？"), true))) return;
    try { await request("/custom-node-manager/backup/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup_id: backupId }) }); toast("success", t("备份已删除"), ""); openManagerCenter(); }
    catch (error) { toast("error", t("删除备份失败"), error.message); }
}

async function setPolicy(name, values) {
    try {
        await request("/custom-node-manager/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...values }) });
        toast("success", t("策略已更新"), name);
        await loadLocalPlugins();
    } catch (error) { toast("error", t("无法更新策略"), error.message); }
}

function renderDependencyConflicts(container) {
    container.replaceChildren();
    if (state.dependencyConflictsLoading || state.dependencyConflicts === null) {
        container.append(el("div", "cnm-empty", t("正在检测依赖冲突…")));
        return;
    }
    const conflicts = state.dependencyConflicts || [];
    if (!conflicts.length) {
        container.append(el("div", "cnm-empty", t("未发现依赖冲突")));
        return;
    }
    for (const item of conflicts) {
        const row = el("div", "cnm-property");
        const reqText = item.requirements.map((r) => `${r.plugin}: ${r.requirement}`).join(" · ");
        row.append(el("span", "", item.package), el("code", "", reqText));
        const tone = item.pairwise_conflict ? "error" : "ahead";
        const label = item.pairwise_conflict ? t("版本范围冲突") : t("与已安装版本不符");
        row.append(el("span", `cnm-badge ${tone}`, label));
        row.append(el("small", "", item.installed_version ? t("当前已安装 {v}", { v: item.installed_version }) : ""));
        container.append(row);
    }
}

async function loadDependencyConflicts(force) {
    if (state.dependencyConflicts && !force) return;
    state.dependencyConflictsLoading = true;
    openManagerCenter();
    try {
        const result = await request("/custom-node-manager/dependency-conflicts");
        state.dependencyConflicts = result.conflicts || [];
    } catch (error) {
        state.dependencyConflicts = [];
        toast("error", t("依赖冲突检测失败"), error.message);
    } finally {
        state.dependencyConflictsLoading = false;
        openManagerCenter();
    }
}

async function openManagerCenter() {
    state.githubOpen = false;
    const content = openUtility(t("管理中心"), t("插件管理设置"));
    try {
        const data = await request("/custom-node-manager/state");
        state.lastScan = data.last_scan || state.lastScan;
        state.githubToken = data.github_token === true;
        content.replaceChildren();
        const tabs = el("nav", "cnm-center-tabs");
        for (const [value, label] of [["settings", t("设置")], ["backups", t("备份 {n}", { n: data.backups.length })], ["jobs", t("任务记录")], ["conflicts", t("依赖冲突")]]) tabs.append(button(label, () => { state.centerTab = value; openManagerCenter(); }, state.centerTab === value ? "primary small" : "secondary small"));
        content.append(tabs);
        if (state.centerTab === "settings") {
            const settings = el("section", "cnm-center-section");
            settings.append(el("h4", "", t("自动检查")));
            const scheduled = document.createElement("input"); scheduled.type = "checkbox"; scheduled.checked = data.settings.scheduled_check;
            const interval = document.createElement("input"); interval.type = "number"; interval.min = "1"; interval.max = "168"; interval.value = data.settings.check_interval_hours;
            settings.append(scheduled, document.createTextNode(t(" 启用，每 ")), interval, document.createTextNode(t(" 小时")), button(t("保存"), async () => { await request("/custom-node-manager/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduled_check: scheduled.checked, check_interval_hours: Number(interval.value) }) }); toast("success", t("设置已保存"), ""); }, "secondary"));
            settings.append(el("p", "cnm-github-hint", t("由 ComfyUI 服务端在后台执行，不需要保持这个网页开着或者浏览器标签页处于前台。")));
            const transfer = el("section", "cnm-center-section"); transfer.append(el("h4", "", t("迁移")));
            const importInput = document.createElement("input"); importInput.type = "file"; importInput.accept = ".json"; importInput.hidden = true;
            importInput.onchange = async () => {
                try {
                    const manifest = JSON.parse(await importInput.files[0].text());
                    const result = await request("/custom-node-manager/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manifest }) });
                    if (result.needs_restart) setNeedsRestart(true);
                    toast(result.failed?.length ? "warn" : "success", t("清单导入完成"), t("恢复 {a} 个，跳过 {b} 个，失败 {c} 个", { a: result.restored.length, b: result.skipped?.length || 0, c: result.failed?.length || 0 }));
                    render();
                } catch (error) { toast("error", t("清单导入失败"), error.message); }
            };
            transfer.append(button(t("导出插件清单"), async () => downloadJson(await request("/custom-node-manager/export"), "comfyui-custom-nodes.json"), "secondary"), button(t("导入插件清单"), () => importInput.click(), "secondary"), importInput);
            const advanced = el("details", "cnm-center-section cnm-center-advanced");
            advanced.append(el("summary", "", t("高级信息")), el("p", "cnm-github-hint", t("GitHub Token：{s}", { s: data.github_token ? t("已配置") : t("未配置") })));
            if (data.log_file) advanced.append(el("p", "cnm-github-hint", t("日志：{path}", { path: data.log_file })));
            content.append(settings, transfer, advanced);
        } else if (state.centerTab === "backups") {
            const backups = el("section", "cnm-center-section");
            if (data.backups.length) backups.append(el("p", "cnm-github-hint", t("共 {n} 份备份，占用 {size}", { n: data.backups.length, size: formatBytes(data.backups_total_size || 0) })));
            if (!data.backups.length) backups.append(el("div", "cnm-empty", t("暂无备份")));
            for (const item of data.backups) {
                const row = propertyRow(item.plugin, `${new Date(item.created_at).toLocaleString()} · ${formatBytes(item.size || 0)}`);
                row.append(button(t("回滚"), () => rollback(item.id), "secondary small"), button(t("删除"), () => deleteBackup(item.id), "danger small"));
                backups.append(row);
            }
            content.append(backups);
        } else if (state.centerTab === "conflicts") {
            const wrap = el("section", "cnm-center-section");
            wrap.append(el("h4", "", t("依赖冲突检测")));
            wrap.append(el("p", "cnm-github-hint", t("对比所有已启用插件声明的 Python 依赖版本范围，找出互相冲突或者与当前已安装版本不符的情况。这是启发式检测，仅供参考。")));
            const refresh = button(t("重新检测"), () => loadDependencyConflicts(true), "secondary");
            refresh.disabled = state.dependencyConflictsLoading;
            wrap.append(refresh);
            content.append(wrap);
            const resultBox = el("section", "cnm-center-section");
            content.append(resultBox);
            renderDependencyConflicts(resultBox);
            if (!state.dependencyConflicts && !state.dependencyConflictsLoading) loadDependencyConflicts(false);
        } else {
            const jobs = el("section", "cnm-center-section");
            if (!data.jobs.length) jobs.append(el("div", "cnm-empty", t("暂无任务记录")));
            for (const job of data.jobs.slice().reverse()) {
                const details = el("details", "cnm-job-details");
                const failed = Object.values(job.plugins || {}).filter((item) => item.status === "failed").length;
                const summary = el("summary", "");
                summary.append(el("strong", "", t(jobKindLabels[job.kind]) || job.kind || t("任务")), el("span", "", `${job.status}${failed ? t(" · {n} 个失败", { n: failed }) : ""} · ${job.created_at ? new Date(job.created_at).toLocaleString() : ""}`));
                details.append(summary);
                for (const [name, item] of Object.entries(job.plugins || {})) {
                    const row = el("div", `cnm-property job-${item.status}`);
                    row.append(el("span", "", name), el("code", "", `${item.status} · ${t(stageLabels[item.stage]) || item.stage}`));
                    if (item.error) row.append(el("small", "cnm-job-error", item.error));
                    if (item.status === "failed" && item.backup_id && !item.rolled_back) row.append(button(t("回滚"), () => rollback(item.backup_id), "danger small"));
                    details.append(row);
                }
                jobs.append(details);
            }
            content.append(jobs);
        }
    } catch (error) { content.replaceChildren(el("div", "cnm-empty", error.message)); }
}

async function pollJob(jobId) {
    let fingerprint = "";
    while (true) {
        const job = await request(`/custom-node-manager/job/${jobId}`);
        const entries = Object.entries(job.plugins);
        const terminal = job.status !== "queued" && job.status !== "running";
        const nextFingerprint = entries.map(([name, item]) => `${name}:${item.status}:${item.stage}:${item.error || ""}:${(item.dependency_preview?.changes || []).length}`).join("|");
        if (nextFingerprint !== fingerprint || terminal) {
            fingerprint = nextFingerprint;
            updateJobProgress(job);
        }
        if (terminal) {
            toast(job.status === "success" ? "success" : "warn", job.kind === "install" ? t("安装任务完成") : t("更新任务完成"), job.needs_restart ? t("必须重启 ComfyUI 后才会生效") : "");
            if (job.needs_restart) setNeedsRestart(true);
            await loadLocalPlugins();
            applyJobPluginResults(job);
            render();
            return job;
        }
        await new Promise((resolve) => setTimeout(resolve, document.hidden ? 3000 : 1500));
    }
}

function dirtyChangesNote(names) {
    const lines = names.slice(0, 3).map((name) => {
        const plugin = state.plugins.find((item) => item.name === name);
        const changes = plugin?.local_changes || [];
        const shown = changes.slice(0, 4);
        const extra = changes.length - shown.length;
        const files = shown.join("、") + (extra > 0 ? t(" 等 {n} 个文件", { n: extra }) : "");
        return t("{name}：{files}", { name, files: files || t("（文件列表不可用）") });
    });
    if (names.length > 3) lines.push(t("……以及另外 {n} 个插件", { n: names.length - 3 }));
    return lines.join("\n");
}

async function updatePlugins(names) {
    if (!names.length) return;
    const busyNow = busyPluginNames();
    const skippedBusy = names.filter((name) => busyNow.has(name));
    names = names.filter((name) => !busyNow.has(name));
    if (!names.length) {
        toast("warn", t("插件正在处理中"), t("所选插件已经在更新中，请稍候"));
        return;
    }
    if (skippedBusy.length) toast("info", t("已跳过正在处理的插件"), skippedBusy.join("、"));
    const dirty = names.filter((name) => state.plugins.find((plugin) => plugin.name === name)?.dirty);
    // "Pure revert": none of the targets actually have a remote update, they were only included
    // because they have local edits. Word the dialog around discarding edits, not "更新" (update) -
    // there is nothing upstream to pull.
    const pureRevert = dirty.length > 0 && names.every((name) => !state.plugins.find((plugin) => plugin.name === name)?.update_available);
    const result = names.length === 1 && !dirty.length ? true : await confirmAction(
        pureRevert ? t("还原本地修改") : t("更新自定义插件"),
        dirty.length
            ? (pureRevert
                ? t("将丢弃 {n} 个插件的本地修改，恢复到当前已安装版本（没有可用的远端更新）：\n{note}", { n: names.length, note: dirtyChangesNote(dirty) })
                : t("将更新 {n} 个插件，其中 {d} 个有本地修改。未勾选强制同步时会跳过这些插件；勾选后这些插件里列出的本地修改会被丢弃：\n{note}", { n: names.length, d: dirty.length, note: dirtyChangesNote(dirty) }))
            : t("将更新 {n} 个插件。是否继续？", { n: names.length }),
        Boolean(dirty.length),
        { ...(dirty.length ? { label: pureRevert ? t("确认丢弃本地修改") : t("丢弃本地修改，强制与远端一致"), checked: false } : {}), note: t("失败时会自动回滚到更新前备份。") },
    );
    if (!result) return;
    const force = result !== true && result.extra === true;
    const targets = force ? names : names.filter((name) => !state.plugins.find((plugin) => plugin.name === name)?.dirty);
    if (!targets.length) {
        toast("warn", t("没有可更新的插件"), t("存在本地修改的插件未强制同步"));
        return;
    }
    for (const name of targets) state.selected.delete(name);
    closeHistory();
    state.loading = true;
    render();
    try {
        const response = await request("/custom-node-manager/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: targets, force }) });
        state.activeJobs.set(response.job.id, response.job);
        state.loading = false;
        render();
        pollJob(response.job.id).catch((error) => toast("error", t("更新出错"), error.message));
    } catch (error) {
        state.loading = false;
        toast("error", t("更新失败"), error.message);
        render();
    }
}

async function closeDialog() {
    if (!state.dialog) return;
    if (hasActiveTask()) {
        if (!(await confirmAction(t("任务仍在进行"), t("关闭窗口不会取消任务。可以重新打开插件管理器查看进度。是否关闭？")))) return;
        toast("info", t("任务仍在后台进行"), t("重新打开插件管理器可查看进度"));
    }
    state.dialog.classList.remove("open");
    document.body.classList.remove("cnm-modal-open");
    updateToolbarButton();
}

function ensureDialog() {
    if (state.dialog) return;
    const overlay = el("div", "cnm-overlay");
    const dialog = el("div", "cnm-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t("自定义插件管理"));
    const header = el("header", "cnm-header");
    const heading = el("div", "cnm-heading");
    heading.append(el("span", "cnm-kicker", t("自定义节点管理")), el("h2", "", t("插件管理器")));
    state.headerActions = el("div", "cnm-header-actions");
    header.append(heading, state.headerActions);
    renderHeaderActions();
    state.content = el("main", "cnm-content");
    state.progressHost = el("footer", "cnm-progress-dock");
    dialog.append(header, state.content, state.progressHost);
    overlay.append(dialog);
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeDialog(); });
    dialog.addEventListener("mousedown", (event) => {
        if (event.target.closest(".cnm-menu")) return;
        dialog.querySelectorAll(".cnm-menu[open]").forEach((item) => { item.open = false; });
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (state.historyDialog?.classList.contains("open")) closeHistory();
        else closeDialog();
    });
    document.body.append(overlay);
    state.dialog = overlay;
}

function openDialog() {
    ensureDialog();
    state.dialog.classList.add("open");
    document.body.classList.add("cnm-modal-open");
    render();
    loadLocalPlugins();
    loadDiskUsage();
}

function mountToolbarButton() {
    if (document.querySelector(".cnm-toolbar-group")) return;
    const settingsGroup = app.menu?.settingsGroup?.element;
    if (!settingsGroup) { setTimeout(mountToolbarButton, 250); return; }
    const group = el("div", "comfyui-button-group cnm-toolbar-group");
    const trigger = el("button", "comfyui-button cnm-toolbar-trigger");
    trigger.type = "button";
    trigger.title = t("插件管理器");
    trigger.innerHTML = `<i class="pi pi-wrench"></i><span>${t("插件管理器")}</span>`;
    trigger.onclick = openDialog;
    group.append(trigger);
    settingsGroup.before(group);
    updateToolbarButton();
}

const style = document.createElement("style");
style.textContent = `
:root{--cnm-accent:#6b7500;--cnm-on-accent:#ffffff;--cnm-accent-border-solid:#565f00;--cnm-accent-tint-1:rgba(107,117,0,.05);--cnm-accent-tint-2:rgba(107,117,0,.07);--cnm-accent-tint-3:rgba(107,117,0,.13);--cnm-accent-tint-4:rgba(107,117,0,.3);--cnm-accent-tint-5:rgba(107,117,0,.48);--cnm-bg:#f5f6f8;--cnm-bg-alt:#eceef2;--cnm-bg-raised:#ffffff;--cnm-bg-sunken:#eef0f3;--cnm-bg-row:#ffffff;--cnm-bg-row-hover:#eef0f3;--cnm-line:rgba(0,0,0,.12);--cnm-line-soft:rgba(0,0,0,.06);--cnm-border-strong:rgba(0,0,0,.18);--cnm-border-hover:rgba(0,0,0,.28);--cnm-fill:rgba(0,0,0,.05);--cnm-fill-soft:rgba(0,0,0,.03);--cnm-muted:#5b6270;--cnm-text:#1b1e22;--cnm-text-soft:#3a3f47;--cnm-text-code:#20242a;--cnm-success:#1f8a5c;--cnm-success-bg:rgba(31,138,92,.12);--cnm-danger:#c43d3d;--cnm-danger-bg:rgba(196,61,61,.12);--cnm-danger-border:rgba(196,61,61,.4);--cnm-warning:#9a6b00;--cnm-warning-bg:rgba(154,107,0,.12);--cnm-warning-soft:#8a6400;--cnm-info:#2266cc;--cnm-info-bg:rgba(34,102,204,.12);--cnm-info-border:rgba(34,102,204,.22);--cnm-info-bg-soft:rgba(34,102,204,.05)}html.dark-theme{--cnm-accent:#d7ff3f;--cnm-on-accent:#101207;--cnm-accent-border-solid:#b9dd33;--cnm-accent-tint-1:rgba(215,255,63,.055);--cnm-accent-tint-2:rgba(215,255,63,.08);--cnm-accent-tint-3:rgba(215,255,63,.14);--cnm-accent-tint-4:rgba(215,255,63,.28);--cnm-accent-tint-5:rgba(215,255,63,.42);--cnm-bg:#16181c;--cnm-bg-alt:#1d2025;--cnm-bg-raised:#24272d;--cnm-bg-sunken:#111317;--cnm-bg-row:#181a1f;--cnm-bg-row-hover:#1d2025;--cnm-line:rgba(255,255,255,.09);--cnm-line-soft:rgba(255,255,255,.045);--cnm-border-strong:rgba(255,255,255,.14);--cnm-border-hover:rgba(255,255,255,.24);--cnm-fill:rgba(255,255,255,.07);--cnm-fill-soft:rgba(255,255,255,.02);--cnm-muted:#9097a3;--cnm-text:#f4f6f8;--cnm-text-soft:#c7cdd4;--cnm-text-code:#dfe4ea;--cnm-success:#67d9a4;--cnm-success-bg:rgba(72,199,142,.13);--cnm-danger:#ff8080;--cnm-danger-bg:rgba(255,107,107,.14);--cnm-danger-border:rgba(255,107,107,.35);--cnm-warning:#ffbd4a;--cnm-warning-bg:rgba(255,189,74,.14);--cnm-warning-soft:#ffcf72;--cnm-info:#79afff;--cnm-info-bg:rgba(75,151,255,.14);--cnm-info-border:rgba(75,151,255,.2);--cnm-info-bg-soft:rgba(75,151,255,.045)}.cnm-modal-open{overflow:hidden}.cnm-toolbar-trigger{display:flex!important;align-items:center;gap:7px}.cnm-toolbar-trigger i{color:var(--cnm-accent)}.cnm-overlay{position:fixed;inset:0;z-index:10020;display:none;align-items:center;justify-content:center;padding:28px;background:rgba(5,6,8,.72);backdrop-filter:blur(7px)}.cnm-overlay.open{display:flex;animation:cnm-fade .16s ease-out}.cnm-dialog{width:min(1380px,96vw);height:min(850px,92vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--cnm-border-strong);border-radius:14px;background:var(--cnm-bg);color:var(--cnm-text);box-shadow:0 28px 90px rgba(0,0,0,.55)}.cnm-header{display:flex;align-items:center;justify-content:space-between;padding:22px 26px 18px;border-bottom:1px solid var(--cnm-line);background:linear-gradient(110deg,var(--cnm-accent-tint-2),transparent 36%)}.cnm-heading{display:flex;flex-direction:column;align-items:flex-start;gap:3px}.cnm-heading h2{margin:0;font-family:"Bahnschrift Condensed","Arial Narrow",sans-serif;font-size:28px;letter-spacing:.02em}.cnm-header-actions,.cnm-inline-job-actions{display:flex;align-items:center;gap:8px}.cnm-kicker{width:max-content;margin-bottom:3px;padding:4px 7px;border:1px solid var(--cnm-accent-tint-5);border-radius:4px;color:var(--cnm-accent);font:700 9px/1.2 Consolas,monospace;letter-spacing:.14em}.cnm-content{flex:1;overflow:auto;padding:18px 24px 26px}.cnm-overview{display:flex;align-items:center;gap:8px;min-height:28px;margin-bottom:4px;color:var(--cnm-muted);font-size:11px}.cnm-overview>*:not(:first-child)::before{content:"·";margin-right:8px;color:var(--cnm-muted)}.cnm-overview strong{color:var(--cnm-text);font-size:13px}.cnm-overview .accent{color:var(--cnm-accent)}.cnm-overview .warning{color:var(--cnm-warning)}.cnm-overview .danger{color:var(--cnm-danger)}.cnm-overview small{margin-left:auto;color:var(--cnm-muted)}.cnm-controls{position:sticky;top:-18px;z-index:5;display:flex;align-items:center;gap:9px;padding:12px 0;background:var(--cnm-bg)}.cnm-search{display:flex;align-items:center;gap:8px;min-width:260px;flex:1;padding:0 11px;border:1px solid var(--cnm-line);border-radius:7px;background:var(--cnm-bg-sunken)}.cnm-search i{color:var(--cnm-muted)}.cnm-search input{width:100%;height:38px;border:0;outline:0;background:transparent;color:var(--cnm-text)}.cnm-check{white-space:nowrap;color:var(--cnm-text-soft);font-size:12px}.cnm-button{height:38px;padding:0 14px;border:1px solid var(--cnm-line);border-radius:7px;background:var(--cnm-bg-raised);color:var(--cnm-text);cursor:pointer;font-weight:600}.cnm-button:hover:not(:disabled){border-color:var(--cnm-border-hover);filter:brightness(1.08)}.cnm-button:disabled{opacity:.45;cursor:default}.cnm-button.primary{border-color:var(--cnm-accent-border-solid);background:var(--cnm-accent);color:var(--cnm-on-accent)}.cnm-button.secondary{background:var(--cnm-bg-raised)}.cnm-button.small{height:30px;padding:0 10px;font-size:12px}.cnm-button.icon{width:38px;padding:0;font-size:22px;background:transparent}.cnm-table{min-width:1120px;border:1px solid var(--cnm-line);border-radius:9px;overflow:visible}.cnm-table-head,.cnm-table-row{display:grid;grid-template-columns:22px minmax(190px,1fr) 120px minmax(100px,.5fr) 74px minmax(260px,1.5fr) minmax(125px,auto);align-items:center;column-gap:14px}.cnm-select-cell{display:flex;align-items:center;justify-content:center}.cnm-size-cell{overflow:hidden;color:var(--cnm-muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.cnm-table-head{padding:10px 14px;border-radius:8px 8px 0 0;background:var(--cnm-bg-sunken);color:var(--cnm-muted);font:700 10px/1 Consolas,monospace;letter-spacing:.11em;text-transform:uppercase}.cnm-table-row{position:relative;min-height:66px;padding:8px 14px;border-top:1px solid var(--cnm-line);background:var(--cnm-bg-row)}.cnm-table-row:last-child{border-radius:0 0 8px 8px}.cnm-table-row:hover{z-index:2;background:var(--cnm-bg-alt)}.cnm-table-row.has-update{box-shadow:inset 3px 0 var(--cnm-accent)}.cnm-identity,.cnm-status-cell,.cnm-branch,.cnm-commit{display:flex;min-width:0;flex-direction:column;gap:4px}.cnm-identity strong,.cnm-commit strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.cnm-identity small,.cnm-commit small,.cnm-status-cell small{overflow:hidden;color:var(--cnm-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.cnm-status-cell{align-items:flex-start}.cnm-branch code{overflow:hidden;color:var(--cnm-text-code);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.cnm-badge{width:max-content;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700}.cnm-badge.current{background:var(--cnm-success-bg);color:var(--cnm-success)}.cnm-badge.update{background:var(--cnm-accent-tint-3);color:var(--cnm-accent)}.cnm-badge.checking{background:var(--cnm-info-bg);color:var(--cnm-info)}.cnm-badge.error{background:var(--cnm-danger-bg);color:var(--cnm-danger)}.cnm-badge.ahead{background:var(--cnm-warning-bg);color:var(--cnm-warning)}.cnm-dirty{color:var(--cnm-warning)!important}.cnm-action{display:flex;justify-content:flex-end;align-items:center;gap:6px}.cnm-empty{padding:46px;text-align:center;color:var(--cnm-muted)}@keyframes cnm-fade{from{opacity:0}to{opacity:1}}@media(max-width:900px){.cnm-overlay{padding:10px}.cnm-dialog{width:100%;height:96vh}.cnm-content{padding:12px}.cnm-overview{flex-wrap:wrap}.cnm-overview small{width:100%;margin-left:0}.cnm-controls{flex-wrap:wrap;top:-12px}.cnm-search{min-width:100%}}
`;
document.head.append(style);

const historyStyle = document.createElement("style");
historyStyle.textContent = `.cnm-commit.clickable,.cnm-badge.clickable,.cnm-dirty.clickable{cursor:pointer}.cnm-commit.clickable{margin:-5px;padding:5px;border-radius:6px}.cnm-commit.clickable:hover,.cnm-commit.clickable:focus{outline:0;background:var(--cnm-accent-tint-2)}.cnm-badge.clickable:hover,.cnm-badge.clickable:focus{outline:0;filter:brightness(1.25)}.cnm-dirty.clickable{text-decoration:underline dotted;text-underline-offset:2px}.cnm-dirty.clickable:hover,.cnm-dirty.clickable:focus{outline:0;color:var(--cnm-accent)!important}.cnm-diff-split{display:grid;grid-template-columns:1fr 1fr;gap:1px;border:1px solid var(--cnm-line);border-radius:6px;overflow:auto;max-height:420px;background:var(--cnm-line);font:11px/1.6 Consolas,monospace}.cnm-diff-hunk-header{grid-column:1/-1;padding:4px 10px;background:var(--cnm-bg-alt);color:var(--cnm-accent);font-weight:700}.cnm-diff-cell{padding:1px 10px;background:var(--cnm-bg-sunken);color:var(--cnm-text);white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere}.cnm-diff-cell.empty{background:var(--cnm-bg-sunken)}.cnm-diff-cell.del{background:var(--cnm-danger-bg);color:var(--cnm-danger)}.cnm-diff-cell.add{background:var(--cnm-success-bg);color:var(--cnm-success)}@media(max-width:700px){.cnm-diff-split{grid-template-columns:1fr}.cnm-diff-cell.empty{display:none}}.cnm-history-overlay{position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;padding:42px;background:rgba(4,5,7,.68);backdrop-filter:blur(4px)}.cnm-history-overlay.open{display:flex;animation:cnm-fade .14s ease-out}.cnm-history-dialog{width:min(980px,90vw);height:min(760px,86vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--cnm-accent-tint-4);border-radius:12px;background:var(--cnm-bg);color:var(--cnm-text);box-shadow:0 34px 100px rgba(0,0,0,.68)}.cnm-history-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--cnm-line);background:linear-gradient(100deg,var(--cnm-accent-tint-2),transparent 45%)}.cnm-history-heading span{color:var(--cnm-accent);font:700 9px/1 Consolas,monospace;letter-spacing:.15em}.cnm-history-heading h3{margin:5px 0 0;font:700 22px/1.1 "Bahnschrift Condensed","Arial Narrow",sans-serif}.cnm-history-content{flex:1;overflow:auto;padding:16px 20px 24px}.cnm-history-item{border-bottom:1px solid var(--cnm-line)}.cnm-history-summary{display:flex;align-items:center;gap:12px;padding:14px 4px;cursor:pointer;list-style:none}.cnm-history-summary::-webkit-details-marker{display:none}.cnm-history-marker{width:auto;min-width:38px;flex:0 0 auto;padding:4px 6px;border:1px solid var(--cnm-line);border-radius:4px;color:var(--cnm-muted);font:700 9px/1 Consolas,monospace;text-align:center;white-space:nowrap}.cnm-history-item.latest .cnm-history-marker{border-color:var(--cnm-accent-tint-5);color:var(--cnm-accent)}.cnm-history-item.current{background:var(--cnm-accent-tint-1);box-shadow:inset 3px 0 var(--cnm-accent)}.cnm-history-item.current .cnm-history-marker{border-color:var(--cnm-accent);background:var(--cnm-accent-tint-3);color:var(--cnm-accent)}.cnm-history-gap{margin:8px 4px;padding:8px 12px;border:1px dashed var(--cnm-line);border-radius:6px;color:var(--cnm-muted);font-size:11px;text-align:center}.cnm-history-title{display:flex;min-width:0;flex-direction:column;gap:4px}.cnm-history-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.cnm-history-title small{color:var(--cnm-muted);font-size:10px}.cnm-history-body{padding:0 4px 16px 54px}.cnm-history-message{margin:0 0 10px;padding:10px 12px;border-left:2px solid var(--cnm-accent-tint-5);background:var(--cnm-fill-soft);color:var(--cnm-text-soft);font-size:12px;line-height:1.55;white-space:pre-wrap}.cnm-history-message.muted{border-left-color:var(--cnm-line);color:var(--cnm-muted)}.cnm-history-files{overflow:hidden;border:1px solid var(--cnm-line);border-radius:6px}.cnm-history-file{display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid var(--cnm-line);font-size:11px}.cnm-history-file:first-child{border-top:0}.cnm-history-file code{overflow-wrap:anywhere;color:var(--cnm-text-soft)}.cnm-file-status{width:22px;flex:0 0 22px;font:700 10px/1 Consolas,monospace;text-align:center}.status-A{color:var(--cnm-success)}.status-D{color:var(--cnm-danger)}.status-M,.status-R{color:var(--cnm-warning-soft)}@media(max-width:700px){.cnm-history-overlay{padding:10px}.cnm-history-dialog{width:100%;height:94vh}.cnm-history-body{padding-left:4px}}`;
document.head.append(historyStyle);

const linkStyle = document.createElement("style");
linkStyle.textContent = `.cnm-plugin-link{overflow:hidden;color:var(--cnm-text);font-size:13px;font-weight:700;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}.cnm-plugin-link:hover,.cnm-plugin-link:focus{color:var(--cnm-accent);outline:0;text-decoration:underline;text-underline-offset:3px}`;
document.head.append(linkStyle);

const managerStyle = document.createElement("style");
managerStyle.textContent = `.cnm-select{height:38px;padding:0 10px;border:1px solid var(--cnm-line);border-radius:7px;background:var(--cnm-bg-sunken);color:var(--cnm-text);outline:0}.cnm-select:focus{border-color:var(--cnm-accent-tint-5)}.cnm-button.danger{border-color:var(--cnm-danger-border);color:var(--cnm-danger)}.cnm-property{display:grid;grid-template-columns:minmax(130px,.35fr) minmax(180px,1fr) auto auto;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--cnm-line);font-size:12px}.cnm-property span:first-child{color:var(--cnm-muted)}.cnm-property span:last-child{overflow-wrap:anywhere}.cnm-center-tabs{position:sticky;top:-16px;z-index:3;display:flex;gap:7px;margin:-4px 0 14px;padding:4px 0 12px;background:var(--cnm-bg)}.cnm-center-section{margin-bottom:16px;padding:16px;border:1px solid var(--cnm-line);border-radius:8px;background:var(--cnm-fill-soft)}.cnm-center-section h4{margin:0 0 13px;font-size:13px}.cnm-center-section>.cnm-button,.cnm-center-section>input{margin-right:8px}.cnm-center-advanced,.cnm-install-advanced{padding:10px 12px}.cnm-center-advanced summary,.cnm-install-advanced summary{cursor:pointer;color:var(--cnm-muted);font-size:12px;font-weight:700}.cnm-center-advanced[open] summary,.cnm-install-advanced[open] summary{margin-bottom:10px;color:var(--cnm-text)}.cnm-menu{position:relative}.cnm-menu>summary{display:flex;align-items:center;justify-content:center;list-style:none}.cnm-menu>summary::-webkit-details-marker{display:none}.cnm-menu-popover{position:absolute;top:calc(100% + 6px);right:0;z-index:20;display:flex;min-width:150px;flex-direction:column;padding:5px;border:1px solid var(--cnm-border-strong);border-radius:8px;background:var(--cnm-bg-raised);box-shadow:0 16px 45px rgba(0,0,0,.5)}.cnm-menu-popover .cnm-button{height:32px;border:0;background:transparent;text-align:left;white-space:nowrap}.cnm-menu-popover .cnm-button:hover:not(:disabled){background:var(--cnm-fill)}.cnm-menu-popover .cnm-button.danger{color:var(--cnm-danger)}.cnm-sort-menu .cnm-menu-popover{left:0;right:auto}.cnm-progress-track{grid-column:1/-1;height:4px;overflow:hidden;border-radius:99px;background:var(--cnm-fill)}.cnm-progress-bar{height:100%;border-radius:inherit;background:var(--cnm-accent);transition:width .25s ease}.cnm-job-error{grid-column:1/-1;overflow-wrap:anywhere;color:var(--cnm-danger)}@media(max-width:900px){.cnm-select{flex:1}.cnm-property{grid-template-columns:1fr}.cnm-center-tabs{top:-12px}}`;
document.head.append(managerStyle);

const inlineJobStyle = document.createElement("style");
inlineJobStyle.textContent = `.cnm-progress-dock{display:none;flex:0 0 auto;max-height:300px;overflow:hidden;padding:12px 24px 14px;border-top:1px solid var(--cnm-line);background:var(--cnm-bg-sunken);box-shadow:0 -14px 34px rgba(0,0,0,.28)}.cnm-progress-dock.open{display:block}.cnm-inline-job{margin:0;padding:13px 16px;border:1px solid var(--cnm-accent-tint-4);border-radius:9px;background:linear-gradient(110deg,var(--cnm-accent-tint-1),rgba(255,255,255,.015) 55%);box-shadow:inset 3px 0 var(--cnm-accent)}.cnm-inline-job.complete{border-color:var(--cnm-line);box-shadow:inset 3px 0 var(--cnm-success)}.cnm-inline-job-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:9px}.cnm-inline-job-title{display:flex;align-items:center;gap:9px;min-width:0}.cnm-inline-job-title strong{font-size:13px}.cnm-inline-job-title small{color:var(--cnm-muted);font:600 10px/1 Consolas,monospace}.cnm-live-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--cnm-accent);box-shadow:0 0 0 4px var(--cnm-accent-tint-2);animation:cnm-pulse 1.4s ease-in-out infinite}.cnm-inline-job.complete .cnm-live-dot{background:var(--cnm-success);animation:none}.cnm-current-task{display:grid;grid-template-columns:90px minmax(160px,1fr) auto;align-items:center;gap:12px;padding:9px 0 6px}.cnm-current-task span{color:var(--cnm-muted);font-size:10px}.cnm-current-task strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.cnm-current-task code{color:var(--cnm-accent);font-size:11px}.cnm-inline-job-list{max-height:130px;overflow:auto;border-top:1px solid var(--cnm-line)}.cnm-inline-job-row{display:grid;grid-template-columns:minmax(180px,1fr) 130px;padding:7px 0;border-bottom:1px solid var(--cnm-line-soft);font-size:11px;content-visibility:auto;contain-intrinsic-size:32px}.cnm-inline-job-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cnm-inline-job-row span{color:var(--cnm-muted)}.cnm-inline-job-row.job-success span{color:var(--cnm-success)}.cnm-inline-job-row.job-failed span{color:var(--cnm-danger)}.cnm-inline-job-row .cnm-job-error{grid-column:1/-1;padding-top:5px}@keyframes cnm-pulse{50%{opacity:.45;transform:scale(.72)}}@media(max-width:700px){.cnm-progress-dock{padding:10px}.cnm-current-task{grid-template-columns:1fr}.cnm-inline-job-row{grid-template-columns:1fr auto}}`;
document.head.append(inlineJobStyle);

const scanStyle = document.createElement("style");
scanStyle.textContent = `.cnm-scan-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin:0;padding:10px 14px;border:1px solid var(--cnm-info-border);border-radius:8px;background:var(--cnm-info-bg-soft)}.cnm-scan-label{display:flex;align-items:center;gap:9px}.cnm-scan-label strong{font-size:11px}.cnm-scan-label span{color:var(--cnm-info);font:700 10px/1 Consolas,monospace}.cnm-scan-progress .cnm-progress-track{grid-column:1/-1}.cnm-scan-progress .cnm-progress-bar{background:var(--cnm-info)}`;
document.head.append(scanStyle);

const confirmStyle = document.createElement("style");
confirmStyle.textContent = `.cnm-confirm-overlay{position:fixed;inset:0;z-index:10080;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,4,6,.78);backdrop-filter:blur(5px)}.cnm-confirm-card{width:min(430px,92vw);padding:22px;border:1px solid var(--cnm-accent-tint-4);border-radius:10px;background:var(--cnm-bg);color:var(--cnm-text);box-shadow:0 28px 90px rgba(0,0,0,.72)}.cnm-confirm-card h3{margin:12px 0 8px;font:700 23px/1.1 "Bahnschrift Condensed","Arial Narrow",sans-serif}.cnm-confirm-card p{margin:0;color:var(--cnm-text-soft);font-size:12px;line-height:1.65;white-space:pre-wrap}.cnm-confirm-extra{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--cnm-warning-soft);font-size:12px}.cnm-confirm-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}`;
document.head.append(confirmStyle);

const githubStyle = document.createElement("style");
githubStyle.textContent = `.cnm-github-toolbar{display:flex;align-items:center;gap:9px;margin-bottom:10px}.cnm-github-search{flex:1;min-width:0}.cnm-github-hint{margin:0 0 12px;color:var(--cnm-muted);font-size:11px;line-height:1.5}.cnm-github-row{display:grid;grid-template-columns:minmax(240px,1.7fr) minmax(150px,.85fr) auto;gap:14px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--cnm-line)}.cnm-github-row .cnm-identity small{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal}.cnm-github-meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--cnm-muted);font-size:11px}.cnm-github-stars{color:var(--cnm-accent);font-weight:700}@media(max-width:700px){.cnm-github-toolbar{flex-wrap:wrap}.cnm-github-row{grid-template-columns:1fr}}`;
document.head.append(githubStyle);

const extraStyle = document.createElement("style");
extraStyle.textContent = `.cnm-badge.muted{background:var(--cnm-fill);color:var(--cnm-muted)}.cnm-empty-hint{margin:12px 0 14px;font-size:12px;line-height:1.5}.cnm-toolbar-trigger{position:relative}.cnm-toolbar-trigger.needs-restart::after,.cnm-toolbar-trigger.busy::after{content:"";position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%}.cnm-toolbar-trigger.needs-restart::after{background:var(--cnm-warning)}.cnm-toolbar-trigger.busy::after{background:var(--cnm-accent);box-shadow:0 0 0 3px var(--cnm-accent-tint-3)}.cnm-install-tabs{display:flex;gap:8px;margin-bottom:12px}.cnm-install-advanced{margin-bottom:12px;border:1px solid var(--cnm-line);border-radius:7px;background:var(--cnm-fill-soft)}.cnm-job-details{margin:4px 0;border-bottom:1px solid var(--cnm-line)}.cnm-job-details summary{display:flex;gap:10px;align-items:center;padding:8px 0;cursor:pointer}.cnm-job-details summary strong{font-size:12px}.cnm-job-details summary span{color:var(--cnm-muted);font-size:11px}.cnm-job-preview{grid-column:1/-1;padding-top:4px;color:var(--cnm-text-soft)}.cnm-confirm-note{margin-top:10px!important;color:var(--cnm-warning-soft)!important}.cnm-confirm-card{width:min(480px,92vw)}.cnm-progress-dock{max-height:310px;overflow:auto}.cnm-inline-job-details{margin-top:5px}.cnm-inline-job-details>summary{width:max-content;cursor:pointer;color:var(--cnm-muted);font-size:10px}.cnm-inline-job-details[open]>summary{margin-bottom:6px;color:var(--cnm-text)}.cnm-bulk-bar{position:sticky;top:44px;z-index:4;display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:9px 12px;border:1px solid var(--cnm-accent-tint-4);border-radius:8px;background:linear-gradient(var(--cnm-accent-tint-2),var(--cnm-accent-tint-2)),var(--cnm-bg);box-shadow:0 8px 14px -10px rgba(0,0,0,.55);font-size:12px}.cnm-bulk-bar>span:first-child{margin-right:auto;font-weight:700}.cnm-progress-dock>*+*{margin-top:10px}@media(max-width:900px){.cnm-bulk-bar{position:static;box-shadow:none}}`;
document.head.append(extraStyle);

app.registerExtension({ name: "comfyui-custom-node-manager", async setup() {
    mountToolbarButton();
    try {
        const data = await request("/custom-node-manager/state");
        state.lastScan = data.last_scan || state.lastScan;
        state.githubToken = data.github_token === true;
        // Reconnect to any jobs still running on the server - e.g. updates/installs started
        // before a page refresh, or kicked off from another tab. Without this the live progress
        // panels were only ever reachable from the tab that started each job. Several jobs can be
        // active at once now that plugin updates run concurrently and independently.
        const activeJobs = (data.jobs || []).filter((job) => job.status === "queued" || job.status === "running");
        for (const job of activeJobs) {
            state.activeJobs.set(job.id, job);
            pollJob(job.id).catch(() => {});
        }
        updateToolbarButton();
    } catch (_) {}
} });
