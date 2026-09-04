import asyncio
import importlib.metadata
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from aiohttp import web
from server import PromptServer
from . import store

try:
    from packaging.requirements import InvalidRequirement, Requirement
    from packaging.utils import canonicalize_name
    from packaging.version import InvalidVersion, Version
except ImportError:
    Requirement = InvalidRequirement = canonicalize_name = Version = InvalidVersion = None


logger = logging.getLogger("comfyui_custom_node_manager")
CUSTOM_NODES = Path(__file__).resolve().parent.parent
REGISTRY_API = "https://api.comfy.org/nodes"
GITHUB_API = "https://api.github.com"
NETWORK_TIMEOUT = 25
GIT_TIMEOUT = 60
GITHUB_REPO_RE = re.compile(r"^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+?)(?:\.git)?$")
GIT_REF_RE = re.compile(r"^(?!.*\.\.)[A-Za-z0-9._/-]+$")
EXCLUDED_GITHUB_REPOS = {
    "comfyanonymous/comfyui",
    "comfyanonymous/comfyui_examples",
    "comfy-org/comfyui",
    "comfy-org/desktop",
    "comfy-org/comfyui-frontend",
}
SCAN_CONCURRENCY = 4
DISABLED_SUFFIX = ".disabled"
_plugin_locks = {}
_plugin_locks_guard = threading.Lock()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

from logging.handlers import RotatingFileHandler

store.DATA_DIR.mkdir(parents=True, exist_ok=True)
if not any(isinstance(handler, RotatingFileHandler) and Path(handler.baseFilename) == store.LOG_FILE for handler in logger.handlers):
    file_handler = RotatingFileHandler(store.LOG_FILE, encoding="utf-8", maxBytes=5 * 1024 * 1024, backupCount=3)
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(file_handler)


def _log(level, event, trace_id, **fields):
    getattr(logger, level)("%s", json.dumps({"event": event, "trace_id": trace_id, **fields}, ensure_ascii=False))


