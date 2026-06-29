import unittest

from app.services.ai_contracts import DOCTOR_CONTRACT, QA_CONTRACT, STORY_CONTRACT
from app.services.ai_safety import append_vet_warning, apply_doctor_safety_guard
from app.services.reply_parser import parse_reply_payload


def openai_response(content: str) -> dict:
    return {
        "choices": [
            {
                "message": {
                    "content": content,
                }
            }
        ]
    }


class ReplyParserTest(unittest.TestCase):
    def test_valid_qa_contract_returns_structured_payload(self) -> None:
        payload = parse_reply_payload(
            openai_response(
                '{"answer":"竹子。","fact":"会花很久吃竹子。",'
                '"observe_tip":"观察它怎样抓竹子。",'
                '"follow_up":"还想知道它怎么睡觉吗？"}'
            ),
            contract=QA_CONTRACT,
        )

        self.assertEqual(
            payload["structured"],
            {
                "answer": "竹子。",
                "fact": "会花很久吃竹子。",
                "observe_tip": "观察它怎样抓竹子。",
                "follow_up": "还想知道它怎么睡觉吗？",
            },
        )
        self.assertEqual(payload["structured_errors"], [])
        self.assertIn("小知识：会花很久吃竹子。", payload["reply"])

    def test_fenced_json_is_supported(self) -> None:
        payload = parse_reply_payload(
            openai_response(
                '```json\n{"answer":"竹子。","fact":"会花很久吃竹子。",'
                '"observe_tip":"观察它怎样抓竹子。",'
                '"follow_up":"还想知道它怎么睡觉吗？"}\n```'
            ),
            contract=QA_CONTRACT,
        )

        self.assertIsNotNone(payload["structured"])
        self.assertEqual(payload["structured_errors"], [])

    def test_invalid_contract_falls_back_to_plain_reply(self) -> None:
        content = '{"answer":"竹子。"}'
        payload = parse_reply_payload(openai_response(content), contract=QA_CONTRACT)

        self.assertIsNone(payload["structured"])
        self.assertEqual(payload["reply"], content)
        self.assertGreater(len(payload["structured_errors"]), 0)

    def test_plain_text_remains_supported(self) -> None:
        content = "熊猫主要吃竹子。"
        payload = parse_reply_payload(openai_response(content), contract=QA_CONTRACT)

        self.assertIsNone(payload["structured"])
        self.assertEqual(payload["reply"], content)

    def test_valid_doctor_contract_returns_typed_payload(self) -> None:
        payload = parse_reply_payload(
            openai_response(
                '{"risk_level":"medium","observation":"观察精神、食欲和排便。",'
                '"home_care":"保持环境安静，准备清水。",'
                '"warning":"AI不能替代兽医，症状加重要联系兽医。",'
                '"must_contact_vet":false}'
            ),
            contract=DOCTOR_CONTRACT,
        )

        self.assertEqual(payload["structured"]["risk_level"], "medium")
        self.assertIs(payload["structured"]["must_contact_vet"], False)
        self.assertEqual(payload["structured_errors"], [])
        self.assertIn("风险等级：中风险", payload["reply"])

    def test_invalid_doctor_risk_level_is_rejected(self) -> None:
        payload = parse_reply_payload(
            openai_response(
                '{"risk_level":"serious","observation":"观察状态。",'
                '"home_care":"保持安静。",'
                '"warning":"联系兽医。",'
                '"must_contact_vet":true}'
            ),
            contract=DOCTOR_CONTRACT,
        )

        self.assertIsNone(payload["structured"])
        self.assertGreater(len(payload["structured_errors"]), 0)

    def test_doctor_safety_guard_escalates_high_risk_terms(self) -> None:
        structured = {
            "risk_level": "low",
            "observation": "先观察精神状态。",
            "home_care": "准备清水，保持安静。",
            "warning": "AI不能替代兽医。",
            "must_contact_vet": False,
        }

        result = apply_doctor_safety_guard(structured, "我的兔子持续呕吐怎么办？")

        self.assertEqual(result.structured["risk_level"], "high")
        self.assertIs(result.structured["must_contact_vet"], True)
        self.assertTrue(result.high_risk)
        self.assertGreater(len(result.warnings), 0)
        self.assertIn("请尽快联系兽医", result.structured["warning"])

    def test_doctor_safety_guard_reports_high_risk_without_structured_payload(self) -> None:
        result = apply_doctor_safety_guard(None, "小狗呼吸困难怎么办？")

        self.assertIsNone(result.structured)
        self.assertTrue(result.high_risk)
        self.assertGreater(len(result.warnings), 0)

        reply = append_vet_warning("先保持环境安静。")
        self.assertIn("请尽快联系兽医", reply)

    def test_valid_story_contract_returns_frontend_compatible_reply(self) -> None:
        payload = parse_reply_payload(
            openai_response(
                '{"title":"竹林里的晚安","story":"小熊猫在竹林里找到一片柔软的叶子。",'
                '"knowledge_point":"大熊猫每天会花很长时间吃竹子。",'
                '"parent_tip":"可以问孩子：小熊猫为什么要慢慢吃竹子？"}'
            ),
            contract=STORY_CONTRACT,
        )

        self.assertEqual(payload["structured"]["title"], "竹林里的晚安")
        self.assertTrue(payload["reply"].startswith("《竹林里的晚安》\n"))
        self.assertIn("小知识：大熊猫每天会花很长时间吃竹子。", payload["reply"])
        self.assertIn("亲子提问：可以问孩子", payload["reply"])
        self.assertEqual(payload["structured_errors"], [])

    def test_invalid_story_contract_falls_back_to_plain_reply(self) -> None:
        content = '{"title":"竹林里的晚安","story":"小熊猫睡着了。"}'
        payload = parse_reply_payload(openai_response(content), contract=STORY_CONTRACT)

        self.assertIsNone(payload["structured"])
        self.assertEqual(payload["reply"], content)
        self.assertGreater(len(payload["structured_errors"]), 0)


if __name__ == "__main__":
    unittest.main()
