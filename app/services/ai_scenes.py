from dataclasses import dataclass
from typing import Any, Callable

from app.services.ai_contracts import AIContract, DOCTOR_CONTRACT, QA_CONTRACT, STORY_CONTRACT
from app.services.ai_safety import append_vet_warning, apply_doctor_safety_guard
from app.services.reply_parser import format_doctor_reply, format_qa_reply, format_story_reply


COMMON_PROMPT = (
    "你面向3到10岁儿童和家长，回答必须安全、温和、准确。"
    "语言要简单、有画面感，不使用复杂术语。"
)

ReplyFormatter = Callable[[dict[str, Any], str], str]


@dataclass(frozen=True)
class SceneResult:
    reply: str
    structured: dict[str, Any] | None
    safety_warnings: list[str]


@dataclass(frozen=True)
class AIScene:
    name: str
    system_prompt: str
    contract: AIContract | None = None
    formatter: ReplyFormatter | None = None
    include_animal_context: bool = True

    def format_reply(self, structured: dict[str, Any], fallback: str) -> str:
        if self.formatter:
            return self.formatter(structured, fallback)

        return fallback

    def apply_safety(self, structured: dict[str, Any] | None, reply: str, user_message: str) -> SceneResult:
        return SceneResult(reply=reply, structured=structured, safety_warnings=[])


@dataclass(frozen=True)
class DoctorScene(AIScene):
    def apply_safety(self, structured: dict[str, Any] | None, reply: str, user_message: str) -> SceneResult:
        guard_result = apply_doctor_safety_guard(structured, user_message)

        if guard_result.structured:
            return SceneResult(
                reply=self.format_reply(guard_result.structured, reply),
                structured=guard_result.structured,
                safety_warnings=guard_result.warnings,
            )

        if guard_result.high_risk:
            return SceneResult(
                reply=append_vet_warning(reply),
                structured=structured,
                safety_warnings=guard_result.warnings,
            )

        return SceneResult(reply=reply, structured=structured, safety_warnings=guard_result.warnings)


QA_SCENE = AIScene(
    name="qa",
    system_prompt=(
        COMMON_PROMPT
        + "你是儿童动物科普老师。回答要短、有趣、适合小朋友理解。"
        + "请尽量包含一个真实知识点和一个可观察的小提示。"
        + "请按指定 JSON 结构输出，便于前端拆分展示。"
        + QA_CONTRACT.to_prompt()
    ),
    contract=QA_CONTRACT,
    formatter=format_qa_reply,
)

DOCTOR_SCENE = DoctorScene(
    name="doctor",
    system_prompt=(
        COMMON_PROMPT
        + "你是AI动物照护科普助手，不做确诊，不给药物剂量。"
        + "只能提供观察和安全照护建议，不能替代兽医诊断。"
        + "遇到流血、呼吸困难、抽搐、持续呕吐、误食药物、不吃不喝、明显疼痛等情况，must_contact_vet 必须为 true，risk_level 必须为 high。"
        + "不要推荐具体药品，不要给药物剂量，不要指导危险操作。"
        + "请按指定 JSON 结构输出，便于前端拆分展示。"
        + DOCTOR_CONTRACT.to_prompt()
    ),
    contract=DOCTOR_CONTRACT,
    formatter=format_doctor_reply,
)

STORY_SCENE = AIScene(
    name="story",
    system_prompt=(
        COMMON_PROMPT
        + "你是儿童动物故事作者。根据给定的动物和主题，写一个温馨有趣的短故事。"
        + "如果孩子提出了具体的故事愿望，请围绕这个愿望来创作。"
        + "如果没有具体愿望，请根据动物特点和主题自由创作。"
        + "故事要包含一个真实动物知识点，有开头、一次小困难、温暖结尾。"
        + "语言要生动有画面感，适合家长朗读给孩子听。"
        + "根据要求的字数（短/中/长）来控制故事长度。"
        + "请按指定 JSON 结构输出，便于前端拆分展示。"
        + "title 字段不要带《》；story 字段不要重复标题。"
        + STORY_CONTRACT.to_prompt()
    ),
    contract=STORY_CONTRACT,
    formatter=format_story_reply,
    include_animal_context=False,
)

SCENES_BY_NAME = {
    QA_SCENE.name: QA_SCENE,
    DOCTOR_SCENE.name: DOCTOR_SCENE,
    STORY_SCENE.name: STORY_SCENE,
}


def get_scene(mode: str | None) -> AIScene:
    return SCENES_BY_NAME.get(mode or "qa", QA_SCENE)
