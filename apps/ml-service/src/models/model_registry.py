import os
import joblib
from pathlib import Path
from typing import Optional

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "./models"))


class ModelRegistry:
    def __init__(self):
        self.als_model = None
        self.faiss_index = None
        self.track_ids: list[str] = []
        self.current_version: Optional[str] = None
        self._load_latest()

    def _load_latest(self):
        als_path = MODEL_DIR / "als_model.pkl"
        faiss_path = MODEL_DIR / "faiss_index.pkl"
        meta_path = MODEL_DIR / "meta.pkl"

        if als_path.exists() and faiss_path.exists():
            self.als_model = joblib.load(als_path)
            self.faiss_index = joblib.load(faiss_path)
            if meta_path.exists():
                meta = joblib.load(meta_path)
                self.track_ids = meta.get("track_ids", [])
                self.current_version = meta.get("version")

    def save(self, als_model, faiss_index, track_ids: list[str], version: str):
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(als_model, MODEL_DIR / "als_model.pkl")
        joblib.dump(faiss_index, MODEL_DIR / "faiss_index.pkl")
        joblib.dump({"track_ids": track_ids, "version": version}, MODEL_DIR / "meta.pkl")

        self.als_model = als_model
        self.faiss_index = faiss_index
        self.track_ids = track_ids
        self.current_version = version


registry = ModelRegistry()