def _run_git(path, *args, timeout=GIT_TIMEOUT):
    result = subprocess.run(
        ["git", "-C", os.fspath(path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"git exited with {result.returncode}")
    # rstrip only: `git status --porcelain` lines can start with a meaningful leading space
    # (e.g. " M path" for "modified, not staged"), and callers like _parse_git_status_lines
    # slice paths at a fixed column offset - a leading .strip() on the first line shifts that
    # offset and truncates the first character of the path.
    return result.stdout.rstrip()


def _registry_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Custom-Node-Manager/1.0"})
    with urllib.request.urlopen(request, timeout=NETWORK_TIMEOUT) as response:
        return json.load(response)


def _github_headers():
    headers = {"User-Agent": "ComfyUI-Custom-Node-Manager/1.0", "Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _github_json(url):
    request = urllib.request.Request(url, headers=_github_headers())
    try:
        with urllib.request.urlopen(request, timeout=NETWORK_TIMEOUT) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        try:
            message = json.loads(body).get("message") or body
        except json.JSONDecodeError:
            message = body or str(error)
        if error.code == 403:
            raise RuntimeError(f"GitHub API rate limit exceeded: {message}")
        if error.code == 404:
            raise RuntimeError("GitHub repository not found")
        raise RuntimeError(message)


def _parse_github_target(value):
    value = str(value or "").strip()
    if not value:
        return None
    if value.startswith(("http://", "https://", "git@", "ssh://")):
        url = _browser_remote_url(value) or value
        parsed = urllib.parse.urlsplit(url)
        host = (parsed.hostname or "").lower()
        if host not in {"github.com", "www.github.com"}:
            return None
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) < 2:
            return None
        owner, repo = parts[0], parts[1].removesuffix(".git")
        ref = "/".join(parts[3:]) if len(parts) >= 4 and parts[2] in {"tree", "commit"} else ""
        return {"owner": owner, "repo": repo, "ref": ref}
    match = GITHUB_REPO_RE.fullmatch(value)
    if not match:
        return None
    return {"owner": match.group(1), "repo": match.group(2), "ref": ""}


def _excluded_github_repo(owner, repo):
    return f"{owner}/{repo}".lower() in EXCLUDED_GITHUB_REPOS or repo.lower() == "comfyui"


def _normalize_repo_url(value):
    return str(value or "").strip().rstrip("/").lower().removesuffix(".git")


def _plugin_name(path):
    return path.name.removesuffix(DISABLED_SUFFIX)


def _is_disabled_path(path):
    return path.name.endswith(DISABLED_SUFFIX)


def _installed_plugin_index():
    names = set()
    urls = set()
    registry_ids = set()
    for path in _plugin_paths():
        names.add(_plugin_name(path).lower())
        if (path / ".git").exists():
            try:
                remote = _normalize_repo_url(_browser_remote_url(_run_git(path, "remote", "get-url", "origin")))
                if remote:
                    urls.add(remote)
            except (RuntimeError, subprocess.SubprocessError, OSError):
                pass
        info = _package_info(path)
        if info:
            registry_ids.add(str(info["id"]).lower())
    return names, urls, registry_ids


def _github_repo_payload(item, installed_names, installed_urls):
    name = str(item.get("name") or "")
    url = str(item.get("html_url") or "")
    clone_url = str(item.get("clone_url") or "")
    return {
        "name": name,
        "full_name": str(item.get("full_name") or ""),
        "url": url,
        "clone_url": clone_url,
        "description": str(item.get("description") or ""),
        "stars": int(item.get("stargazers_count") or 0),
        "language": str(item.get("language") or ""),
        "updated_at": str(item.get("updated_at") or ""),
        "owner": str((item.get("owner") or {}).get("login") or ""),
        "default_branch": str(item.get("default_branch") or ""),
        "topics": [str(topic) for topic in item.get("topics") or []],
        "archived": bool(item.get("archived")),
        "installed": name.lower() in installed_names or _normalize_repo_url(url) in installed_urls or _normalize_repo_url(clone_url) in installed_urls,
    }


def _search_github_repos(query, page=1, append_comfyui=True):
    installed_names, installed_urls, _registry_ids = _installed_plugin_index()
    target = _parse_github_target(query)
    if target:
        if _excluded_github_repo(target["owner"], target["repo"]):
            raise RuntimeError("That repository is ComfyUI itself, not a custom node")
        item = _github_json(f"{GITHUB_API}/repos/{urllib.parse.quote(target['owner'])}/{urllib.parse.quote(target['repo'])}")
        repo = _github_repo_payload(item, installed_names, installed_urls)
        if target["ref"]:
            repo["ref"] = target["ref"]
        return {"query": query, "search": f"{target['owner']}/{target['repo']}", "page": 1, "total": 1, "repos": [repo]}
    search = query.strip()
    if not search:
        search = "comfyui in:name"
    elif append_comfyui and "comfyui" not in search.lower():
        search = f"{search} comfyui"
    params = {"q": f"{search} archived:false", "per_page": "20", "page": str(max(1, page))}
    if not query.strip():
        params.update({"sort": "stars", "order": "desc"})
    data = _github_json(f"{GITHUB_API}/search/repositories?{urllib.parse.urlencode(params)}")
    repos = []
    for item in data.get("items") or []:
        owner = str((item.get("owner") or {}).get("login") or "")
        name = str(item.get("name") or "")
        if _excluded_github_repo(owner, name):
            continue
        repos.append(_github_repo_payload(item, installed_names, installed_urls))
    return {"query": query, "search": search, "page": max(1, page), "total": int(data.get("total_count") or 0), "repos": repos}


_WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def _install_target(name):
    if not isinstance(name, str) or not name or name in {".", ".."} or Path(name).name != name or name.startswith("."):
        raise ValueError("Invalid plugin name")
    if name.split(".")[0].upper() in _WINDOWS_RESERVED_NAMES:
        raise ValueError("That folder name is reserved on Windows; please pick another install folder name")
    if name == Path(__file__).resolve().parent.name:
        raise ValueError("Cannot replace the running manager")
    if name.lower() in {_plugin_name(path).lower() for path in _plugin_paths()}:
        raise RuntimeError("Plugin already installed")
    return CUSTOM_NODES / name


GIT_SAFE_PROTOCOL_ARGS = ["-c", "protocol.file.allow=never", "-c", "protocol.ext.allow=never"]
CLONE_RETRY_ATTEMPTS = 2
CLONE_RETRY_DELAY = 3
_TRANSIENT_GIT_ERROR_RE = re.compile(r"RPC failed|early EOF|unexpected disconnect|Connection (was )?reset|Could not resolve host|Operation timed out|The requested URL returned error: 5\d\d", re.IGNORECASE)


def _clone_github(url, name, ref):
    if ref and not GIT_REF_RE.fullmatch(ref):
        raise ValueError("Invalid git ref")
    target = _install_target(name)
    command = ["git", *GIT_SAFE_PROTOCOL_ARGS, "clone", "--recurse-submodules"]
    if ref and not re.fullmatch(r"[0-9a-fA-F]{7,40}", ref):
        command.extend(["--branch", ref])
        ref = ""
    command.extend(["--", url, os.fspath(target)])
    last_error = None
    try:
        for attempt in range(1, CLONE_RETRY_ATTEMPTS + 1):
            if target.exists():
                shutil.rmtree(target, ignore_errors=True)
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
            if not result.returncode:
                last_error = None
                break
            last_error = result.stderr.strip() or result.stdout.strip() or "git clone failed"
            if attempt < CLONE_RETRY_ATTEMPTS and _TRANSIENT_GIT_ERROR_RE.search(last_error):
                time.sleep(CLONE_RETRY_DELAY)
                continue
            break
        if last_error:
            raise RuntimeError(last_error)
        if ref:
            _run_git(target, "checkout", "--detach", ref)
    except Exception:
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        raise
    return target


def _package_info(path):
    pyproject = path / "pyproject.toml"
    if not pyproject.is_file():
        return None
    with pyproject.open("rb") as file:
        data = tomllib.load(file)
    project = data.get("project", {})
    comfy = data.get("tool", {}).get("comfy", {})
    node_id = project.get("name")
    publisher = comfy.get("PublisherId") or comfy.get("publisherid")
    if not node_id or not publisher:
        return None
    return {"id": node_id, "installed": str(project.get("version", ""))}


def _pyproject_dependencies(path):
    pyproject = path / "pyproject.toml"
    if not pyproject.is_file():
        return []
    with pyproject.open("rb") as file:
        data = tomllib.load(file)
    deps = data.get("project", {}).get("dependencies") or []
    return [str(item).strip() for item in deps if isinstance(item, str) and str(item).strip()]


def _pip_install_args(path):
    requirements = path / "requirements.txt"
    if requirements.is_file():
        return ["-r", os.fspath(requirements)], "requirements.txt"
    deps = _pyproject_dependencies(path)
    if deps:
        return deps, "pyproject.toml"
    return [], ""


def _requirement_strings(path):
    """Best-effort per-line requirement extraction, for static analysis only.

    Deliberately simpler than what pip itself accepts (skips pip-only directives like
    `-r other.txt` or `--index-url`) - good enough for spotting cross-plugin version
    conflicts, but _pip_install_args (which lets pip parse requirements.txt itself) is
    still what actually drives real installs.
    """
    requirements = path / "requirements.txt"
    if requirements.is_file():
        lines = []
        try:
            content = requirements.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return []
        for raw in content.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or line.startswith("-"):
                continue
            lines.append(line)
        return lines
    return _pyproject_dependencies(path)


_SPEC_BOUND_OPS = {">=", ">", "<=", "<", "=="}


def _specifier_bounds(specifier_set):
    """Collapse a SpecifierSet into (low, high, exact) using only relational operators.

    low/high are (Version, inclusive) tuples or None; exact is a Version or None. This is a
    heuristic, not a full PEP 440 solver - operators like ~=, !=, and pre-release markers are
    ignored, which is an acceptable trade-off for a best-effort conflict warning.
    """
    low = None
    high = None
    exact = None
    for spec in specifier_set:
        if spec.operator not in _SPEC_BOUND_OPS:
            continue
        try:
            version = Version(spec.version)
        except InvalidVersion:
            continue
        if spec.operator == "==":
            exact = version
        elif spec.operator in (">=", ">"):
            if low is None or version > low[0]:
                low = (version, spec.operator == ">=")
        elif spec.operator in ("<=", "<"):
            if high is None or version < high[0]:
                high = (version, spec.operator == "<=")
    return low, high, exact


def _version_within_bounds(version, low, high):
    if low and (version < low[0] or (version == low[0] and not low[1])):
        return False
    if high and (version > high[0] or (version == high[0] and not high[1])):
        return False
    return True


def _specifiers_disjoint(spec_a, spec_b):
    low_a, high_a, exact_a = _specifier_bounds(spec_a)
    low_b, high_b, exact_b = _specifier_bounds(spec_b)
    if exact_a is not None and exact_b is not None:
        return exact_a != exact_b
    if exact_a is not None:
        return not _version_within_bounds(exact_a, low_b, high_b)
    if exact_b is not None:
        return not _version_within_bounds(exact_b, low_a, high_a)
    if low_a and high_b and (low_a[0] > high_b[0] or (low_a[0] == high_b[0] and not (low_a[1] and high_b[1]))):
        return True
    if low_b and high_a and (low_b[0] > high_a[0] or (low_b[0] == high_a[0] and not (low_b[1] and high_a[1]))):
        return True
    return False


def _dependency_conflicts():
    """Compare every enabled plugin's declared Python dependencies against each other.

    Flags two kinds of issues: (1) two plugins declaring version ranges for the same package
    that cannot both be satisfied (e.g. `>=2.0` vs `<1.5`), and (2) a plugin's declared range
    excluding the version that is actually installed. Both use only relational specifiers
    (see _specifier_bounds) - this is a heuristic surfaced as a hint, not a guarantee.
    """
    if Requirement is None:
        return []
    by_package = {}
    for path in _plugin_paths():
        if _is_disabled_path(path):
            continue
        name = _plugin_name(path)
        for raw in _requirement_strings(path):
            try:
                req = Requirement(raw)
            except InvalidRequirement:
                continue
            try:
                if req.marker is not None and not req.marker.evaluate():
                    continue
            except Exception:
                pass
            if not req.specifier:
                continue
            canonical = canonicalize_name(req.name)
            by_package.setdefault(canonical, []).append({"plugin": name, "raw": raw, "specifier": req.specifier})

    conflicts = []
    for canonical, entries in by_package.items():
        if len(entries) < 2:
            continue
        installed_version_raw = _installed_package_version(canonical)
        installed_version = None
        if installed_version_raw:
            try:
                installed_version = Version(installed_version_raw)
            except InvalidVersion:
                installed_version = None
        pairwise_conflict = False
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                if _specifiers_disjoint(entries[i]["specifier"], entries[j]["specifier"]):
                    pairwise_conflict = True
        unmet_by = []
        if installed_version is not None:
            for entry in entries:
                if not entry["specifier"].contains(installed_version, prereleases=True):
                    unmet_by.append(entry["plugin"])
        if pairwise_conflict or unmet_by:
            conflicts.append({
                "package": canonical,
                "installed_version": installed_version_raw or "",
                "requirements": [{"plugin": entry["plugin"], "requirement": entry["raw"]} for entry in entries],
                "pairwise_conflict": pairwise_conflict,
                "unmet_by": unmet_by,
            })
    conflicts.sort(key=lambda item: item["package"])
    return conflicts


def _version_key(value):
    parts = []
    for item in value.split("."):
        number = "".join(char for char in item if char.isdigit())
        parts.append(int(number) if number else 0)
    while len(parts) > 1 and parts[-1] == 0:
        parts.pop()
    return tuple(parts)


def _browser_remote_url(remote):
    remote = remote.strip()
    if remote.startswith("git@") and ":" in remote:
        host, path = remote[4:].split(":", 1)
        return f"https://{host}/{path.removesuffix('.git')}"
    if remote.startswith("ssh://"):
        parsed = urllib.parse.urlsplit(remote)
        if parsed.hostname:
            port = f":{parsed.port}" if parsed.port else ""
            return f"https://{parsed.hostname}{port}/{parsed.path.lstrip('/').removesuffix('.git')}"
    if remote.startswith(("http://", "https://")):
        parsed = urllib.parse.urlsplit(remote)
        if not parsed.hostname:
            return ""
        port = f":{parsed.port}" if parsed.port else ""
        return urllib.parse.urlunsplit((parsed.scheme, f"{parsed.hostname}{port}", parsed.path.removesuffix(".git"), "", ""))
    return ""


_CACHE_DIRECTORIES = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
_CACHE_SUFFIXES = (".pyc", ".pyo")


def _is_cache_path(changed_path):
    parts = {part.lower() for part in changed_path.split("/")}
    return bool(parts & _CACHE_DIRECTORIES) or changed_path.lower().endswith(_CACHE_SUFFIXES)


def _parse_git_status_lines(lines):
    """Parse `git status --porcelain` lines into per-file entries, filtering out cache/build
    noise (__pycache__, .pyc, etc. - these show up as "dirty" but are never meaningful local
    edits). Returns (entries, cache_count); each entry is {"status": "M"/"A"/"D"/"R"/"??"/...,
    "path": new/current path, "old_path": original path for renames, else None}. Shared by the
    dirty-file summary (_git_change_summary) and the local-diff viewer (_local_diff) so both
    agree on what counts as a meaningful change."""
    entries = []
    cache_count = 0
    for line in lines:
        if len(line) <= 3:
            continue
        status = line[:2].strip() or "??"
        raw_path = line[3:].strip('"')
        if " -> " in raw_path:
            old_path, new_path = raw_path.split(" -> ", 1)
        else:
            old_path, new_path = None, raw_path
        normalized = new_path.replace("\\", "/")
        check_targets = [normalized]
        if old_path:
            check_targets.append(old_path.replace("\\", "/"))
        if any(_is_cache_path(target) for target in check_targets):
            cache_count += 1
            continue
        entries.append({"status": status, "path": new_path, "old_path": old_path})
    return entries, cache_count


def _git_working_tree_entries(path):
    lines = _run_git(path, "status", "--porcelain", "--untracked-files=all").splitlines()
    entries, _ = _parse_git_status_lines(lines)
    return entries


def _git_change_summary(path):
    lines = _run_git(path, "status", "--porcelain", "--untracked-files=all").splitlines()
    entries, cache_count = _parse_git_status_lines(lines)
    meaningful = [(f"{entry['old_path']} -> {entry['path']}" if entry["old_path"] else entry["path"]) for entry in entries]
    return meaningful, cache_count


LOCAL_DIFF_MAX_FILES = 30  # cap how many changed files a single dirty-plugin diff view will show
LOCAL_DIFF_MAX_BYTES = 200_000  # per file - one huge generated/lock file shouldn\'t blow up the payload
UNTRACKED_DIFF_MAX_FILE_BYTES = 2 * 1024 * 1024  # skip diffing (not just truncating) huge new files


def _run_git_diff(path, *args, timeout=GIT_TIMEOUT):
    # Plain `git diff` exits 0 even when there are differences, but `--no-index` (used below for
    # untracked files) implies --exit-code semantics and exits 1 when the compared files differ -
    # that\'s the expected/successful case here, not a failure, so accept 0 and 1 both.
    result = subprocess.run(
        ["git", "-C", os.fspath(path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"git exited with {result.returncode}")
    return result.stdout


def _local_diff(path):
    """Working-tree diff for a dirty plugin: what has actually been changed locally, not just
    which files. Backs the manager UI\'s "查看本地修改" view so a dirty plugin can be inspected
    instead of only offered a blind discard-and-resync."""
    entries = _git_working_tree_entries(path)
    shown_entries = entries[:LOCAL_DIFF_MAX_FILES]
    files = []
    for entry in shown_entries:
        status = entry["status"]
        rel_path = entry["path"]
        if status == "??":
            kind = "added"
        elif status.startswith("R"):
            kind = "renamed"
        elif "D" in status:
            kind = "deleted"
        else:
            kind = "modified"
        try:
            if kind == "added":
                try:
                    size = (path / rel_path).stat().st_size
                except OSError:
                    size = 0
                if size > UNTRACKED_DIFF_MAX_FILE_BYTES:
                    diff_text = f"(新文件较大：{size / (1024 * 1024):.1f} MB，未生成内容预览)"
                else:
                    diff_text = _run_git_diff(path, "diff", "--no-index", "--", "/dev/null", rel_path, timeout=20)
            elif kind == "renamed":
                diff_text = _run_git_diff(path, "diff", "HEAD", "--", entry["old_path"], rel_path, timeout=20)
            else:
                diff_text = _run_git_diff(path, "diff", "HEAD", "--", rel_path, timeout=20)
        except (RuntimeError, subprocess.SubprocessError, OSError) as error:
            diff_text = f"(无法读取该文件的改动：{error})"
        truncated = False
        if len(diff_text) > LOCAL_DIFF_MAX_BYTES:
            diff_text = diff_text[:LOCAL_DIFF_MAX_BYTES]
            truncated = True
        files.append({"path": rel_path, "old_path": entry["old_path"], "status": kind, "diff": diff_text.strip("\n"), "truncated": truncated})
    return {"files": files, "total_changed": len(entries), "shown": len(files)}


def _scan_local_git(path):
    branch = _run_git(path, "branch", "--show-current")
    if not branch:
        local = _run_git(path, "rev-parse", "HEAD")
        return {"type": "git", "status": "unsupported", "message": "Detached HEAD", "installed": local[:10], "latest": "", "checked": False}
    local = _run_git(path, "rev-parse", "HEAD")
    remote = _run_git(path, "remote", "get-url", "origin")
    changes, cache_changes = _git_change_summary(path)
    dirty = bool(changes)
    commit_text = _run_git(path, "log", "-1", "--format=%H%x00%aI%x00%an%x00%s")
    commit_hash, commit_date, commit_author, commit_subject = (commit_text.split("\0", 3) + ["", "", "", ""])[:4]
    return {
        "type": "git",
        "branch": branch,
        "installed": local[:10],
        "latest": "",
        "update_available": False,
        "checking": False,
        "checked": False,
        "dirty": dirty,
        "local_changes": changes,
        "ignored_cache_changes": cache_changes,
        "repository_url": _browser_remote_url(remote),
        "last_commit": {
            "hash": commit_hash[:10],
            "date": commit_date,
            "author": commit_author,
            "subject": commit_subject,
        },
    }


def _scan_git(path):
    result = _scan_local_git(path)
    if result.get("status") == "unsupported":
        return result
    branch = result["branch"]
    remote = _run_git(path, "remote", "get-url", "origin")
    _run_git(path, "fetch", "--quiet", "--prune", "origin", branch, timeout=120)
    remote_head = _run_git(path, "rev-parse", "FETCH_HEAD")
    counts = _run_git(path, "rev-list", "--left-right", "--count", "HEAD...FETCH_HEAD").split()
    ahead, behind = (int(counts[0]), int(counts[1])) if len(counts) == 2 else (0, 0)
    if ahead and behind:
        git_state = "diverged"
    elif ahead:
        git_state = "ahead"
    elif behind:
        git_state = "behind"
    else:
        git_state = "current"
    result.update({
        "latest": remote_head[:10],
        "update_available": behind > 0,
        "checking": False,
        "checked": True,
        "ahead": ahead,
        "behind": behind,
        "git_state": git_state,
    })
    return result


def _scan_local_registry(path):
    package = _package_info(path)
    if not package:
        return {"type": "unmanaged", "update_available": False}
    return {
        "type": "registry",
        "id": package["id"],
        "installed": package["installed"],
        "latest": "",
        "update_available": False,
        "checking": False,
        "checked": False,
        "dirty": False,
        "last_commit": {
            "hash": "",
            "date": "",
            "author": "",
            "subject": f"Installed Registry package {package['installed']}",
        },
    }


def _scan_registry(path):
    result = _scan_local_registry(path)
    if result["type"] == "unmanaged":
        return result
    package = {"id": result["id"], "installed": result["installed"]}
    node = _registry_json(f"{REGISTRY_API}/{urllib.parse.quote(package['id'])}")
    latest = str((node.get("latest_version") or {}).get("version") or "")
    published = str((node.get("latest_version") or {}).get("createdAt") or "")
    result.update({
        "latest": latest,
        "update_available": bool(latest and _version_key(latest) > _version_key(package["installed"])),
        "checking": False,
        "checked": True,
        "last_commit": {
            "hash": "",
            "date": published,
            "author": str((node.get("publisher") or {}).get("name") or (node.get("publisher") or {}).get("id") or ""),
            "subject": f"Registry release {latest}" if latest else "",
        },
    })
    return result


def _scan_one(path):
    result = {"name": _plugin_name(path)}
    if path.resolve() == Path(__file__).resolve().parent:
        return {**result, "type": "self", "update_available": False, "dirty": False}
    try:
        disabled = _is_disabled_path(path)
        result.update((_scan_local_git(path) if (path / ".git").exists() else _scan_local_registry(path)) if disabled else (_scan_git(path) if (path / ".git").exists() else _scan_registry(path)))
        result["disabled"] = disabled
        policy = store.policy_for(result["name"])
        result["policy"] = policy
        ignored = policy.get("ignored") is True or (policy.get("ignore_until") or "") > store.now() or (policy.get("ignore_version") and policy.get("ignore_version") == result.get("latest"))
        if ignored:
            result["update_available"] = False
            result["ignored"] = True
    except Exception as error:
        result.update({"type": "error", "update_available": False, "error": str(error)})
    return result


def _scan_local_one(path):
    result = {"name": _plugin_name(path)}
    if path.resolve() == Path(__file__).resolve().parent:
        return {**result, "type": "self", "update_available": False, "dirty": False, "checking": False}
    try:
        result.update(_scan_local_git(path) if (path / ".git").exists() else _scan_local_registry(path))
        result["policy"] = store.policy_for(result["name"])
        result["disabled"] = _is_disabled_path(path)
        policy = result["policy"]
        if policy.get("ignored") is True or (policy.get("ignore_until") or "") > store.now():
            result["ignored"] = True
    except Exception as error:
        result.update({"type": "error", "update_available": False, "checking": False, "error": str(error)})
    return result


def _plugin_path(name, include_disabled=True):
    if not isinstance(name, str) or not name or name in {".", ".."} or Path(name).name != name:
        raise ValueError("Invalid plugin name")
    path = (CUSTOM_NODES / name).resolve()
    if path.parent == CUSTOM_NODES and path.is_dir():
        return path
    disabled = (CUSTOM_NODES / f"{name}{DISABLED_SUFFIX}").resolve()
    if include_disabled and disabled.parent == CUSTOM_NODES and disabled.is_dir():
        return disabled
    raise ValueError("Plugin not found")


def _plugin_paths():
    return [path for path in CUSTOM_NODES.iterdir() if path.is_dir() and not path.name.startswith(".") and path.name != "__pycache__"]


def _plugin_lock(name):
    with _plugin_locks_guard:
        return _plugin_locks.setdefault(name, threading.Lock())


BACKUP_EXCLUDED_DIRS = {"__pycache__", ".git", ".pytest_cache", ".mypy_cache", ".ruff_cache", "venv", ".venv", "node_modules"}
BACKUP_MAX_FILE_SIZE = 50 * 1024 * 1024  # skip individual files bigger than this (downloaded model/asset weights, not plugin code)


def _backup_plugin(path):
    store.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_id = str(uuid.uuid4())
    archive = store.BACKUP_DIR / f"{backup_id}.zip"
    skipped_large = 0
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
        for item in path.rglob("*"):
            if not item.is_file():
                continue
            relative = item.relative_to(path)
            if set(relative.parts) & BACKUP_EXCLUDED_DIRS:
                continue
            try:
                if item.stat().st_size > BACKUP_MAX_FILE_SIZE:
                    skipped_large += 1
                    continue
            except OSError:
                continue
            package.write(item, relative)
    record = {
        "id": backup_id,
        "plugin": _plugin_name(path),
        "created_at": store.now(),
        "archive": os.fspath(archive),
        "size": archive.stat().st_size,
        "skipped_large_files": skipped_large,
    }
    evicted = store.add_backup(record)
    for old_record in evicted:
        old_archive = Path(old_record.get("archive", ""))
        try:
            if old_archive.is_file() and old_archive.resolve().parent == store.BACKUP_DIR.resolve():
                old_archive.unlink()
        except OSError:
            logger.warning("Failed to remove evicted backup archive %s", old_archive)
    return record


def _restore_backup(record):
    path = CUSTOM_NODES / record["plugin"]
    archive = Path(record["archive"])
    if not archive.is_file():
        raise RuntimeError("Backup archive is missing")
    with tempfile.TemporaryDirectory(prefix="comfy-node-rollback-") as temp:
        extracted = Path(temp)
        _safe_extract(archive, extracted)
        path.mkdir(parents=True, exist_ok=True)
        _mirror_directory(extracted, path)
    return _scan_local_one(path)


PIP_DRY_RUN_MIN_VERSION = (22, 3)  # pip needs >=22.2 for --dry-run and >=22.3 for --report
_UNSUPPORTED_PIP_FLAG_RE = re.compile(r"no such option|unrecognized arguments|--dry-run|--report", re.IGNORECASE)
_pip_dry_run_support_cache = None


def _pip_dry_run_supported():
    """Best-effort check for whether the active pip is new enough for --dry-run --report.

    Older embedded/portable Python distributions (common in ComfyUI installs) can ship a pip
    that predates these flags; without this check _dependency_preview would surface a raw,
    confusing pip error on every single update instead of just skipping the preview.
    """
    global _pip_dry_run_support_cache
    if _pip_dry_run_support_cache is not None:
        return _pip_dry_run_support_cache
    try:
        result = subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15, check=False)
        match = re.search(r"pip (\d+(?:\.\d+)*)", result.stdout) if not result.returncode else None
        _pip_dry_run_support_cache = bool(match) and _version_key(match.group(1)) >= PIP_DRY_RUN_MIN_VERSION
    except (OSError, subprocess.SubprocessError):
        _pip_dry_run_support_cache = None
    return _pip_dry_run_support_cache


def _installed_package_version(name):
    """Best-effort lookup of a package's currently-installed version, used only to flag when a
    plugin's dependency update would downgrade something another plugin might also rely on."""
    try:
        return importlib.metadata.version(name)
    except (importlib.metadata.PackageNotFoundError, ValueError):
        return None


def _dependency_preview(path):
    pip_args, source = _pip_install_args(path)
    if not pip_args:
        return {"has_requirements": False, "source": "", "changes": []}
    if _pip_dry_run_supported() is False:
        return {"has_requirements": True, "source": source, "changes": [], "skipped": True, "skip_reason": "pip 版本过旧，不支持依赖预检（需要 pip ≥ 22.3），将直接安装"}
    with tempfile.TemporaryDirectory(prefix="comfy-node-deps-") as temp:
        report = Path(temp) / "report.json"
        result = subprocess.run([sys.executable, "-m", "pip", "install", "--dry-run", "--report", os.fspath(report), *pip_args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180, check=False)
        if result.returncode:
            message = result.stderr.strip() or result.stdout.strip()
            if _UNSUPPORTED_PIP_FLAG_RE.search(message):
                return {"has_requirements": True, "source": source, "changes": [], "skipped": True, "skip_reason": f"pip 不支持依赖预检，将直接安装：{message}"}
            return {"has_requirements": True, "source": source, "error": message, "changes": []}
        data = json.loads(report.read_text(encoding="utf-8")) if report.is_file() else {}
        changes = [{"name": item.get("metadata", {}).get("name", ""), "version": item.get("metadata", {}).get("version", ""), "requested": item.get("requested", False)} for item in data.get("install", [])]
        for change in changes:
            current = _installed_package_version(change["name"])
            change["current_version"] = current or ""
            if current and change["version"] and _version_key(current) > _version_key(change["version"]):
                change["downgrade"] = True
        return {"has_requirements": True, "source": source, "changes": changes}


def _update_git(path, force):
    policy = store.policy_for(path.name)
    pinned_ref = str(policy.get("pinned_ref") or "").strip() if policy.get("strategy") == "pinned" else ""
    branch = _run_git(path, "branch", "--show-current")
    if not branch and not pinned_ref:
        raise RuntimeError("Detached HEAD cannot be updated unless a commit is pinned")
    dirty = bool(_git_change_summary(path)[0])
    if dirty and not force:
        raise RuntimeError("Local changes found; enable force clean to discard them")
    if pinned_ref:
        _run_git(path, "fetch", "--prune", "origin", timeout=120)
        _run_git(path, "rev-parse", "--verify", f"{pinned_ref}^{{commit}}")
        _run_git(path, "reset", "--hard", pinned_ref)
    else:
        _run_git(path, "fetch", "--prune", "origin", branch, timeout=120)
        _run_git(path, "reset", "--hard", f"origin/{branch}")
    if force:
        _run_git(path, "clean", "-ffdx")
    return _scan_git(path)


def _safe_extract(archive, destination):
    destination = destination.resolve()
    with zipfile.ZipFile(archive) as package:
        for member in package.infolist():
            target = (destination / member.filename).resolve()
            if target != destination and destination not in target.parents:
                raise RuntimeError("Registry package contains an unsafe path")
        package.extractall(destination)


def _mirror_directory(source, target, preserve_user_data=False):
    # Backups and registry downloads never contain .git (see BACKUP_EXCLUDED_DIRS / registry
    # archives have no .git at all), so an existing .git in the target must be left alone here -
    # otherwise a rollback would silently delete the plugin's git history/remote/branch identity.
    source_files = {item.relative_to(source) for item in source.rglob("*") if item.is_file()}
    for item in sorted((item for item in target.rglob("*") if item.is_file()), reverse=True):
        relative = item.relative_to(target)
        if relative.parts and relative.parts[0] == ".git":
            continue
        preserved = preserve_user_data and (relative.suffix.lower() in {".db", ".sqlite", ".json"} or any(part.lower() in {"config", "configs", "models", "data", "cache"} for part in relative.parts))
        if relative not in source_files and not preserved:
            item.unlink()
    for item in source.rglob("*"):
        relative = item.relative_to(source)
        if relative.parts and relative.parts[0] == ".git":
            continue
        destination = target / relative
        if item.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, destination)
    for item in sorted((item for item in target.rglob("*") if item.is_dir()), reverse=True):
        if item.name == ".git":
            continue
        try:
            item.rmdir()
        except OSError:
            pass


def _latest_registry_download(node_id):
    versions = _registry_json(f"{REGISTRY_API}/{urllib.parse.quote(node_id)}/versions")
    if isinstance(versions, dict):
        versions = versions.get("versions") or versions.get("items") or []
    active = [version for version in versions if version.get("status") == "NodeVersionStatusActive"] or list(versions)
    if not active:
        raise RuntimeError("Registry has no active release")
    latest = max(active, key=lambda version: _version_key(str(version.get("version", "0"))))
    download_url = latest.get("downloadUrl") or latest.get("download_url")
    if not download_url:
        raise RuntimeError("Registry release has no download URL")
    return latest, download_url


def _extract_registry_archive(download_url, path, preserve_user_data=False):
    with tempfile.TemporaryDirectory(prefix="comfy-node-registry-") as temp:
        archive = Path(temp) / "node.zip"
        request = urllib.request.Request(download_url, headers={"User-Agent": "ComfyUI-Custom-Node-Manager/1.0"})
        last_error = None
        for attempt in range(1, CLONE_RETRY_ATTEMPTS + 1):
            try:
                with urllib.request.urlopen(request, timeout=120) as response, archive.open("wb") as output:
                    shutil.copyfileobj(response, output)
                last_error = None
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
                last_error = error
                if attempt < CLONE_RETRY_ATTEMPTS:
                    time.sleep(CLONE_RETRY_DELAY)
        if last_error:
            raise last_error
        extracted = Path(temp) / "extracted"
        extracted.mkdir()
        _safe_extract(archive, extracted)
        children = list(extracted.iterdir())
        source = children[0] if len(children) == 1 and children[0].is_dir() else extracted
        path.mkdir(parents=True, exist_ok=True)
        _mirror_directory(source, path, preserve_user_data=preserve_user_data)


def _update_registry(path):
    package = _package_info(path)
    if not package:
        raise RuntimeError("Plugin is not registered with Comfy Registry")
    _latest, download_url = _latest_registry_download(package["id"])
    _extract_registry_archive(download_url, path, preserve_user_data=True)
    return _scan_registry(path)


def _reinstall_git(path):
    """Delete and re-clone a git-managed plugin from its current remote/ref, for when its files
    have been corrupted or partially deleted rather than because a newer version is available."""
    name = _plugin_name(path)
    remote = _run_git(path, "remote", "get-url", "origin")
    policy = store.policy_for(name)
    ref = str(policy.get("pinned_ref") or "").strip() if policy.get("strategy") == "pinned" else ""
    if not ref:
        try:
            ref = _run_git(path, "branch", "--show-current")
        except (RuntimeError, subprocess.SubprocessError):
            ref = ""
    shutil.rmtree(path)
    command = ["git", *GIT_SAFE_PROTOCOL_ARGS, "clone", "--recurse-submodules"]
    checkout_ref = ""
    if ref and not re.fullmatch(r"[0-9a-fA-F]{7,40}", ref):
        command.extend(["--branch", ref])
    else:
        checkout_ref = ref
    command.extend(["--", remote, os.fspath(path)])
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "git clone failed")
    if checkout_ref:
        _run_git(path, "checkout", "--detach", checkout_ref)
    return _scan_local_one(path)


def _reinstall_registry(path):
    """Re-download the currently-recorded installed version from Comfy Registry (falling back to
    the latest release if that exact version is no longer listed), to repair damaged files without
    jumping to a newer release the user hasn't reviewed."""
    package = _package_info(path)
    if not package:
        raise RuntimeError("Plugin is not registered with Comfy Registry")
    versions = _registry_json(f"{REGISTRY_API}/{urllib.parse.quote(package['id'])}/versions")
    if isinstance(versions, dict):
        versions = versions.get("versions") or versions.get("items") or []
    target_version = next((v for v in versions if str(v.get("version")) == str(package["installed"])), None)
    if not target_version and versions:
        target_version = max(versions, key=lambda v: _version_key(str(v.get("version", "0"))))
    if not target_version:
        raise RuntimeError("Registry has no releases to reinstall from")
    download_url = target_version.get("downloadUrl") or target_version.get("download_url")
    if not download_url:
        raise RuntimeError("Registry release has no download URL")
    _extract_registry_archive(download_url, path, preserve_user_data=True)
    return _scan_registry(path)


def _install_registry_package(node_id, name):
    target = _install_target(name)
    try:
        _latest, download_url = _latest_registry_download(node_id)
        _extract_registry_archive(download_url, target, preserve_user_data=False)
    except Exception:
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        raise
    return target


def _install_requirements(path):
    pip_args, source = _pip_install_args(path)
    if not pip_args:
        return False
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", *pip_args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=600,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"Dependency installation failed ({source})")
    return True


def _git_commit_entries(path, *refs, limit=20):
    output = _run_git(path, "log", f"-{limit}", "--format=%H%x1f%aI%x1f%an%x1f%s%x1e", *refs)
    commits = []
    seen = set()
    for record in output.split("\x1e"):
        record = record.strip()
        if not record:
            continue
        commit_hash, date, author, subject = (record.split("\x1f", 3) + ["", "", "", ""])[:4]
        if commit_hash in seen:
            continue
        seen.add(commit_hash)
        body = _run_git(path, "show", "-s", "--format=%b", commit_hash)
        changes_output = _run_git(path, "diff-tree", "--no-commit-id", "--name-status", "-r", commit_hash)
        changes = []
        for line in changes_output.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                changes.append({"status": parts[0], "path": " → ".join(parts[1:])})
        commits.append({"hash": commit_hash, "date": date, "author": author, "subject": subject, "body": body, "changes": changes})
    return commits


def _mark_history(commits, current, latest):
    current = str(current or "")
    latest = str(latest or "")
    for item in commits:
        item_hash = str(item.get("hash") or "")
        item["current"] = bool(current) and (item_hash == current or item_hash.startswith(current) or current.startswith(item_hash))
        item["latest"] = bool(latest) and (item_hash == latest or item_hash.startswith(latest) or latest.startswith(item_hash))
    return commits


def _git_history(path, limit=20):
    head = _run_git(path, "rev-parse", "HEAD")
    branch = _run_git(path, "branch", "--show-current")
    remote_head = ""
    if branch:
        try:
            _run_git(path, "fetch", "--quiet", "--prune", "origin", branch, timeout=120)
            remote_head = _run_git(path, "rev-parse", "FETCH_HEAD")
        except (RuntimeError, subprocess.SubprocessError, OSError):
            remote_head = ""
    refs = [head]
    if remote_head and remote_head != head:
        refs.append(remote_head)
    commits = _mark_history(_git_commit_entries(path, *refs, limit=limit), head, remote_head or head)
    if not any(item.get("current") for item in commits):
        extra = _mark_history(_git_commit_entries(path, head, limit=1), head, remote_head or head)
        if extra:
            extra[0]["truncated"] = True
            commits.append(extra[0])
    return {"type": "git", "current": head, "latest": remote_head or head, "commits": commits}


def _registry_history(path, limit=20):
    package = _package_info(path)
    if not package:
        raise RuntimeError("Plugin has no Git or Registry history")
    versions = _registry_json(f"{REGISTRY_API}/{urllib.parse.quote(package['id'])}/versions")
    active = [version for version in versions if version.get("status") == "NodeVersionStatusActive"]
    active.sort(key=lambda version: str(version.get("createdAt") or ""), reverse=True)
    installed = str(package.get("installed") or "")
    latest = str((active[0].get("version") if active else "") or "")
    commits = [{
        "hash": str(version.get("version") or ""),
        "date": str(version.get("createdAt") or ""),
        "author": "Comfy Registry",
        "subject": f"Release {version.get('version') or ''}",
        "body": str(version.get("changelog") or "No changelog provided"),
        "changes": [],
    } for version in active[:limit]]
    _mark_history(commits, installed, latest)
    if installed and not any(item.get("current") for item in commits):
        commits.append({
            "hash": installed,
            "date": "",
            "author": "Comfy Registry",
            "subject": f"Installed {installed}",
            "body": "This installed version is not in the latest release list.",
            "changes": [],
            "current": True,
            "latest": False,
            "truncated": True,
        })
    return {"type": "registry", "current": installed, "latest": latest, "commits": commits}


async def _request_json(request):
    try:
        return await request.json()
    except (json.JSONDecodeError, web.HTTPBadRequest):
        raise web.HTTPBadRequest(text="Invalid JSON body")


async def _scan_paths(paths, scanner):
    semaphore = asyncio.Semaphore(SCAN_CONCURRENCY)

    async def scan(path):
        async with semaphore:
            return await asyncio.to_thread(scanner, path)

    return await asyncio.gather(*(scan(path) for path in paths))


UPDATE_CONCURRENCY = 3  # plugins are independent directories + per-plugin locks, so a few can update
                        # in parallel; kept modest (rather than SCAN_CONCURRENCY-level) since each one
                        # may run a pip install against the same shared Python environment.


async def _run_update_job(job_id, names, force):
    store.update_job(job_id, status="running")

    async def process(name):
        started = time.monotonic()
        lock = _plugin_lock(name)
        if not lock.acquire(blocking=False):
            store.update_job_plugin(job_id, name, status="failed", stage="locked", error="Plugin is already being updated")
            return
        backup = None
        try:
            path = _plugin_path(name)
            if _is_disabled_path(path):
                raise RuntimeError("Disabled plugins must be enabled before updating")
            if path == Path(__file__).resolve().parent:
                raise RuntimeError("The manager cannot update itself while running")
            store.update_job_plugin(job_id, name, status="running", stage="backup")
            backup = await asyncio.to_thread(_backup_plugin, path)
            store.update_job_plugin(job_id, name, stage="updating_code", backup_id=backup["id"])
            result = await asyncio.to_thread(_update_git if (path / ".git").exists() else _update_registry, path, *([force] if (path / ".git").exists() else []))
            store.update_job_plugin(job_id, name, stage="dependency_preview", code_updated=True)
            dependency_preview = await asyncio.to_thread(_dependency_preview, path)
            store.update_job_plugin(job_id, name, stage="installing_dependencies", dependency_preview=dependency_preview)
            dependencies_checked = await asyncio.to_thread(_install_requirements, path)
            store.update_job_plugin(job_id, name, status="success", stage="complete", dependencies_checked=dependencies_checked, needs_restart=True, result=result, elapsed_ms=round((time.monotonic() - started) * 1000))
            _log("info", "plugin_updated", job_id, plugin=name, dependencies_checked=dependencies_checked, elapsed_ms=round((time.monotonic() - started) * 1000))
        except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, urllib.error.URLError) as error:
            rolled_back = False
            message = str(error)
            if backup:
                try:
                    await asyncio.to_thread(_restore_backup, backup)
                    rolled_back = True
                    message = f"{message}；已回滚到更新前备份"
                except Exception as restore_error:
                    message = f"{message}；回滚失败：{restore_error}"
            store.update_job_plugin(job_id, name, status="failed", stage="failed", error=message, rolled_back=rolled_back, backup_id=(backup or {}).get("id", ""), elapsed_ms=round((time.monotonic() - started) * 1000))
            _log("warning", "plugin_update_failed", job_id, plugin=str(name), error=message, rolled_back=rolled_back)
        except Exception:
            logger.exception("%s", json.dumps({"event": "plugin_update_failed", "trace_id": job_id, "plugin": str(name), "error_code": "UNEXPECTED_ERROR"}, ensure_ascii=False))
            store.update_job_plugin(job_id, name, status="failed", stage="failed", error="Unexpected update error; check the server log")
        finally:
            lock.release()

    semaphore = asyncio.Semaphore(UPDATE_CONCURRENCY)

    async def guarded(name):
        async with semaphore:
            await process(name)

    await asyncio.gather(*(guarded(name) for name in names))

    job = store.get_job(job_id)
    failed = sum(item["status"] == "failed" for item in job["plugins"].values())
    store.update_job(job_id, status="failed" if failed else "success", finished_at=store.now(), needs_restart=any(item.get("needs_restart") for item in job["plugins"].values()))
    _log("info", "update_completed", job_id, success_count=len(names) - failed, failure_count=failed)


async def _run_install_job(job_id, name, url="", ref="", node_id=""):
    store.update_job(job_id, status="running")
    started = time.monotonic()
    lock = _plugin_lock(name)
    if not lock.acquire(blocking=False):
        store.update_job_plugin(job_id, name, status="failed", stage="locked", error="Plugin is already being updated")
        store.update_job(job_id, status="failed", finished_at=store.now())
        return
    try:
        if node_id:
            store.update_job_plugin(job_id, name, status="running", stage="downloading")
            path = await asyncio.to_thread(_install_registry_package, node_id, name)
        else:
            store.update_job_plugin(job_id, name, status="running", stage="cloning")
            path = await asyncio.to_thread(_clone_github, url, name, ref)
        store.update_job_plugin(job_id, name, stage="installing_dependencies")
        dependencies_checked = await asyncio.to_thread(_install_requirements, path)
        result = await asyncio.to_thread(_scan_local_one, path)
        elapsed_ms = round((time.monotonic() - started) * 1000)
        store.update_job_plugin(job_id, name, status="success", stage="complete", dependencies_checked=dependencies_checked, needs_restart=True, result=result, elapsed_ms=elapsed_ms)
        store.update_job(job_id, status="success", finished_at=store.now(), needs_restart=True)
        _log("info", "plugin_installed", job_id, plugin=name, url=url, node_id=node_id, elapsed_ms=elapsed_ms)
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, urllib.error.URLError) as error:
        store.update_job_plugin(job_id, name, status="failed", stage="failed", error=str(error), elapsed_ms=round((time.monotonic() - started) * 1000))
        store.update_job(job_id, status="failed", finished_at=store.now())
        _log("warning", "plugin_install_failed", job_id, plugin=name, url=url, node_id=node_id, error=str(error))
    except Exception:
        logger.exception("%s", json.dumps({"event": "plugin_install_failed", "trace_id": job_id, "plugin": name, "error_code": "UNEXPECTED_ERROR"}, ensure_ascii=False))
        store.update_job_plugin(job_id, name, status="failed", stage="failed", error="Unexpected install error; check the server log")
        store.update_job(job_id, status="failed", finished_at=store.now())
    finally:
        lock.release()


