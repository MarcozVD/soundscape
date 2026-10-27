from typing import Optional
import asyncpg
from .config import settings


async def _conn():
    return await asyncpg.connect(settings.database_url)


async def fetch_user_interactions(user_id: str) -> dict:
    conn = await _conn()
    try:
        rows = await conn.fetch(
            """
            SELECT track_id FROM listen_events WHERE user_id = $1
            UNION SELECT track_id FROM ratings WHERE user_id = $1
            """,
            user_id,
        )
        ratings = await conn.fetch("SELECT track_id FROM ratings WHERE user_id = $1", user_id)
        return {
            "heard_track_ids": [str(r["track_id"]) for r in rows],
            "ratings": [str(r["track_id"]) for r in ratings],
        }
    finally:
        await conn.close()


async def fetch_user_features(user_id: str) -> Optional[list[float]]:
    """Average audio feature vector from tracks rated 4+ stars or frequently played."""
    conn = await _conn()
    try:
        rows = await conn.fetch(
            """
            SELECT t.metadata
            FROM tracks t
            JOIN ratings r ON r.track_id = t.id
            WHERE r.user_id = $1 AND r.stars >= 4
            LIMIT 50
            """,
            user_id,
        )
        if not rows:
            return None

        import json
        import numpy as np

        feature_keys = ["energy", "valence", "danceability", "tempo", "acousticness",
                        "instrumentalness", "speechiness", "loudness"]
        vectors = []
        for row in rows:
            meta = json.loads(row["metadata"] or "{}")
            audio = meta.get("audio_features", {})
            if audio:
                v = [float(audio.get(k, 0.0)) for k in feature_keys]
                vectors.append(v)

        if not vectors:
            return None
        return list(np.mean(vectors, axis=0))
    finally:
        await conn.close()


async def load_training_data() -> dict:
    """Load all interactions for model training."""
    conn = await _conn()
    try:
        listens = await conn.fetch(
            """
            SELECT user_id::text, track_id::text, COUNT(*) as plays
            FROM listen_events
            GROUP BY user_id, track_id
            """
        )
        ratings = await conn.fetch(
            "SELECT user_id::text, track_id::text, stars FROM ratings WHERE retrain_ingested = FALSE"
        )

        interactions = []
        for row in listens:
            interactions.append((row["user_id"], row["track_id"], min(float(row["plays"]) * 0.5, 5.0)))
        for row in ratings:
            interactions.append((row["user_id"], row["track_id"], float(row["stars"])))

        users = list({i[0] for i in interactions})
        tracks = list({i[1] for i in interactions})

        return {"interactions": interactions, "users": users, "tracks": tracks}
    finally:
        await conn.close()


async def load_track_features(track_ids: list[str]) -> list[list[float]]:
    if not track_ids:
        return []
    conn = await _conn()
    try:
        import json
        import numpy as np

        placeholders = ", ".join(f"${i+1}::uuid" for i in range(len(track_ids)))
        rows = await conn.fetch(
            f"SELECT id::text, metadata FROM track_provider_ids WHERE provider = 'spotify' AND track_id IN ({placeholders})",
            *track_ids,
        )
        feature_keys = ["energy", "valence", "danceability", "tempo", "acousticness",
                        "instrumentalness", "speechiness", "loudness"]
        results = []
        for row in rows:
            meta = json.loads(row["metadata"] or "{}")
            audio = meta.get("audio_features", {})
            v = [float(audio.get(k, 0.0)) for k in feature_keys]
            results.append(v)
        return results
    finally:
        await conn.close()


async def mark_ratings_ingested():
    conn = await _conn()
    try:
        await conn.execute("UPDATE ratings SET retrain_ingested = TRUE WHERE retrain_ingested = FALSE")
    finally:
        await conn.close()
