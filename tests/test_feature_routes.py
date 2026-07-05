import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

from app.config import Settings, get_settings
from app.database import SessionStore, WeeklyGoal, get_session_store
from app.main import app
from app.routers.offline import get_offline_queue
from app.services.offline_service import OfflineQueue
from app.services.speech_service import SpeechRecognitionService


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


async def asgi_request(method: str, path: str, body=None, headers=None, client_ip: str = "127.0.0.1", query=None):
    encoded = json.dumps(body).encode("utf-8") if body is not None else b""
    request_headers = []
    if body is not None:
        request_headers.append((b"content-type", b"application/json"))
    request_headers.extend((key.lower().encode(), value.encode()) for key, value in (headers or {}).items())

    query_string = urlencode(query or {}, doseq=True).encode()
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": query_string,
        "headers": request_headers,
        "client": (client_ip, 12345),
        "server": ("test", 80),
    }
    sent = False
    messages = []

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": encoded, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    status = start["status"]
    response_headers = {
        key.decode().lower(): value.decode()
        for key, value in start.get("headers", [])
    }
    response_body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, response_headers, response_body


class FeatureRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SessionStore(str(Path(self.temp.name) / "data"))
        self.queue = OfflineQueue(str(Path(self.temp.name) / "offline"))
        self.settings = Settings()
        self.settings.auth_secret = "integration-test-secret"
        self.client_counter = 1

        app.state.register_rate_limit_store = {}
        app.dependency_overrides[get_session_store] = lambda: self.store
        app.dependency_overrides[get_settings] = lambda: self.settings
        app.dependency_overrides[get_offline_queue] = lambda: self.queue

    def tearDown(self):
        app.dependency_overrides.clear()
        self.temp.cleanup()

    def request(self, method, path, body=None, token=None, client_ip=None, query=None):
        headers = {"authorization": f"Bearer {token}"} if token else None
        if client_ip is None:
            client_ip = f"127.0.1.{self.client_counter}"
            self.client_counter += 1
        return asyncio.run(asgi_request(method, path, body, headers, client_ip=client_ip, query=query))

    def request_json(self, method, path, body=None, token=None, client_ip=None, query=None):
        status, headers, response_body = self.request(
            method,
            path,
            body=body,
            token=token,
            client_ip=client_ip,
            query=query,
        )
        payload = json.loads(response_body or b"{}")
        return status, headers, payload

    def register(self, phone: str):
        status, _, payload = self.request_json("POST", "/api/family/register", {
            "parent_name": "Parent",
            "phone": phone,
            "password": "safe-password",
        })
        self.assertEqual(status, 200, payload)
        return payload

    def add_child(self, account_id: str, token: str, name: str, avatar: str = "🐼", age: int = 6):
        status, _, payload = self.request_json("POST", f"/api/family/accounts/{account_id}/children", {
            "name": name,
            "age": age,
            "avatar": avatar,
        }, token=token)
        self.assertEqual(status, 200, payload)
        return payload["child"]

    def test_static_routes_use_absolute_paths_and_return_html(self):
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertTrue(headers["content-type"].startswith("text/html"))
        self.assertIn("苹果布丁".encode("utf-8"), body)
        self.assertEqual(body.count(b"</body>"), 1)
        self.assertEqual(body.count(b"</html>"), 1)

        status, headers, body = self.request("GET", "/family")
        self.assertEqual(status, 200)
        self.assertTrue(headers["content-type"].startswith("text/html"))
        self.assertIn("家庭学习版".encode("utf-8"), body)

        status, headers, body = self.request("GET", "/static/index-login.html")
        self.assertEqual(status, 200)
        self.assertTrue(headers["content-type"].startswith("text/html"))
        self.assertGreater(len(body), 1000)

    def test_app_can_import_from_outer_workspace_directory(self):
        project_root = Path(__file__).resolve().parents[1]
        workspace_root = project_root.parent
        deps_root = project_root / ".codex_pydeps"
        code = (
            "import sys; "
            f"sys.path[:0]=[{str(project_root)!r}, {str(deps_root)!r}]; "
            "import app.main; "
            "print('ok')"
        )
        env = os.environ.copy()
        env["PYTHONPATH"] = os.pathsep.join([str(project_root), str(deps_root)])

        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=workspace_root,
            env=env,
            capture_output=True,
            text=True,
            timeout=10,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("ok", result.stdout)

    def test_achievement_routes_cover_progress_calendar_and_leaderboard(self):
        parent = self.register("13800000101")
        account_id = parent["account"]["id"]
        first_child = self.add_child(account_id, parent["token"], "成就孩子", avatar="🦁", age=7)
        second_child = self.add_child(account_id, parent["token"], "对照孩子", avatar="🐰", age=5)

        for animal in ("panda", "rabbit", "frog"):
            self.store.record_animal_explored(account_id, first_child["id"], animal)
        for _ in range(10):
            self.store.record_question_answer(account_id, first_child["id"], True)
        self.store.record_story_created(account_id, second_child["id"])

        goal = WeeklyGoal(
            id="goal-1",
            child_id=first_child["id"],
            week_start=datetime.now(),
            goal_type="explore_animals",
            target=5,
            current_progress=3,
        )
        self.store.create_weekly_goal(goal)

        status, _, payload = self.request_json("GET", "/api/achievements/all")
        self.assertEqual(status, 200, payload)
        self.assertEqual(len(payload["achievements"]), 12)

        status, _, payload = self.request_json(
            "POST",
            f"/api/achievements/check/{account_id}/{first_child['id']}",
            {},
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(
            {achievement["id"] for achievement in payload["newly_earned"]},
            {"explorer_beginner", "scholar_beginner"},
        )

        status, _, payload = self.request_json(
            "GET",
            f"/api/achievements/progress/{account_id}/{first_child['id']}",
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertIn("explorer_beginner", payload["progress"]["earned_badges"])
        self.assertEqual(
            payload["progress"]["progress_by_achievement"]["scholar_beginner"]["current"],
            10,
        )

        status, _, payload = self.request_json(
            "GET",
            f"/api/achievements/calendar/{account_id}/{first_child['id']}",
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(len(payload["calendar"]["days"]), 7)
        self.assertEqual(len(payload["calendar"]["goals"]), 1)
        self.assertEqual(payload["calendar"]["goals"][0]["percentage"], 60)

        status, _, payload = self.request_json(
            "GET",
            f"/api/achievements/leaderboard/{account_id}",
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["leaderboard"][0]["child_id"], first_child["id"])
        self.assertEqual(payload["leaderboard"][0]["total_badges"], 2)

    def test_offline_sync_marks_items_synced_and_clear_removes_only_synced_records(self):
        parent = self.register("13800000102")
        account_id = parent["account"]["id"]
        child = self.add_child(account_id, parent["token"], "离线孩子")

        sync_activity = {
            "id": "sync-1",
            "account_id": account_id,
            "child_id": child["id"],
            "activity_type": "animal_explored",
            "data": {"animal": "panda"},
            "timestamp": 1_720_000_000_000,
        }
        pending_activity = {
            "id": "pending-1",
            "account_id": account_id,
            "child_id": child["id"],
            "activity_type": "story_created",
            "data": {},
            "timestamp": 1_720_000_100_000,
        }
        self.queue.enqueue(sync_activity.copy())
        self.queue.enqueue(pending_activity.copy())

        status, _, payload = self.request_json("GET", "/api/offline/queue/stats", token=parent["token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["stats"], {"total": 2, "pending": 2, "synced": 0})

        status, _, payload = self.request_json(
            "POST",
            "/api/offline/sync",
            [sync_activity],
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["synced"], 1)
        self.assertEqual(payload["failed"], 0)

        status, _, payload = self.request_json("GET", "/api/offline/queue/stats", token=parent["token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["stats"], {"total": 2, "pending": 1, "synced": 1})

        child_profile = self.store.get_child_profile(account_id, child["id"])
        self.assertEqual(child_profile.animals_explored, ["panda"])

        status, _, payload = self.request_json("POST", "/api/offline/queue/clear", {}, token=parent["token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["removed"], 1)

        status, _, payload = self.request_json("GET", "/api/offline/queue/stats", token=parent["token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["stats"], {"total": 1, "pending": 1, "synced": 0})

    def test_sharing_routes_generate_png_cards_and_qr_code(self):
        parent = self.register("13800000103")
        account_id = parent["account"]["id"]
        child = self.add_child(account_id, parent["token"], "分享孩子", age=8)

        self.store.add_imagined_animal(account_id, child["id"], {
            "id": "animal-1",
            "name": "云朵猫",
            "description": "长着云朵尾巴，会在下雨天发光。",
            "features": ["云朵尾巴", "下雨发光"],
        })

        status, headers, body = self.request(
            "POST",
            "/api/sharing/card/animal",
            {
                "account_id": account_id,
                "child_id": child["id"],
                "content_type": "imagined_animal",
                "content_id": "animal-1",
            },
            token=parent["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["content-type"], "image/png")
        self.assertTrue(headers["content-disposition"].startswith("attachment; filename=animal_card_"))
        self.assertTrue(body.startswith(PNG_SIGNATURE))

        status, headers, body = self.request(
            "POST",
            "/api/sharing/card/story",
            {
                "account_id": account_id,
                "child_id": child["id"],
                "content_type": "story",
                "content_id": "story-1",
            },
            token=parent["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["content-type"], "image/png")
        self.assertTrue(body.startswith(PNG_SIGNATURE))

        status, headers, body = self.request(
            "GET",
            "/api/sharing/qr-code",
            token=parent["token"],
            query={"account_id": account_id},
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["content-type"], "image/png")
        self.assertTrue(body.startswith(PNG_SIGNATURE))

    def test_speech_routes_list_providers_and_mock_service_handles_audio(self):
        status, _, payload = self.request_json("GET", "/api/speech/providers")
        self.assertEqual(status, 200, payload)
        providers = {provider["id"]: provider for provider in payload["providers"]}
        self.assertTrue(providers["mock"]["available"])
        self.assertIn("tencent", providers)
        self.assertIn("alibaba", providers)

        with tempfile.NamedTemporaryFile(suffix=".wav") as audio_file:
            audio_file.write(b"RIFFdemo")
            audio_file.flush()

            service = SpeechRecognitionService("mock")
            self.assertEqual(service.transcribe_audio(audio_file.name), "这是模拟的语音识别结果")

            assessment = service.assess_pronunciation(audio_file.name, "苹果")
            self.assertEqual(assessment["overall_score"], 85.5)
            self.assertEqual(len(assessment["words"]), 2)


if __name__ == "__main__":
    unittest.main()
