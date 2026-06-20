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