def _registry_node_payload(item, installed_names, installed_urls, registry_ids):
    node_id = str(item.get("id") or item.get("name") or "")
    latest = item.get("latest_version") or {}
    publisher = item.get("publisher") or {}
    publisher_id = publisher.get("id") if isinstance(publisher, dict) else str(publisher or "")
    publisher_name = publisher.get("name") if isinstance(publisher, dict) else str(publisher or "")
    repository = str(item.get("repository") or item.get("repository_url") or "")
    name = node_id or str(item.get("name") or "")
    return {
        "id": node_id,
        "name": name,
        "title": str(item.get("name") or node_id),
        "description": str(item.get("description") or ""),
        "publisher": str(publisher_name or publisher_id or ""),
        "repository_url": repository,
        "version": str(latest.get("version") or ""),
        "updated_at": str(latest.get("createdAt") or item.get("updated_at") or ""),
        "downloads": int(item.get("downloads") or 0),
        "stars": int(item.get("stars") or 0),
        "installed": name.lower() in installed_names or node_id.lower() in registry_ids or _normalize_repo_url(repository) in installed_urls,
    }


def _search_registry_nodes(query, page=1):
    installed_names, installed_urls, registry_ids = _installed_plugin_index()
    params = {"page": str(max(1, page)), "limit": "20"}
    if query.strip():
        params["search"] = query.strip()
    data = _registry_json(f"{REGISTRY_API}/search?{urllib.parse.urlencode(params)}")
    if isinstance(data, list):
        nodes, total = data, len(data)
    else:
        nodes = data.get("nodes") or data.get("items") or []
        total = int(data.get("total") or data.get("totalCount") or len(nodes))
    return {
        "query": query,
        "page": max(1, page),
        "total": total,
        "nodes": [_registry_node_payload(item, installed_names, installed_urls, registry_ids) for item in nodes],
    }


