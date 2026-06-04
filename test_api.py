import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = (os.getenv("XUANJI_API_KEY") or "").strip()
API_URL = (os.getenv("XUANJI_API_URL") or "").strip()
DEFAULT_MODEL = (os.getenv("DEFAULT_MODEL") or "Doubao-Seed-2.0-pro").strip()


def test_api():
    if not API_KEY:
        print("错误：没有读取到 XUANJI_API_KEY，请检查 .env")
        return

    if not API_URL:
        print("错误：没有读取到 XUANJI_API_URL，请检查 .env")
        return

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    body = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "user",
                "content": "请用一句话介绍熊猫，适合6岁小朋友听。"
            }
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }

    print("请求地址：", API_URL)
    print("模型：", DEFAULT_MODEL)
    print("API_KEY长度：", len(API_KEY))
    print("发送请求中...")

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=body,
            timeout=60
        )

        print("状态码：", response.status_code)
        print("返回内容：")
        print(response.text)

    except Exception as e:
        print("请求失败：", e)


if __name__ == "__main__":
    test_api()