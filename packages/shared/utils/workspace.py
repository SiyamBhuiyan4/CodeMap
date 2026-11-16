import tempfile
import os
import shutil
import uuid

WORKSPACES_ROOT = os.getenv("WORKSPACES_ROOT", "/tmp/codeatlas_workspaces")

def get_workspace_dir(snapshot_id: str) -> str:
    path = os.path.join(WORKSPACES_ROOT, str(snapshot_id))
    os.makedirs(path, exist_ok=True)
    return path

def cleanup_workspace(snapshot_id: str):
    path = os.path.join(WORKSPACES_ROOT, str(snapshot_id))
    if os.path.exists(path) and os.path.abspath(path).startswith(os.path.abspath(WORKSPACES_ROOT)):
        shutil.rmtree(path, ignore_errors=True)


def read_snapshot_file(file_obj, workspace_dir: str):
    """Return the text of an analysed file.

    Reads from the workspace on disk when it is still there; otherwise falls back to the
    copy stored in the database during analysis (needed on serverless hosts where the
    workspace does not survive between requests). Returns None when neither is available.
    """
    file_path = os.path.join(workspace_dir, file_obj.path)
    abs_base = os.path.abspath(workspace_dir)
    if os.path.abspath(file_path).startswith(abs_base) and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    return getattr(file_obj, "content", None)
