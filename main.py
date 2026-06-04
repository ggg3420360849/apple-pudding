import os
import requests

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import FileResponse

load_dotenv()

API_KEY = (os.getenv("XUANJI_API_KEY") or "").strip()
API_URL = (os.getenv("XUANJI_API_URL") or "").strip()
DEFAULT_MODEL = (os.getenv("DEFAULT_MODEL") or "Doubao-Seed-2.0-pro").strip()

ALLOWED_MODELS = [
    "Volc-DeepSeek-V3.2",
    "Doubao-Seed-2.0-mini",
    "Doubao-Seed-2.0-lite",
    "Doubao-Seed-2.0-pro",
    "qwen3.5-plus",
]

app = FastAPI()


class ChatRequest(BaseModel):
    message: str
    animal: str | None = None
    model: str | None = None


@app.get("/")
def home():
    return {
        "message": "后端启动成功",
        "docs": "打开 http://127.0.0.1:8000/docs 测试接口",
        "default_model": DEFAULT_MODEL,
        "allowed_models": ALLOWED_MODELS,
    }

@app.get("/demo")
def demo_page():
    return FileResponse("static/index.html")

@app.get("/api/models")
def get_models():
    return {
        "success": True,
        "default_model": DEFAULT_MODEL,
        "models": ALLOWED_MODELS,
    }


@app.post("/api/animal/chat")
def animal_chat(req: ChatRequest):
    if not API_KEY:
        return {
            "success": False,
            "error": "没有读取到 XUANJI_API_KEY，请检查 .env 文件"
        }

    if not API_URL:
        return {
            "success": False,
            "error": "没有读取到 XUANJI_API_URL，请检查 .env 文件"
        }

    selected_model = req.model or DEFAULT_MODEL

    if selected_model not in ALLOWED_MODELS:
        return {
            "success": False,
            "error": "模型名称不支持",
            "allowed_models": ALLOWED_MODELS
        }

    system_prompt = (
        "你是一个儿童动物科普老师，面向3到8岁儿童。"
        "回答要简单、短、有趣、适合小朋友理解。"
        "不要使用复杂术语。"
        "每次回答控制在100字以内。"
    )

    user_question = req.message

    if req.animal:
        user_question = f"当前动物是：{req.animal}。孩子的问题是：{req.message}"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    body = {
        "model": selected_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_question
            }
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=body,
            timeout=60
        )

        try:
            data = response.json()
        except Exception:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": "接口返回的不是 JSON",
                "raw": response.text
            }

        if response.status_code != 200:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": "HTTP 请求失败",
                "raw": data
            }

        reply = parse_reply(data)

        return {
            "success": True,
            "model": selected_model,
            "animal": req.animal,
            "message": req.message,
            "reply": reply,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def parse_reply(data: dict) -> str:
    """
    兼容常见 OpenAI 格式返回：
    {
      "choices": [
        {
          "message": {
            "content": "..."
          }
        }
      ]
    }
    """

    if not isinstance(data, dict):
        return ""

    choices = data.get("choices")

    if isinstance(choices, list) and len(choices) > 0:
        first_choice = choices[0]

        if isinstance(first_choice, dict):
            message = first_choice.get("message")

            if isinstance(message, dict):
                content = message.get("content")
                if content:
                    return content

            text = first_choice.get("text")
            if text:
                return text

    data_field = data.get("data")

    if isinstance(data_field, dict):
        content = data_field.get("content")
        if content:
            return content

    content = data.get("content")
    if content:
        return content

    return "接口已返回，但没有解析到回答内容，请查看 raw 字段。"