BACKGROUND_CHECK_POLL_SECONDS = 300  # how often the loop wakes up to see whether a scheduled check is due
_background_check_task = None


def _parse_iso(value):
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


async def _background_check_loop():
    """Runs for the lifetime of the ComfyUI server process, independent of any browser tab.

    Before this, "enable scheduled check" was purely a setInterval() in the page's own JS - it
    silently stopped doing anything the moment the ComfyUI tab was closed, refreshed, or the
    browser put it to sleep, even though the setting implied it kept checking in the background.
    """
    while True:
        try:
            await asyncio.sleep(BACKGROUND_CHECK_POLL_SECONDS)
            state = store.load_state()
            settings = state.get("settings", {})
            if not settings.get("scheduled_check"):
                continue
            interval_hours = settings.get("check_interval_hours") or 24
            last_at = _parse_iso(settings.get("last_scheduled_check_at"))
            now = datetime.now(timezone.utc)
            if last_at and (now - last_at).total_seconds() < interval_hours * 3600:
                continue
            trace_id = f"scheduled-{uuid.uuid4()}"
            started = time.monotonic()
            _log("info", "scheduled_scan_started", trace_id)
            paths = _plugin_paths()
            results = await _scan_paths(paths, _scan_one)
            results.sort(key=lambda item: (not item.get("update_available", False), item["name"].lower()))
            update_count = sum(bool(item.get("update_available")) for item in results)

            def apply(state, results=results, update_count=update_count):
                state["last_scan"] = store.now()
                state["settings"]["last_scheduled_check_at"] = store.now()
                state["background_scan"] = {"completed_at": store.now(), "plugins": results, "update_count": update_count}

            store.update_state(apply)
            _log("info", "scheduled_scan_completed", trace_id, plugin_count=len(results), update_count=update_count, elapsed_ms=round((time.monotonic() - started) * 1000))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("%s", json.dumps({"event": "scheduled_scan_failed", "trace_id": "scheduled", "error_code": "UNEXPECTED_ERROR"}, ensure_ascii=False))


