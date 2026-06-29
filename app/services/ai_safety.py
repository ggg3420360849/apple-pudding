from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SafetyGuardResult:
    structured: dict[str, Any] | None
    warnings: list[str]
    high_risk: bool


HIGH_RISK_TERMS = (
    "流血",
    "出血",
    "呼吸困难",
    "喘不上气",
    "抽搐",
    "痉挛",
    "持续呕吐",
    "一直吐",
    "误食药物",
    "吃了药",
    "不吃不喝",
    "明显疼痛",
    "昏迷",
    "站不起来",
)

VET_WARNING = "这类情况可能有风险，AI不能替代兽医诊断，请尽快联系兽医或正规动物医院。"


def detect_high_risk_terms(text: str | None) -> list[str]:
    if not text:
        return []

    return [term for term in HIGH_RISK_TERMS if term in text]


def append_vet_warning(reply: str) -> str:
    if VET_WARNING in reply:
        return reply

    return f"{reply}\n安全提醒：{VET_WARNING}" if reply else f"安全提醒：{VET_WARNING}"


def apply_doctor_safety_guard(structured: dict[str, Any] | None, user_message: str) -> SafetyGuardResult:
    matched_terms = detect_high_risk_terms(user_message)
    if not matched_terms or structured is None:
        return SafetyGuardResult(
            structured=structured,
            warnings=[f"high risk term detected: {term}" for term in matched_terms],
            high_risk=bool(matched_terms),
        )

    guarded = dict(structured)
    guarded["risk_level"] = "high"
    guarded["must_contact_vet"] = True

    warning = str(guarded.get("warning") or "").strip()
    if VET_WARNING not in warning:
        guarded["warning"] = f"{warning} {VET_WARNING}".strip()

    return SafetyGuardResult(
        structured=guarded,
        warnings=[f"high risk term detected: {term}" for term in matched_terms],
        high_risk=True,
    )
