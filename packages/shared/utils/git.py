import subprocess
import re
import os
import io
import shutil
import tarfile

class GitError(Exception):
    pass

def validate_github_url(url: str) -> bool:
    pattern = r'^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'
    return bool(re.match(pattern, url))

MAX_ARCHIVE_BYTES = int(os.getenv("MAX_REPO_ARCHIVE_BYTES", str(200 * 1024 * 1024)))


def _download_github_archive(url: str, target_dir: str):
    """Fallback for hosts without a git binary (e.g. serverless): fetch the default
    branch as a tarball from the GitHub API and extract it into target_dir."""
    import httpx

    owner, repo = url.rstrip("/").split("/")[-2:]
    if repo.endswith(".git"):
        repo = repo[:-4]
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "codeatlas"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
            res = client.get(f"https://api.github.com/repos/{owner}/{repo}/tarball", headers=headers)
    except httpx.HTTPError as e:
        raise GitError(f"Repository download failed: {e}")
    if res.status_code != 200:
        raise GitError(f"Repository download failed: HTTP {res.status_code}")
    if len(res.content) > MAX_ARCHIVE_BYTES:
        raise GitError("Repository archive is too large.")

    abs_target = os.path.abspath(target_dir)
    with tarfile.open(fileobj=io.BytesIO(res.content), mode="r:gz") as tar:
        for member in tar.getmembers():
            parts = member.name.split("/", 1)
            if len(parts) < 2 or not parts[1]:
                continue  # GitHub wraps everything in a single top-level folder
            if not (member.isfile() or member.isdir()):
                continue  # skip symlinks/devices
            dest = os.path.abspath(os.path.join(abs_target, parts[1]))
            if not dest.startswith(abs_target + os.sep):
                continue  # path traversal guard
            if member.isdir():
                os.makedirs(dest, exist_ok=True)
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            src = tar.extractfile(member)
            if src is None:
                continue
            with src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)


def clone_repository(url: str, target_dir: str):
    if not validate_github_url(url):
        raise GitError("Invalid GitHub URL format.")

    if shutil.which("git") is None:
        return _download_github_archive(url, target_dir)
    
    try:
        # Secure subprocess execution without shell=True
        # depth 1 for shallow clone to save time/space
        result = subprocess.run(
            ["git", "clone", "--depth", "1", url, target_dir],
            capture_output=True,
            text=True,
            check=True,
            timeout=300
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise GitError(f"Git clone failed: {e.stderr}")
    except subprocess.TimeoutExpired:
        raise GitError("Git clone timed out.")
