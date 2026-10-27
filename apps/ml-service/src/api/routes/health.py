from fastapi import APIRouter
from ...models.model_registry import registry

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "model_version": registry.current_version}
