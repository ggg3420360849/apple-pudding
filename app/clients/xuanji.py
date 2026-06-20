import requests

from app.config import Settings


class XuanjiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def chat(self, model: str, system_prompt: str, user_question: str) -> dict:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.settings.xuanji_api_key}",
        }

        body = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_question,
                },
            ],
            "temperature": 0.7,
            "max_tokens": 500,
        }

        response = requests.post(
            self.settings.xuanji_api_url,
            headers=headers,
            json=body,
            timeout=60,
        )

        try:
            data = response.json()
        except Exception:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": "接口返回的不是 JSON",
                "raw": response.text,
            }

        if response.status_code != 200:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": "HTTP 请求失败",
                "raw": data,
            }

        return {
            "success": True,
            "data": data,
        }
