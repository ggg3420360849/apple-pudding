import unittest

from app.services.ai_scenes import get_scene


class AIScenesTest(unittest.TestCase):
    def test_unknown_mode_falls_back_to_qa_scene(self) -> None:
        scene = get_scene("unknown")

        self.assertEqual(scene.name, "qa")
        self.assertIsNotNone(scene.contract)
        self.assertTrue(scene.include_animal_context)

    def test_story_scene_keeps_frontend_story_prompt_intact(self) -> None:
        scene = get_scene("story")

        self.assertEqual(scene.name, "story")
        self.assertFalse(scene.include_animal_context)
        self.assertIn("title 字段不要带《》", scene.system_prompt)

    def test_doctor_scene_applies_high_risk_safety_guard(self) -> None:
        scene = get_scene("doctor")
        structured = {
            "risk_level": "low",
            "observation": "先观察精神状态。",
            "home_care": "保持安静，准备清水。",
            "warning": "AI不能替代兽医。",
            "must_contact_vet": False,
        }

        result = scene.apply_safety(structured, "我的小狗呼吸困难怎么办？", "我的小狗呼吸困难怎么办？")

        self.assertEqual(result.structured["risk_level"], "high")
        self.assertIs(result.structured["must_contact_vet"], True)
        self.assertGreater(len(result.safety_warnings), 0)


if __name__ == "__main__":
    unittest.main()
