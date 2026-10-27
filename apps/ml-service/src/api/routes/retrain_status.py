"""
GET /retrain/status
Returns the current retraining status, last run timestamp, and model version.
Status is read from the Redis key "retrain:status".
"""

import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
import redis.asyncio as aioredis

from ....utils.config import settings

router = APIRouter()


class RetrainStatus(BaseModel):
    status: str  # "idle" | "running" | "completed" | "failed"
    lastRun: Optional[datetime]
    modelVersion: Optional[str]


async def _get_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.redis_url, decode_responses=True)


@router.get("/retrain/status", response_model=RetrainStatus)
async def get_retrain_status() -> RetrainStatus:
    """Return the current retraining pipeline status from Redis."""
    r = await _get_redis()
    try:
        raw = await r.get("retrain:status")
    finally:
        await r.aclose()

    if raw is None:
        return RetrainStatus(status="idle", lastRun=None, modelVersion=None)

    try:
        data: dict = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return RetrainStatus(status="idle", lastRun=None, modelVersion=None)

    last_run: Optional[datetime] = None
    if data.get("lastRun"):
        try:
            last_run = datetime.fromisoformat(data["lastRun"])
        except (ValueError, TypeError):
            pass

    return RetrainStatus(
        status=data.get("status", "idle"),
        lastRun=last_run,
        modelVersion=data.get("modelVersion"),
    )
