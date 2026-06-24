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

        # 语音识别服务配置
        self.speech_provider = (os.getenv("SPEECH_PROVIDER") or "mock").strip()

        # Tencent Cloud 配置
        self.tencent_secret_id = (os.getenv("TENCENT_SECRET_ID") or "").strip()
        self.tencent_secret_key = (os.getenv("TENCENT_SECRET_KEY") or "").strip()
        self.tencent_app_id = (os.getenv("TENCENT_APP_ID") or "").strip()

        # Alibaba Cloud 配置
        self.alibaba_access_key_id = (os.getenv("ALIBABA_ACCESS_KEY_ID") or "").strip()
        self.alibaba_access_key_secret = (os.getenv("ALIBABA_ACCESS_KEY_SECRET") or "").strip()
        self.alibaba_app_key = (os.getenv("ALIBABA_APP_KEY") or "").strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
