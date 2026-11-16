from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict, Any
from apps.api.core.deps import get_db, get_current_user
from sqlalchemy import func
from packages.shared.models import AnalysisJob, User, Project, Repository, RepositorySnapshot, AnalysisFinding
from packages.shared.models.code_entity import File, CodeEntity
from packages.shared.models.relationship import CallRelationship, Dependency

router = APIRouter()

@router.get("/{job_id}")
def get_job_status(job_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/projects/{project_id}/latest-job")
def get_latest_project_job(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Most recent analysis job for a project (used by the UI to show live progress)."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    row = (
        db.query(AnalysisJob, Repository)
        .join(RepositorySnapshot, AnalysisJob.snapshot_id == RepositorySnapshot.id)
        .join(Repository, RepositorySnapshot.repository_id == Repository.id)
        .filter(Repository.project_id == project.id)
        .order_by(RepositorySnapshot.created_at.desc())
        .first()
    )
    if not row:
        return None
    job, repo = row
    progress = 0
    try:
        progress = int(str(job.progress or "0").rstrip("%"))
    except ValueError:
        pass
    return {
        "id": str(job.id),
        "status": job.status,
        "stage": job.current_stage,
        "progress": progress,
        "error_message": job.error_message,
        "source": repo.url,
        "source_type": repo.source_type,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    }

@router.get("/projects/{project_id}/summary")
def get_project_summary(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Counts and findings for the project's most recent completed analysis."""
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
        return None
    sid = snapshot.id

    entity_counts = dict(
        db.query(CodeEntity.type, func.count(CodeEntity.id))
        .filter(CodeEntity.snapshot_id == sid).group_by(CodeEntity.type).all()
    )
    languages = [
        {"language": lang or "other", "files": n}
        for lang, n in db.query(File.language, func.count(File.id))
        .filter(File.snapshot_id == sid).group_by(File.language)
        .order_by(func.count(File.id).desc()).all()
    ]
    finding_counts = dict(
        db.query(AnalysisFinding.type, func.count(AnalysisFinding.id))
        .filter(AnalysisFinding.snapshot_id == sid).group_by(AnalysisFinding.type).all()
    )
    findings = (
        db.query(AnalysisFinding).filter(AnalysisFinding.snapshot_id == sid)
        .order_by(AnalysisFinding.severity.desc()).limit(50).all()
    )
    return {
        "snapshot_id": str(sid),
        "analyzed_at": snapshot.created_at,
        "files": db.query(func.count(File.id)).filter(File.snapshot_id == sid).scalar() or 0,
        "modules": entity_counts.get("module", 0),
        "classes": entity_counts.get("class", 0),
        "functions": entity_counts.get("function", 0) + entity_counts.get("method", 0),
        "calls": db.query(func.count(CallRelationship.id)).filter(CallRelationship.snapshot_id == sid).scalar() or 0,
        "imports": db.query(func.count(Dependency.id)).filter(Dependency.snapshot_id == sid).scalar() or 0,
        "languages": languages,
        "finding_counts": finding_counts,
        "findings": [
            {"id": str(f.id), "type": f.type, "severity": f.severity, "description": f.description}
            for f in findings
        ],
    }

@router.get("/projects/{project_id}/findings")
def get_project_findings(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    snapshot = db.query(RepositorySnapshot).join(Repository).filter(Repository.project_id == project.id).order_by(RepositorySnapshot.created_at.desc()).first()
    if not snapshot:
        return []

    findings = db.query(AnalysisFinding).filter(AnalysisFinding.snapshot_id == snapshot.id).all()
    return [
        {
            "id": str(f.id),
            "type": f.type,
            "severity": f.severity,
            "description": f.description,
            "confidence": f.confidence,
            "evidence": f.evidence
        }
        for f in findings
    ]
