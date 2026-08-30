import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent / "data"
STATE_FILE = DATA_DIR / "state.json"
BACKUP_DIR = DATA_DIR / "backups"
LOG_FILE = DATA_DIR / "manager.log"
_lock = threading.RLock()

DEFAULT_STATE = {
    "settings": {"scheduled_check": False, "check_interval_hours": 24},
    "policies": {},
    "jobs": {},
    "backups": [],
    "last_scan": None,
}

JOB_HISTORY_LIMIT = 200
BACKUPS_PER_PLUGIN_LIMIT = 3
BACKUPS_TOTAL_LIMIT = 100


def _now():
    return datetime.now(timezone.utc).isoformat()


def load_state():
    with _lock:
        if not STATE_FILE.is_file():
            return json.loads(json.dumps(DEFAULT_STATE))
        try:
            saved = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            saved = {}
        state = json.loads(json.dumps(DEFAULT_STATE))
        for key, value in saved.items():
            state[key] = value
        return state


def save_state(state):
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        temp = STATE_FILE.with_suffix(".tmp")
        temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(STATE_FILE)


def update_state(callback):
    with _lock:
        state = load_state()
        result = callback(state)
        save_state(state)
        return result


def policy_for(name):
    return load_state()["policies"].get(name, {})


def set_policy(name, values):
    def apply(state):
        policy = state["policies"].setdefault(name, {})
        policy.update(values)
        return policy.copy()
    return update_state(apply)


def create_job(names, kind="update"):
    job_id = str(uuid.uuid4())
    job = {"id": job_id, "kind": kind, "status": "queued", "created_at": _now(), "finished_at": None, "plugins": {name: {"status": "queued", "stage": "waiting", "error": ""} for name in names}}
    def apply(state):
        state["jobs"][job_id] = job
        if len(state["jobs"]) > JOB_HISTORY_LIMIT:
            for old_id in list(state["jobs"])[:-JOB_HISTORY_LIMIT]:
                del state["jobs"][old_id]
    update_state(apply)
    return job


def update_job(job_id, **values):
    def apply(state):
        state["jobs"][job_id].update(values)
        return state["jobs"][job_id].copy()
    return update_state(apply)


def update_job_plugin(job_id, name, **values):
    def apply(state):
        state["jobs"][job_id]["plugins"][name].update(values)
        return state["jobs"][job_id]["plugins"][name].copy()
    return update_state(apply)


def get_job(job_id):
    return load_state()["jobs"].get(job_id)


def add_backup(record):
    """Insert a backup record, enforcing per-plugin and total retention caps.

    Returns the list of evicted records (oldest first per plugin, then oldest
    overall) so the caller can delete their archive files from disk - without
    this, entries dropped from state["backups"] would leave orphaned zip
    files behind forever.
    """
    removed = []
    def apply(state):
        state["backups"].insert(0, record)
        counts = {}
        kept = []
        for item in state["backups"]:
            plugin = item.get("plugin")
            counts[plugin] = counts.get(plugin, 0) + 1
            if counts[plugin] > BACKUPS_PER_PLUGIN_LIMIT:
                removed.append(item)
            else:
                kept.append(item)
        if len(kept) > BACKUPS_TOTAL_LIMIT:
            removed.extend(kept[BACKUPS_TOTAL_LIMIT:])
            kept = kept[:BACKUPS_TOTAL_LIMIT]
        state["backups"] = kept
    update_state(apply)
    return removed


def remove_backup(backup_id):
    update_state(lambda state: state.__setitem__("backups", [item for item in state["backups"] if item["id"] != backup_id]))


def now():
    return _now()
