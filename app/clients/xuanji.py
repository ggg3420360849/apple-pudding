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
            timeout=30,
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

    def transcribe(self, audio_path: str) -> dict:
        """调用语音识别API - 临时使用文字转换方案"""
        # 由于玄机API可能不支持Whisper接口，这里使用一个临时方案
        # 返回一个提示文字，让用户知道录音功能正常工作

        import os
        file_size = os.path.getsize(audio_path)

        # 如果音频文件太小，说明录音失败
        if file_size < 1000:
            raise Exception("录音文件太小，请说话时间长一点")

        # 临时返回示例文字，表示录音成功
        # TODO: 接入真实的语音识别服务（如阿里云、腾讯云、百度语音识别等）
        return {
            "text": f"录音成功（文件大小: {file_size} 字节）- 请描述一个小动物的故事想法"
        }
