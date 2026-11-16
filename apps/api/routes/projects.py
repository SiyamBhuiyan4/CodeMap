import io
import re
import zipfile
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from packages.shared.models import Project, User, Repository, RepositorySnapshot, AnalysisJob
from packages.shared.models.code_entity import File
from apps.api.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from apps.api.core.deps import get_db, get_current_user

router = APIRouter()

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    project = Project(
        name=project_in.name,
        description=project_in.description,
        user_id=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("", response_model=List[ProjectResponse])
def list_projects(
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    projects = db.query(Project).filter(Project.user_id == current_user.id).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return None


@router.get("/{project_id}/download")
def download_project_files(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ZIP of the text files from the project's latest completed analysis."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    snapshot = (
        db.query(RepositorySnapshot)
        .join(Repository, RepositorySnapshot.repository_id == Repository.id)
        .join(AnalysisJob, AnalysisJob.snapshot_id == RepositorySnapshot.id)
        .filter(Repository.project_id == project.id, AnalysisJob.status == "COMPLETED")
        .order_by(RepositorySnapshot.created_at.desc())
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Nothing has been analyzed yet")

    files = db.query(File.path, File.content).filter(File.snapshot_id == snapshot.id, File.content.isnot(None)).all()
    if not files:
        raise HTTPException(status_code=404, detail="No stored files for this analysis")

    root = re.sub(r"[^A-Za-z0-9._-]+", "-", project.name).strip("-") or "project"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files:
            safe = path.replace("\\", "/").lstrip("/")
            if ".." in safe.split("/"):
                continue
            zf.writestr(f"{root}/{safe}", content)
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{root}.zip"'},
    )
