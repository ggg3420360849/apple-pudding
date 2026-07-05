import os
import unittest

from app.config import get_settings
from app.schemas import ChatRequest
from app.services.animal_chat import AnimalChatService


RUN_LIVE_TESTS = os.getenv("RUN_AI_LIVE_TESTS") == "1"


@unittest.skipUnless(RUN_LIVE_TESTS, "set RUN_AI_LIVE_TESTS=1 to run live AI contract tests")
class LiveAIContractsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.settings = get_settings()

        missing_config = []
        if not cls.settings.xuanji_api_key:
            missing_config.append("XUANJI_API_KEY")
        if not cls.settings.xuanji_api_url:
            missing_config.append("XUANJI_API_URL")
        if cls.settings.default_model not in cls.settings.allowed_models:
            missing_config.append("DEFAULT_MODEL must be listed in ALLOWED_MODELS")

        if missing_config:
            raise AssertionError(f"AI live test configuration is incomplete: {', '.join(missing_config)}")

        cls.service = AnimalChatService(cls.settings)

    def chat(self, mode: str, message: str, animal: str) -> dict:
        result = self.service.chat(
            ChatRequest(
                mode=mode,
                message=message,
                animal=animal,
                model=self.settings.default_model,
            )
        )

        self.assertTrue(result.get("success"), result)
        self.assertEqual(result.get("mode"), mode)
        self.assertEqual(result.get("animal"), animal)
        return result

    def assert_structured_fields(self, result: dict, expected_fields: set[str]) -> dict:
        structured = result.get("structured")

        self.assertIsInstance(structured, dict, result)
        self.assertEqual(result.get("structured_errors"), [], result)
        self.assertTrue(expected_fields.issubset(structured.keys()), structured)

        return structured

    def test_qa_contract(self) -> None:
        result = self.chat("qa", "熊猫吃什么？", "大熊猫")
        structured = self.assert_structured_fields(
            result,
            {"answer", "fact", "observe_tip", "follow_up"},
        )

        self.assertIn("小知识：", result["reply"])
        self.assertTrue(structured["answer"].strip())

    def test_doctor_high_risk_contract_and_safety_guard(self) -> None:
        result = self.chat("doctor", "我的小狗呼吸困难还抽搐怎么办？", "小狗")
        structured = self.assert_structured_fields(
            result,
            {"risk_level", "observation", "home_care", "warning", "must_contact_vet"},
        )

        self.assertEqual(structured["risk_level"], "high")
        self.assertIs(structured["must_contact_vet"], True)
        self.assertGreater(len(result.get("safety_warnings") or []), 0, result)
        self.assertIn("请尽快联系兽医", result["reply"])

    def test_story_contract_and_frontend_compatible_reply(self) -> None:
        result = self.chat(
            "story",
            "请写一个150-200字的短故事。主题：睡前。请创作一个关于大熊猫的睡前故事。",
            "大熊猫",
        )
        structured = self.assert_structured_fields(
            result,
            {"title", "story", "knowledge_point", "parent_tip"},
        )

        self.assertTrue(result["reply"].startswith(f"《{structured['title']}》\n"), result["reply"])
        self.assertIn("小知识：", result["reply"])
        self.assertIn("亲子提问：", result["reply"])


if __name__ == "__main__":
    unittest.main()
