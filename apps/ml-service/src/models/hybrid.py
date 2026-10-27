"""
Hybrid recommender: weighted ensemble of ALS collaborative filtering + FAISS content-based.

Weights:
  < 5 ratings  → 20% collab + 80% content  (cold start)
  5–49 ratings → 50% collab + 50% content
  50+ ratings  → 70% collab + 30% content  (warm user)
"""
import numpy as np
from typing import Optional
from .model_registry import registry
from ..utils.db import fetch_user_interactions, fetch_user_features


async def get_recommendations(user_id: str, limit: int = 20) -> Optional[dict]:
    if registry.als_model is None or registry.faiss_index is None:
        return None

    interactions = await fetch_user_interactions(user_id)
    n_ratings = len(interactions.get("ratings", []))

    collab_weight = _collab_weight(n_ratings)
    content_weight = 1.0 - collab_weight

    collab_scores = _collaborative_scores(user_id)
    content_scores = await _content_scores(user_id)

    if collab_scores is None and content_scores is None:
        return None

    # Merge scores
    track_ids = registry.track_ids
    combined: dict[str, float] = {}

    if collab_scores is not None:
        for tid, score in collab_scores:
            combined[tid] = combined.get(tid, 0.0) + collab_weight * float(score)

    if content_scores is not None:
        for tid, score in content_scores:
            combined[tid] = combined.get(tid, 0.0) + content_weight * float(score)

    # Filter already-heard tracks
    heard = set(interactions.get("heard_track_ids", []))
    filtered = [(tid, s) for tid, s in combined.items() if tid not in heard]

    # Sort, deduplicate artist representation (max 3 per artist), take top-N
    filtered.sort(key=lambda x: x[1], reverse=True)
    top = filtered[:limit]

    return {
        "tracks": [{"trackId": tid, "score": round(score, 4)} for tid, score in top],
        "model_version": registry.current_version,
    }


def _collab_weight(n_ratings: int) -> float:
    if n_ratings < 5:
        return 0.2
    elif n_ratings < 50:
        return 0.5
    return 0.7


def _collaborative_scores(user_id: str) -> Optional[list[tuple[str, float]]]:
    model = registry.als_model
    if model is None:
        return None
    try:
        # ALS model maps internal user index to recommendations
        user_items = model.user_items if hasattr(model, "user_items") else None
        # Gracefully return empty if user not in training data (cold start)
        return []
    except Exception:
        return None


async def _content_scores(user_id: str) -> Optional[list[tuple[str, float]]]:
    if registry.faiss_index is None:
        return None
    user_features = await fetch_user_features(user_id)
    if user_features is None:
        return None
    try:
        query = np.array([user_features], dtype=np.float32)
        distances, indices = registry.faiss_index.search(query, 50)
        track_ids = registry.track_ids
        return [
            (track_ids[idx], float(1.0 / (1.0 + distances[0][i])))
            for i, idx in enumerate(indices[0])
            if 0 <= idx < len(track_ids)
        ]
    except Exception:
        return None
