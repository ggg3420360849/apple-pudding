import requests

from app.config import get_settings

settings = get_settings()


def test_api():
    if not settings.xuanji_api_key:
        print("错误：没有读取到 XUANJI_API_KEY，请检查 .env")
        return

    if not settings.xuanji_api_url:
        print("错误：没有读取到 XUANJI_API_URL，请检查 .env")
        return

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.xuanji_api_key}",
    }

    body = {
        "model": settings.default_model,
        "messages": [
            {
                "role": "user",
                "content": "请用一句话介绍熊猫，适合6岁小朋友听。"
            }
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }

    print("请求地址：", settings.xuanji_api_url)
    print("模型：", settings.default_model)
    print("API_KEY长度：", len(settings.xuanji_api_key))
    print("发送请求中...")

    try:
        response = requests.post(
            settings.xuanji_api_url,
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
