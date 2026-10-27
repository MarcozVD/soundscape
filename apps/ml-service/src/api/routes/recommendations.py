from fastapi import APIRouter, HTTPException
from ...models.hybrid import get_recommendations
from ...utils.db import get_db_url

router = APIRouter()


@router.get("/recommendations/{user_id}")
async def recommendations(user_id: str, limit: int = 20):
    results = await get_recommendations(user_id, limit)
    if results is None:
        raise HTTPException(503, detail="Model not ready — retrain required")
    return {"tracks": results["tracks"], "modelVersion": results["model_version"]}