def _ensure_background_check_task():
    global _background_check_task
    if _background_check_task is None or _background_check_task.done():
        _background_check_task = asyncio.get_running_loop().create_task(_background_check_loop())


async def _on_app_startup(_app):
    _ensure_background_check_task()


PromptServer.instance.app.on_startup.append(_on_app_startup)


@PromptServer.instance.routes.get("/custom-node-manager/scan")
async def scan_plugins(request):
    trace_id = str(uuid.uuid4())
    started = time.monotonic()
    _log("info", "scan_started", trace_id, path=os.fspath(CUSTOM_NODES))
    paths = _plugin_paths()
    results = await _scan_paths(paths, _scan_one)
    results.sort(key=lambda item: (not item.get("update_available", False), item["name"].lower()))
    elapsed_ms = round((time.monotonic() - started) * 1000)
    _log("info", "scan_completed", trace_id, plugin_count=len(results), update_count=sum(bool(item.get("update_available")) for item in results), elapsed_ms=elapsed_ms)
    return web.json_response({"trace_id": trace_id, "plugins": results})


@PromptServer.instance.routes.get("/custom-node-manager/scan-one")
async def scan_one_plugin(request):
    trace_id = request.query.get("trace_id") or str(uuid.uuid4())
    started = time.monotonic()
    try:
        path = _plugin_path(request.query.get("name"))
        result = await asyncio.to_thread(_scan_one, path)
    except (ValueError, OSError, RuntimeError) as error:
        _log("warning", "plugin_scan_failed", trace_id, plugin=str(request.query.get("name")), error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    _log("debug", "plugin_scan_completed", trace_id, plugin=path.name, update_available=bool(result.get("update_available")), elapsed_ms=round((time.monotonic() - started) * 1000))
    store.update_state(lambda state: state.__setitem__("last_scan", store.now()))
    return web.json_response({"trace_id": trace_id, "plugin": result})


def _directory_size(path):
    total = 0
    for item in path.rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            continue
    return total


@PromptServer.instance.routes.get("/custom-node-manager/disk-usage")
async def plugin_disk_usage(request):
    # Deliberately a separate, on-demand endpoint rather than part of /scan or /local: walking every
    # file of every plugin (some installs run well over 1GB) is too slow to run on every routine scan,
    # so the frontend only calls this when a user actually wants to see space usage.
    trace_id = str(uuid.uuid4())
    started = time.monotonic()
    paths = _plugin_paths()
    semaphore = asyncio.Semaphore(SCAN_CONCURRENCY)

    async def compute(path):
        async with semaphore:
            size = await asyncio.to_thread(_directory_size, path)
            return _plugin_name(path), size

    results = await asyncio.gather(*(compute(path) for path in paths))
    sizes = {name: size for name, size in results}
    elapsed_ms = round((time.monotonic() - started) * 1000)
    _log("info", "disk_usage_completed", trace_id, plugin_count=len(sizes), elapsed_ms=elapsed_ms)
    return web.json_response({"trace_id": trace_id, "sizes": sizes, "total": sum(sizes.values())})


@PromptServer.instance.routes.get("/custom-node-manager/dependency-conflicts")
async def dependency_conflicts(request):
    # On-demand and separate from /scan or /local for the same reason as /disk-usage: parsing
    # every enabled plugin's requirements and cross-checking them is only worth doing when a
    # user actually opens the dependency-conflicts tab, not on every routine scan.
    trace_id = str(uuid.uuid4())
    started = time.monotonic()
    try:
        conflicts = await asyncio.to_thread(_dependency_conflicts)
    except Exception as error:
        logger.exception("%s", json.dumps({"event": "dependency_conflicts_failed", "trace_id": trace_id, "error": str(error)}, ensure_ascii=False))
        raise web.HTTPInternalServerError(text=str(error))
    _log("info", "dependency_conflicts_completed", trace_id, conflict_count=len(conflicts), elapsed_ms=round((time.monotonic() - started) * 1000))
    return web.json_response({"trace_id": trace_id, "conflicts": conflicts, "supported": Requirement is not None})


@PromptServer.instance.routes.get("/custom-node-manager/local")
async def local_plugins(request):
    trace_id = str(uuid.uuid4())
    started = time.monotonic()
    paths = _plugin_paths()
    results = await _scan_paths(paths, _scan_local_one)
    results.sort(key=lambda item: item["name"].lower())
    _log("info", "local_scan_completed", trace_id, plugin_count=len(results), elapsed_ms=round((time.monotonic() - started) * 1000))
    state = store.load_state()
    return web.json_response({
        "trace_id": trace_id,
        "plugins": results,
        "last_scan": state.get("last_scan"),
        "background_scan": state.get("background_scan"),
        "github_token": bool(os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")),
    })


@PromptServer.instance.routes.post("/custom-node-manager/open-folder")
async def open_plugin_folder(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    try:
        path = _plugin_path(body.get("name"))
    except ValueError as error:
        _log("warning", "open_folder_rejected", trace_id, error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    try:
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", os.fspath(path)])
        else:
            subprocess.Popen(["xdg-open", os.fspath(path)])
    except OSError:
        logger.exception("%s", json.dumps({"event": "open_folder_failed", "trace_id": trace_id, "plugin": path.name, "error_code": "OPEN_FOLDER_FAILED"}, ensure_ascii=False))
        raise web.HTTPInternalServerError(text="Unable to open plugin folder")
    _log("info", "open_folder_completed", trace_id, plugin=path.name)
    return web.json_response({"trace_id": trace_id, "ok": True})


@PromptServer.instance.routes.get("/custom-node-manager/history")
async def plugin_history(request):
    trace_id = str(uuid.uuid4())
    name = request.query.get("name")
    started = time.monotonic()
    try:
        path = _plugin_path(name)
        result = await asyncio.to_thread(_git_history if (path / ".git").exists() else _registry_history, path)
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, urllib.error.URLError) as error:
        _log("warning", "history_failed", trace_id, plugin=str(name), error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    _log("info", "history_completed", trace_id, plugin=path.name, history_type=result["type"], commit_count=len(result["commits"]), elapsed_ms=round((time.monotonic() - started) * 1000))
    return web.json_response({"trace_id": trace_id, "name": path.name, **result})


@PromptServer.instance.routes.get("/custom-node-manager/local-diff")
async def plugin_local_diff(request):
    trace_id = str(uuid.uuid4())
    name = request.query.get("name")
    started = time.monotonic()
    try:
        path = _plugin_path(name)
        if not (path / ".git").exists():
            raise RuntimeError("Only Git-managed plugins have a working-tree diff to show")
        result = await asyncio.to_thread(_local_diff, path)
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        _log("warning", "local_diff_failed", trace_id, plugin=str(name), error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    _log("info", "local_diff_completed", trace_id, plugin=path.name, file_count=result["shown"], elapsed_ms=round((time.monotonic() - started) * 1000))
    return web.json_response({"trace_id": trace_id, "name": path.name, **result})


@PromptServer.instance.routes.get("/custom-node-manager/state")
async def manager_state(request):
    state = store.load_state()
    return web.json_response({
        "settings": state["settings"],
        "policies": state["policies"],
        "jobs": list(state["jobs"].values())[-20:],
        "backups": state["backups"],
        "backups_total_size": sum(item.get("size", 0) for item in state["backups"]),
        "last_scan": state.get("last_scan"),
        "background_scan": state.get("background_scan"),
        "github_token": bool(os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")),
        "log_file": os.fspath(store.LOG_FILE),
    })


@PromptServer.instance.routes.get("/custom-node-manager/job/{job_id}")
async def update_job_status(request):
    job = store.get_job(request.match_info["job_id"])
    if not job:
        raise web.HTTPNotFound(text="Job not found")
    return web.json_response(job)


@PromptServer.instance.routes.post("/custom-node-manager/policy")
async def update_policy(request):
    body = await _request_json(request)
    try:
        _plugin_path(body.get("name"))
    except ValueError as error:
        raise web.HTTPBadRequest(text=str(error))
    allowed = {key: body[key] for key in ("ignored", "ignore_until", "ignore_version", "strategy", "pinned_ref") if key in body}
    if allowed.get("strategy") not in {None, "registry", "git", "pinned"}:
        raise web.HTTPBadRequest(text="Invalid strategy")
    return web.json_response(store.set_policy(body["name"], allowed))


@PromptServer.instance.routes.post("/custom-node-manager/settings")
async def update_settings(request):
    body = await _request_json(request)
    allowed = {key: body[key] for key in ("scheduled_check", "check_interval_hours") if key in body}
    if "check_interval_hours" in allowed and (not isinstance(allowed["check_interval_hours"], int) or not 1 <= allowed["check_interval_hours"] <= 168):
        raise web.HTTPBadRequest(text="check_interval_hours must be between 1 and 168")
    def apply(state):
        state["settings"].update(allowed)
        return state["settings"].copy()
    return web.json_response(store.update_state(apply))


@PromptServer.instance.routes.post("/custom-node-manager/rollback")
async def rollback_plugin(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    record = next((item for item in store.load_state()["backups"] if item["id"] == body.get("backup_id")), None)
    if not record:
        raise web.HTTPNotFound(text="Backup not found")
    lock = _plugin_lock(record["plugin"])
    if not lock.acquire(blocking=False):
        raise web.HTTPConflict(text="Plugin is busy")
    try:
        result = await asyncio.to_thread(_restore_backup, record)
        path = CUSTOM_NODES / record["plugin"]
        if path.is_dir():
            await asyncio.to_thread(_install_requirements, path)
            result = await asyncio.to_thread(_scan_local_one, path)
    finally:
        lock.release()
    _log("info", "rollback_completed", trace_id, plugin=record["plugin"], backup_id=record["id"])
    return web.json_response({"ok": True, "needs_restart": True, "plugin": result})


@PromptServer.instance.routes.post("/custom-node-manager/reinstall")
async def reinstall_plugin(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    name = body.get("name")
    try:
        path = _plugin_path(name, include_disabled=False)
    except ValueError as error:
        _log("warning", "reinstall_rejected", trace_id, plugin=str(name), error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    if path == Path(__file__).resolve().parent:
        raise web.HTTPBadRequest(text="The manager cannot reinstall itself")
    lock = _plugin_lock(str(name))
    if not lock.acquire(blocking=False):
        raise web.HTTPConflict(text="Plugin is busy with another operation")
    try:
        backup = await asyncio.to_thread(_backup_plugin, path)
        is_git = (path / ".git").exists()
        try:
            result = await asyncio.to_thread(_reinstall_git if is_git else _reinstall_registry, path)
        except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, urllib.error.URLError):
            try:
                await asyncio.to_thread(_restore_backup, backup)
            except Exception:
                logger.warning("Failed to restore backup after failed reinstall of %s", name)
            raise
        dependencies_checked = await asyncio.to_thread(_install_requirements, path)
        _log("info", "reinstall_completed", trace_id, plugin=str(name), dependencies_checked=dependencies_checked)
        return web.json_response({"ok": True, "backup_id": backup["id"], "needs_restart": True, "plugin": result})
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, urllib.error.URLError) as error:
        _log("warning", "reinstall_failed", trace_id, plugin=str(name), error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    finally:
        lock.release()


@PromptServer.instance.routes.post("/custom-node-manager/lifecycle")
async def plugin_lifecycle(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    action, name = body.get("action"), body.get("name")
    if action not in {"disable", "enable", "uninstall"}:
        _log("warning", "lifecycle_rejected", trace_id, plugin=str(name), action=str(action), error="Invalid lifecycle action")
        raise web.HTTPBadRequest(text="Invalid lifecycle action")
    # Without this lock, disabling/uninstalling a plugin while an update or install job is still
    # running against the same directory (backing it up, fetching, or pip-installing into it) could
    # race with that job's filesystem operations and leave the plugin half-deleted or corrupted.
    lock = _plugin_lock(str(name))
    if not lock.acquire(blocking=False):
        _log("warning", "lifecycle_rejected", trace_id, plugin=str(name), action=str(action), error="Plugin is busy")
        raise web.HTTPConflict(text="Plugin is busy with another operation")
    try:
        _log("info", "lifecycle_started", trace_id, plugin=str(name), action=action)
        try:
            if action == "enable":
                source = (CUSTOM_NODES / f"{name}{DISABLED_SUFFIX}").resolve()
                if source.parent != CUSTOM_NODES or not source.is_dir():
                    raise ValueError("Disabled plugin not found")
                target = CUSTOM_NODES / str(name)
            elif action == "disable":
                source = _plugin_path(name, include_disabled=False)
                target = CUSTOM_NODES / f"{source.name}{DISABLED_SUFFIX}"
            else:
                source = _plugin_path(name)
                target = None
        except ValueError as error:
            _log("warning", "lifecycle_rejected", trace_id, plugin=str(name), action=action, error=str(error))
            raise web.HTTPBadRequest(text=str(error))
        if source == Path(__file__).resolve().parent:
            _log("warning", "lifecycle_rejected", trace_id, plugin=str(name), action=action, error="The manager cannot manage itself")
            raise web.HTTPBadRequest(text="The manager cannot manage itself")
        try:
            if action in {"disable", "enable"}:
                if target.exists():
                    _log("warning", "lifecycle_conflict", trace_id, plugin=str(name), action=action, target=os.fspath(target))
                    raise web.HTTPConflict(text="Target already exists")
                source.rename(target)
                backup = None
            else:
                backup = await asyncio.to_thread(_backup_plugin, source)
                shutil.rmtree(source)
        except OSError as error:
            logger.exception("%s", json.dumps({"event": "lifecycle_failed", "trace_id": trace_id, "plugin": str(name), "action": action, "error_code": "FILESYSTEM_ERROR"}, ensure_ascii=False))
            raise web.HTTPInternalServerError(text=str(error))
        backup_id = backup["id"] if backup else None
        _log("info", "lifecycle_completed", trace_id, plugin=str(name), action=action, backup_id=backup_id)
        return web.json_response({"ok": True, "backup_id": backup_id, "needs_restart": True})
    finally:
        lock.release()


@PromptServer.instance.routes.get("/custom-node-manager/export")
async def export_manifest(request):
    paths = [path for path in _plugin_paths() if path.resolve() != Path(__file__).resolve().parent]
    plugins = await asyncio.gather(*(asyncio.to_thread(_scan_local_one, path) for path in paths))
    return web.json_response({"format": 1, "created_at": store.now(), "plugins": plugins, "policies": store.load_state()["policies"]})


@PromptServer.instance.routes.post("/custom-node-manager/import")
async def import_manifest(request):
    body = await _request_json(request)
    manifest = body.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("format") != 1:
        raise web.HTTPBadRequest(text="Invalid manifest")
    restored, skipped, failed = [], [], []
    for item in manifest.get("plugins", []):
        name = item.get("name")
        if not name:
            skipped.append({"name": "", "reason": "缺少插件名"})
            continue
        if (CUSTOM_NODES / name).exists():
            skipped.append({"name": name, "reason": "目录已存在"})
            continue
        url = item.get("repository_url")
        try:
            if url:
                result = subprocess.run(["git", *GIT_SAFE_PROTOCOL_ARGS, "clone", "--", url, os.fspath(CUSTOM_NODES / name)], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
                if result.returncode:
                    raise RuntimeError(result.stderr.strip())
                await asyncio.to_thread(_install_requirements, CUSTOM_NODES / name)
                restored.append(name)
            else:
                skipped.append({"name": name, "reason": "缺少仓库地址"})
        except Exception as error:
            if (CUSTOM_NODES / name).exists():
                shutil.rmtree(CUSTOM_NODES / name, ignore_errors=True)
            failed.append({"name": name, "error": str(error)})
    for name, policy in manifest.get("policies", {}).items():
        store.set_policy(name, policy)
    return web.json_response({"restored": restored, "skipped": skipped, "failed": failed, "needs_restart": bool(restored)})


@PromptServer.instance.routes.get("/custom-node-manager/github/search")
async def search_github_plugins(request):
    trace_id = str(uuid.uuid4())
    query = request.query.get("q") or ""
    try:
        page = int(request.query.get("page") or 1)
    except ValueError:
        page = 1
    append_comfyui = request.query.get("append_comfyui") != "0"
    started = time.monotonic()
    try:
        result = await asyncio.to_thread(_search_github_repos, query, page, append_comfyui)
    except (RuntimeError, OSError, urllib.error.URLError) as error:
        _log("warning", "github_search_failed", trace_id, query=query, error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    _log("info", "github_search_completed", trace_id, query=query, result_count=len(result["repos"]), elapsed_ms=round((time.monotonic() - started) * 1000))
    return web.json_response({"trace_id": trace_id, **result})


@PromptServer.instance.routes.post("/custom-node-manager/github/install")
async def install_github_plugin(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    source = body.get("url") or body.get("full_name") or ""
    target = _parse_github_target(source)
    ref = str(body.get("ref") or (target or {}).get("ref") or "").strip()
    if target:
        if ref and not GIT_REF_RE.fullmatch(ref):
            raise web.HTTPBadRequest(text="Invalid git ref")
        name = target["repo"]
        url = f"https://github.com/{target['owner']}/{target['repo']}.git"
        if _excluded_github_repo(target["owner"], target["repo"]):
            raise web.HTTPBadRequest(text="That repository is ComfyUI itself, not a custom node")
    else:
        raw = str(source).strip()
        if not raw.startswith(("http://", "https://", "git@", "ssh://")):
            raise web.HTTPBadRequest(text="A GitHub repository URL, owner/repo, or git URL is required")
        browser = _browser_remote_url(raw) or raw
        parts = [part for part in urllib.parse.urlsplit(browser).path.strip("/").split("/") if part]
        name = parts[-1].removesuffix(".git") if parts else ""
        url = raw
        if not name:
            raise web.HTTPBadRequest(text="Could not determine a folder name from the git URL")
        if name.lower() == "comfyui":
            raise web.HTTPBadRequest(text="That repository is ComfyUI itself, not a custom node")
        if ref and not GIT_REF_RE.fullmatch(ref):
            raise web.HTTPBadRequest(text="Invalid git ref")
    try:
        _install_target(name)
    except (ValueError, RuntimeError) as error:
        raise web.HTTPBadRequest(text=str(error))
    job = store.create_job([name], kind="install")
    _log("info", "install_started", job["id"], plugin=name, url=url, ref=ref)
    asyncio.create_task(_run_install_job(job["id"], name, url=url, ref=ref))
    return web.json_response({"trace_id": trace_id, "job": job}, status=202)


@PromptServer.instance.routes.get("/custom-node-manager/registry/search")
async def search_registry_plugins(request):
    trace_id = str(uuid.uuid4())
    query = request.query.get("q") or ""
    try:
        page = int(request.query.get("page") or 1)
    except ValueError:
        page = 1
    started = time.monotonic()
    try:
        result = await asyncio.to_thread(_search_registry_nodes, query, page)
    except (RuntimeError, OSError, urllib.error.URLError) as error:
        _log("warning", "registry_search_failed", trace_id, query=query, error=str(error))
        raise web.HTTPBadRequest(text=str(error))
    _log("info", "registry_search_completed", trace_id, query=query, result_count=len(result["nodes"]), elapsed_ms=round((time.monotonic() - started) * 1000))
    return web.json_response({"trace_id": trace_id, **result})


@PromptServer.instance.routes.post("/custom-node-manager/registry/install")
async def install_registry_plugin(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    node_id = str(body.get("id") or body.get("name") or "").strip()
    if not node_id or Path(node_id).name != node_id:
        raise web.HTTPBadRequest(text="A Registry node id is required")
    name = str(body.get("folder") or node_id).strip()
    try:
        _install_target(name)
    except (ValueError, RuntimeError) as error:
        raise web.HTTPBadRequest(text=str(error))
    job = store.create_job([name], kind="install")
    _log("info", "registry_install_started", job["id"], plugin=name, node_id=node_id)
    asyncio.create_task(_run_install_job(job["id"], name, node_id=node_id))
    return web.json_response({"trace_id": trace_id, "job": job}, status=202)


@PromptServer.instance.routes.post("/custom-node-manager/backup/delete")
async def delete_backup(request):
    body = await _request_json(request)
    backup_id = body.get("backup_id")
    record = next((item for item in store.load_state()["backups"] if item["id"] == backup_id), None)
    if not record:
        raise web.HTTPNotFound(text="Backup not found")
    archive = Path(record["archive"])
    if archive.is_file() and archive.resolve().parent == store.BACKUP_DIR.resolve():
        archive.unlink()
    store.remove_backup(backup_id)
    return web.json_response({"ok": True})


@PromptServer.instance.routes.post("/custom-node-manager/update")
async def update_plugins(request):
    trace_id = str(uuid.uuid4())
    body = await _request_json(request)
    names = body.get("names")
    force = body.get("force") is True
    if not isinstance(names, list) or not names or len(names) > 200:
        raise web.HTTPBadRequest(text="names must be a non-empty list")
    job = store.create_job(names)
    _log("info", "update_started", job["id"], plugin_count=len(names), force=force)
    asyncio.create_task(_run_update_job(job["id"], names, force))
    return web.json_response({"trace_id": trace_id, "job": job}, status=202)


def _spawn_restart():
    session = os.environ.get("__COMFY_CLI_SESSION__")
    if session:
        Path(str(session) + ".reboot").write_text("", encoding="utf-8")
        os._exit(0)
    python = sys.executable
    args = [python, *sys.argv]
    if sys.platform == "win32":
        delayed = subprocess.list2cmdline(args)
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        try:
            subprocess.Popen(f'cmd /c "timeout /t 2 /nobreak >nul & {delayed}"', shell=True, close_fds=True, creationflags=flags)
        except OSError:
            subprocess.Popen(args, close_fds=True)
        os._exit(0)
    os.execv(python, args)


@PromptServer.instance.routes.post("/custom-node-manager/restart")
async def restart_comfy(request):
    trace_id = str(uuid.uuid4())
    _log("info", "restart_requested", trace_id)

    async def kick():
        await asyncio.sleep(0.4)
        await asyncio.to_thread(_spawn_restart)

    asyncio.create_task(kick())
    return web.json_response({"ok": True, "trace_id": trace_id})


_log("info", "manager_ready", "startup", version="1.0.0", custom_nodes_path=os.fspath(CUSTOM_NODES))
