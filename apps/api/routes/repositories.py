from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from uuid import UUID
import shutil
import os

from packages.shared.models import Project, User, Repository, RepositorySnapshot, AnalysisJob
from apps.api.schemas.repository import GithubImportRequest, RepositoryResponse
from apps.api.core.deps import get_db, get_current_user
from packages.shared.utils.workspace import get_workspace_dir
from packages.shared.utils.git import clone_repository, GitError, validate_github_url
from packages.shared.utils.zip import extract_zip, ZipExtractionError

router = APIRouter()

# How analysis jobs run:
#   celery (default) - queued to the Celery worker over Redis (docker-compose setup)
#   inline           - run inside the request (serverless hosts with no long-lived worker)
ANALYSIS_MODE = os.getenv("ANALYSIS_MODE", "celery").lower()
_celery_client = None

def _get_celery_client():
    global _celery_client
    if _celery_client is None:
        from celery import Celery
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _celery_client = Celery("codeatlas_api", broker=redis_url)
    return _celery_client

def dispatch_analysis(job_id: str, snapshot_id: str, workspace_dir: str):
    if ANALYSIS_MODE == "inline":
        from apps.analyzer.jobs import run_analysis_job
        run_analysis_job(job_id, snapshot_id, workspace_dir)
        return
    # Dispatch to Celery asynchronously without blocking HTTP thread
    _get_celery_client().send_task(
        "apps.worker.main.analyze_repository_task",
        args=[job_id, snapshot_id, workspace_dir]
    )

def verify_project_access(project_id: UUID, db: Session, user: User) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{project_id}/repositories/github", response_model=RepositoryResponse)
def import_github_repository(
    project_id: UUID,
    request: GithubImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = verify_project_access(project_id, db, current_user)
    
    if not validate_github_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    repo = db.query(Repository).filter(Repository.project_id == project.id, Repository.url == request.url).first()
    if not repo:
        repo = Repository(project_id=project.id, url=request.url, source_type="github")
        db.add(repo)
        db.commit()
        db.refresh(repo)

    snapshot = RepositorySnapshot(repository_id=repo.id)
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    # Create the job first so the UI can show the download stage while it polls
    job = AnalysisJob(snapshot_id=snapshot.id, status="PENDING", current_stage="DOWNLOADING", progress="5%")
    db.add(job)
    db.commit()
    db.refresh(job)

    workspace_dir = get_workspace_dir(str(snapshot.id))
    try:
        clone_repository(request.url, workspace_dir)
    except GitError as e:
        db.delete(job)
        db.delete(snapshot)
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

    job.current_stage = "QUEUED"
    job.progress = "10%"
    db.commit()

    dispatch_analysis(str(job.id), str(snapshot.id), workspace_dir)

    return repo

@router.post("/{project_id}/repositories/upload", response_model=RepositoryResponse)
def upload_zip_repository(
    project_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = verify_project_access(project_id, db, current_user)
    
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    repo = Repository(project_id=project.id, url=file.filename, source_type="zip")
    db.add(repo)
    db.commit()
    db.refresh(repo)

    snapshot = RepositorySnapshot(repository_id=repo.id)
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    job = AnalysisJob(snapshot_id=snapshot.id, status="PENDING", current_stage="EXTRACTING", progress="5%")
    db.add(job)
    db.commit()
    db.refresh(job)

    workspace_dir = get_workspace_dir(str(snapshot.id))
    temp_zip_path = os.path.join(workspace_dir, "upload.zip")
    
    try:
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        extract_zip(temp_zip_path, workspace_dir)
        os.remove(temp_zip_path)
    except Exception as e:
        db.delete(job)
        db.delete(snapshot)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to process ZIP: {str(e)}")

    job.current_stage = "QUEUED"
    job.progress = "10%"
    db.commit()

    dispatch_analysis(str(job.id), str(snapshot.id), workspace_dir)

    return repo
