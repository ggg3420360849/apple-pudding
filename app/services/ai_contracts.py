from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class StructuredField:
    name: str
    description: str
    value_type: str = "string"
    allowed_values: tuple[str, ...] = ()


@dataclass(frozen=True)
class AIContract:
    scene: str
    fields: tuple[StructuredField, ...]

    def to_prompt(self) -> str:
        lines = [
            "请只返回 JSON，不要使用 Markdown，不要添加解释文字。",
            "JSON 必须包含以下字段：",
            "{",
        ]

        for index, field in enumerate(self.fields):
            suffix = "," if index < len(self.fields) - 1 else ""
            lines.append(f'  "{field.name}": "{field.description}"{suffix}')

        lines.append("}")
        return "\n".join(lines)

    def validate(self, payload: dict[str, Any] | None) -> tuple[dict[str, Any] | None, list[str]]:
        if not isinstance(payload, dict):
            return None, ["structured payload is not an object"]

        normalized: dict[str, Any] = {}
        errors: list[str] = []

        for field in self.fields:
            value = payload.get(field.name)

            normalized_value, error = self._normalize_field(field, value)
            if error:
                errors.append(error)
                continue

            normalized[field.name] = normalized_value

        if errors:
            return None, errors

        return normalized, []

    def _normalize_field(self, field: StructuredField, value: Any) -> tuple[Any, str | None]:
        if field.value_type == "boolean":
            if isinstance(value, bool):
                return value, None

            if isinstance(value, str):
                lowered = value.strip().lower()
                if lowered == "true":
                    return True, None
                if lowered == "false":
                    return False, None

            return None, f"missing or invalid boolean field: {field.name}"

        if not isinstance(value, str):
            return None, f"missing or invalid field: {field.name}"

        normalized = value.strip()
        if not normalized:
            return None, f"empty field: {field.name}"

        if field.allowed_values:
            normalized = normalized.lower()
            if normalized not in field.allowed_values:
                allowed = ", ".join(field.allowed_values)
                return None, f"invalid value for field {field.name}: expected one of {allowed}"

        return normalized, None


QA_CONTRACT = AIContract(
    scene="qa",
    fields=(
        StructuredField("answer", "给孩子的直接回答，80字以内"),
        StructuredField("fact", "一个真实动物知识点，50字以内"),
        StructuredField("observe_tip", "一个孩子可以观察的小提示，50字以内"),
        StructuredField("follow_up", "一个自然的追问问题，30字以内"),
    ),
)

DOCTOR_CONTRACT = AIContract(
    scene="doctor",
    fields=(
        StructuredField("risk_level", "风险等级，只能是 low、medium 或 high", allowed_values=("low", "medium", "high")),
        StructuredField("observation", "需要先观察的症状或状态，80字以内"),
        StructuredField("home_care", "在联系兽医前可以安全做的照护，80字以内，不给药物剂量"),
        StructuredField("warning", "清楚说明不能替代兽医，以及何时必须联系兽医，80字以内"),
        StructuredField("must_contact_vet", "是否必须联系兽医，true 或 false", value_type="boolean"),
    ),
)

STORY_CONTRACT = AIContract(
    scene="story",
    fields=(
        StructuredField("title", "吸引3到10岁儿童的故事标题，不超过15字，不带书名号"),
        StructuredField("story", "完整故事正文，温暖、有画面感，包含一个小困难和温暖结尾"),
        StructuredField("knowledge_point", "一个真实动物知识点，60字以内"),
        StructuredField("parent_tip", "一个家长可以问孩子的互动问题，50字以内"),
    ),
)
