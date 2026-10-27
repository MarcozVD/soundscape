from fastapi import APIRouter, BackgroundTasks
from ...training.pipeline import run_pipeline

router = APIRouter()


@router.post("/retrain")
async def trigger_retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline)
    return {"status": "queued"}
