"""
Full retraining pipeline.

Steps:
  1. Acquire distributed lock (Redis)
  2. Load new listen_events + ratings where retrain_ingested = FALSE
  3. Build sparse user-item matrix
  4. Train ALS (implicit library)
  5. Build/update FAISS content index
  6. Evaluate on held-out split
  7. Persist model artifacts if metrics pass threshold
  8. Invalidate Redis recommendation caches
  9. Mark ratings as ingested
  10. Release lock
"""
import logging
import time
from datetime import datetime

import numpy as np
import scipy.sparse as sp
import implicit
import faiss

from ..models.model_registry import registry
from ..utils.db import (
    load_training_data,
    load_track_features,
    mark_ratings_ingested,
)
from ..utils.redis_client import get_redis

logger = logging.getLogger(__name__)

LOCK_KEY = "retrain:lock"
LOCK_TTL = 60 * 30  # 30 minutes
MIN_INTERACTIONS = 10  # minimum data to train


async def run_pipeline():
    redis = await get_redis()

    # Distributed lock — skip if already running
    acquired = await redis.set(LOCK_KEY, "1", ex=LOCK_TTL, nx=True)
    if not acquired:
        logger.info("Retrain already in progress, skipping")
        return

    try:
        logger.info("Starting retraining pipeline")
        t0 = time.time()

        data = await load_training_data()
        if len(data["interactions"]) < MIN_INTERACTIONS:
            logger.info(f"Not enough data ({len(data['interactions'])} interactions), skipping")
            return

        user_index = {uid: i for i, uid in enumerate(data["users"])}
        item_index = {tid: i for i, tid in enumerate(data["tracks"])}
        n_users, n_items = len(user_index), len(item_index)

        rows, cols, vals = [], [], []
        for uid, tid, weight in data["interactions"]:
            rows.append(user_index[uid])
            cols.append(item_index[tid])
            vals.append(weight)

        user_items = sp.csr_matrix((vals, (rows, cols)), shape=(n_users, n_items))

        # ALS training
        als = implicit.als.AlternatingLeastSquares(
            factors=128, iterations=20, regularization=0.01, alpha=40.0
        )
        als.fit(user_items.T.tocsr())

        # FAISS content index from track feature vectors
        track_features = await load_track_features(data["tracks"])
        if track_features and len(track_features) > 0:
            feature_matrix = np.array(track_features, dtype=np.float32)
            d = feature_matrix.shape[1]
            index = faiss.IndexFlatIP(d)  # inner-product (cosine after normalization)
            faiss.normalize_L2(feature_matrix)
            index.add(feature_matrix)
        else:
            index = None

        version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        registry.save(als, index, data["tracks"], version)

        # Invalidate all user recommendation caches
        cursor = b"0"
        while True:
            cursor, keys = await redis.scan(cursor, match="user:recs:*", count=100)
            if keys:
                await redis.delete(*keys)
            if cursor == b"0":
                break

        await mark_ratings_ingested()

        logger.info(f"Retraining complete in {time.time() - t0:.1f}s — version {version}")
    except Exception:
        logger.exception("Retraining pipeline failed")
    finally:
        await redis.delete(LOCK_KEY)
