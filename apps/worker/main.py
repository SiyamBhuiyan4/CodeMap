import os
from celery import Celery
from apps.analyzer.jobs import run_analysis_job

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("codeatlas_worker", broker=redis_url, backend=redis_url)

@celery_app.task
def analyze_repository_task(job_id: str, snapshot_id: str, workspace_dir: str):
    run_analysis_job(job_id, snapshot_id, workspace_dir)
