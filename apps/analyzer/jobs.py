from packages.shared.database import SessionLocal
from packages.shared.models import AnalysisJob
from apps.analyzer.pipeline import run_analysis_pipeline


def run_analysis_job(job_id: str, snapshot_id: str, workspace_dir: str):
    """Run one analysis job end to end and record its status.

    Shared by the Celery worker and by the API's inline mode (ANALYSIS_MODE=inline).
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if not job:
            return

        job.status = "RUNNING"
        db.commit()

        run_analysis_pipeline(db, snapshot_id, workspace_dir, job)

        job.status = "COMPLETED"
        job.progress = "100%"
        db.commit()
    except Exception as e:
        db.rollback()
        if job is not None:
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()
