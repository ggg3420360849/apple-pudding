import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


ALLOWED_MODELS = [
    "Volc-DeepSeek-V3.2",
    "Doubao-Seed-2.0-mini",
    "Doubao-Seed-2.0-lite",
    "Doubao-Seed-2.0-pro",
    "qwen3.5-plus",
]


class Settings:
    def __init__(self) -> None:
        self.xuanji_api_key = (os.getenv("XUANJI_API_KEY") or "").strip()
        self.xuanji_api_url = (os.getenv("XUANJI_API_URL") or "").strip()
        self.default_model = (os.getenv("DEFAULT_MODEL") or "Doubao-Seed-2.0-pro").strip()
        self.allowed_models = ALLOWED_MODELS


@lru_cache
def get_settings() -> Settings:
    return Settings()
