import json
import re
from typing import Any, Callable

from app.services.ai_contracts import AIContract


def extract_reply_content(data: dict) -> str:
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


def parse_json_content(content: str) -> dict[str, Any] | None:
    if not content:
        return None

    text = content.strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1 or end <= start:
            return None

        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None

    return parsed if isinstance(parsed, dict) else None


def format_qa_reply(structured: dict[str, Any], fallback: str) -> str:
    parts: list[str] = []

    answer = structured.get("answer")
    fact = structured.get("fact")
    observe_tip = structured.get("observe_tip")
    follow_up = structured.get("follow_up")

    if answer:
        parts.append(str(answer))
    if fact:
        parts.append(f"小知识：{fact}")
    if observe_tip:
        parts.append(f"观察一下：{observe_tip}")
    if follow_up:
        parts.append(f"还可以问：{follow_up}")

    return "\n".join(parts) if parts else fallback


def format_doctor_reply(structured: dict[str, Any], fallback: str) -> str:
    parts: list[str] = []

    risk_level = structured.get("risk_level")
    observation = structured.get("observation")
    home_care = structured.get("home_care")
    warning = structured.get("warning")
    must_contact_vet = structured.get("must_contact_vet")

    if risk_level:
        risk_labels = {
            "low": "低风险",
            "medium": "中风险",
            "high": "高风险",
        }
        parts.append(f"风险等级：{risk_labels.get(str(risk_level), risk_level)}")
    if observation:
        parts.append(f"先观察：{observation}")
    if home_care:
        parts.append(f"安全照护：{home_care}")
    if warning:
        parts.append(f"安全提醒：{warning}")
    if must_contact_vet is True:
        parts.append("建议：请尽快联系兽医。")

    return "\n".join(parts) if parts else fallback


def format_story_reply(structured: dict[str, Any], fallback: str) -> str:
    title = str(structured.get("title") or "").strip().strip("《》")
    story = str(structured.get("story") or "").strip()
    knowledge_point = str(structured.get("knowledge_point") or "").strip()
    parent_tip = str(structured.get("parent_tip") or "").strip()

    if not title or not story:
        return fallback

    parts = [f"《{title}》", "", story]

    if knowledge_point:
        parts.extend(["", f"小知识：{knowledge_point}"])
    if parent_tip:
        parts.append(f"亲子提问：{parent_tip}")

    return "\n".join(parts)


def format_structured_reply(structured: dict[str, Any], fallback: str, scene: str | None = None) -> str:
    if scene == "doctor":
        return format_doctor_reply(structured, fallback)
    if scene == "story":
        return format_story_reply(structured, fallback)

    return format_qa_reply(structured, fallback)


ReplyFormatter = Callable[[dict[str, Any], str], str]


def parse_reply_payload(data: dict, contract: AIContract | None = None, formatter: ReplyFormatter | None = None) -> dict:
    content = extract_reply_content(data)
    structured = parse_json_content(content)

    validation_errors: list[str] = []
    if contract:
        structured, validation_errors = contract.validate(structured)

    reply = content
    if structured:
        reply_formatter = formatter or (lambda payload, fallback: format_structured_reply(payload, fallback, contract.scene if contract else None))
        reply = reply_formatter(structured, content)

    return {
        "reply": reply,
        "structured": structured,
        "structured_errors": validation_errors,
    }


def parse_reply(data: dict) -> str:
    return parse_reply_payload(data)["reply"]
