import asyncio
import json
import tempfile
import unittest

from app.config import Settings, get_settings
from app.database import ChildProfile, FamilyAccount, SessionStore, get_session_store
from app.main import app


async def asgi_request(method: str, path: str, body=None, headers=None, client_ip: str = "127.0.0.1"):
    encoded = json.dumps(body).encode() if body is not None else b""
    request_headers = [(b"content-type", b"application/json")]
    request_headers.extend((key.lower().encode(), value.encode()) for key, value in (headers or {}).items())
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
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
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, json.loads(response_body or b"{}")


class ApiAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SessionStore(self.temp.name)
        self.settings = Settings()
        self.settings.auth_secret = "integration-test-secret"
        self.client_counter = 1
        app.state.register_rate_limit_store = {}
        app.dependency_overrides[get_session_store] = lambda: self.store
        app.dependency_overrides[get_settings] = lambda: self.settings

    def tearDown(self):
        app.dependency_overrides.clear()
        self.temp.cleanup()

    def request(self, method, path, body=None, token=None, client_ip=None):
        headers = {"authorization": f"Bearer {token}"} if token else None
        if client_ip is None:
            client_ip = f"127.0.0.{self.client_counter}"
            self.client_counter += 1
        return asyncio.run(asgi_request(method, path, body, headers, client_ip=client_ip))

    def register(self, phone: str, email: str | None = None):
        request_body = {
            "parent_name": "Parent",
            "phone": phone,
            "password": "safe-password",
        }
        if email is not None:
            request_body["email"] = email

        status, payload = self.request("POST", "/api/family/register", request_body)
        self.assertEqual(status, 200, payload)
        return payload

    def add_child(self, account_id: str, token: str, name: str = "测试冒险家", age: int = 6):
        status, payload = self.request("POST", f"/api/family/accounts/{account_id}/children", {
            "name": name,
            "age": age,
            "avatar": "👦",
        }, token=token)
        self.assertEqual(status, 200, payload)
        return payload

    def test_account_requires_owner_and_never_exposes_hash(self):
        first = self.register("13800000001")
        second = self.register("13800000002")
        account_id = first["account"]["id"]

        status, _ = self.request("GET", f"/api/family/accounts/{account_id}")
        self.assertEqual(status, 401)

        status, payload = self.request("GET", f"/api/family/accounts/{account_id}", token=first["token"])
        self.assertEqual(status, 200)
        self.assertNotIn("password_hash", payload["account"])

        status, _ = self.request("GET", f"/api/family/accounts/{account_id}", token=second["token"])
        self.assertEqual(status, 403)

    def test_register_rejects_duplicate_phone_with_login_hint(self):
        self.register("13800000001")

        status, payload = self.request("POST", "/api/family/register", {
            "parent_name": "Another Parent",
            "phone": "13800000001",
            "password": "safe-password",
        })

        self.assertEqual(status, 400)
        self.assertEqual(payload["detail"], "手机号已注册，请登录")

    def test_register_rejects_email_already_bound_to_other_phone(self):
        self.register("13800000001", email="parent@example.com")

        status, payload = self.request("POST", "/api/family/register", {
            "parent_name": "Another Parent",
            "phone": "13800000002",
            "email": "parent@example.com",
            "password": "safe-password",
        })

        self.assertEqual(status, 400)
        self.assertEqual(payload["detail"], "该邮箱已被绑定，请更换邮箱")

    def test_duplicate_phone_takes_priority_over_register_rate_limit(self):
        client_ip = "127.0.0.9"
        self.request("POST", "/api/family/register", {
            "parent_name": "Parent",
            "phone": "13800000001",
            "password": "safe-password",
        }, client_ip=client_ip)

        for index in range(2, 6):
            status, payload = self.request("POST", "/api/family/register", {
                "parent_name": f"Parent {index}",
                "phone": f"1380000000{index}",
                "password": "safe-password",
            }, client_ip=client_ip)
            self.assertEqual(status, 200, payload)

        status, payload = self.request("POST", "/api/family/register", {
            "parent_name": "Another Parent",
            "phone": "13800000001",
            "password": "safe-password",
        }, client_ip=client_ip)
        self.assertEqual(status, 400)
        self.assertEqual(payload["detail"], "手机号已注册，请登录")

        status, payload = self.request("POST", "/api/family/register", {
            "parent_name": "Rate Limited Parent",
            "phone": "13800000006",
            "password": "safe-password",
        }, client_ip=client_ip)
        self.assertEqual(status, 429)
        self.assertEqual(payload["detail"], "注册过于频繁，请 1 小时后再试")

    def test_child_profile_gets_entry_code_and_can_access(self):
        parent = self.register("13800000021")
        account_id = parent["account"]["id"]
        child_payload = self.add_child(account_id, parent["token"], name="测试冒险家", age=6)
        child = child_payload["child"]

        self.assertRegex(child["entry_code"], r"^\d{6}$")

        status, payload = self.request("POST", "/api/family/child-access", {
            "name": "测试冒险家",
            "entry_code": child["entry_code"],
        })
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["account_id"], account_id)
        self.assertEqual(payload["child"]["id"], child["id"])
        self.assertNotIn("entry_code", payload["child"])

        status, payload = self.request("POST", "/api/family/child-access", {
            "name": "测试冒险家",
            "entry_code": "000000",
        })
        self.assertEqual(status, 401)
        self.assertEqual(payload["detail"], "孩子姓名或进入码不正确")

    def test_existing_child_without_entry_code_is_backfilled(self):
        account = FamilyAccount(
            id="family-1",
            parent_name="Parent",
            phone="13800000999",
            password_hash="hashed",
            children=[
                ChildProfile(id="child-1", name="旧孩子", age=6, avatar="👧", entry_code=None)
            ],
        )
        self.store.create_family_account(account)

        loaded = self.store.get_family_account("family-1")
        self.assertIsNotNone(loaded)
        self.assertRegex(loaded.children[0].entry_code or "", r"^\d{6}$")

    def test_parent_can_refresh_child_entry_code(self):
        parent = self.register("13800000025")
        account_id = parent["account"]["id"]
        child_payload = self.add_child(account_id, parent["token"], name="换码孩子", age=6)
        child = child_payload["child"]
        old_code = child["entry_code"]

        status, payload = self.request(
            "POST",
            f"/api/family/accounts/{account_id}/children/{child['id']}/entry-code",
            {},
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertRegex(payload["child"]["entry_code"], r"^\d{6}$")
        self.assertNotEqual(payload["child"]["entry_code"], old_code)

        status, access_payload = self.request("POST", "/api/family/child-access", {
            "name": "换码孩子",
            "entry_code": payload["child"]["entry_code"],
        })
        self.assertEqual(status, 200, access_payload)
        self.assertEqual(access_payload["child"]["id"], child["id"])

    def test_parent_can_delete_child_profile(self):
        parent = self.register("13800000026")
        account_id = parent["account"]["id"]
        first_child = self.add_child(account_id, parent["token"], name="要删除的孩子", age=6)["child"]
        second_child = self.add_child(account_id, parent["token"], name="保留的孩子", age=7)["child"]

        status, child_access = self.request("POST", "/api/family/child-access", {
            "name": "要删除的孩子",
            "entry_code": first_child["entry_code"],
        })
        self.assertEqual(status, 200, child_access)

        status, payload = self.request(
            "GET",
            f"/api/family/child-session/{first_child['id']}",
            token=child_access["sync_token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertTrue(payload["active"])

        status, payload = self.request(
            "DELETE",
            f"/api/family/accounts/{account_id}/children/{first_child['id']}",
            token=parent["token"],
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["deleted_child_id"], first_child["id"])
        self.assertEqual([child["id"] for child in payload["account"]["children"]], [second_child["id"]])

        status, payload = self.request(
            "GET",
            f"/api/family/accounts/{account_id}/children/{first_child['id']}",
            token=parent["token"],
        )
        self.assertEqual(status, 404)

        status, payload = self.request(
            "GET",
            f"/api/family/child-session/{first_child['id']}",
            token=child_access["sync_token"],
        )
        self.assertEqual(status, 404)
        self.assertEqual(payload["detail"], "未找到孩子档案")

        status, payload = self.request("POST", "/api/family/child-access", {
            "name": "要删除的孩子",
            "entry_code": first_child["entry_code"],
        })
        self.assertEqual(status, 401)
        self.assertEqual(payload["detail"], "孩子姓名或进入码不正确")

    def test_child_progress_sync_updates_parent_visible_snapshot(self):
        parent = self.register("13800000031")
        account_id = parent["account"]["id"]
        child_payload = self.add_child(account_id, parent["token"], name="同步孩子", age=7)
        child = child_payload["child"]

        status, payload = self.request("POST", "/api/family/child-access", {
            "name": "同步孩子",
            "entry_code": child["entry_code"],
        })
        self.assertEqual(status, 200, payload)
        self.assertIn("sync_token", payload)

        sync_progress = {
            "visits": {"panda": 2, "rabbit": 1},
            "questions": 3,
            "feedings": 1,
            "treatments": 2,
            "quizTotal": 4,
            "quizCorrect": 3,
            "stories": 2,
            "activities": [
                {"time": 1_720_051_200_000, "label": "第一天"},
                {"time": 1_720_137_600_000, "label": "第二天"}
            ]
        }

        status, payload = self.request("POST", "/api/family/child-progress/sync", {
            "child_id": child["id"],
            "progress": sync_progress,
            "creations_count": 2,
        }, token=payload["sync_token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["child"]["synced_progress"]["questions"], 3)
        self.assertEqual(payload["child"]["synced_creations_count"], 2)
        self.assertEqual(payload["child"]["questions_answered"], 4)
        self.assertEqual(payload["child"]["questions_correct"], 3)
        self.assertEqual(payload["child"]["stories_created"], 2)
        self.assertIsNotNone(payload["child"]["last_synced_at"])

        status, payload = self.request("GET", f"/api/family/accounts/{account_id}/children/{child['id']}", token=parent["token"])
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["child"]["synced_progress"]["visits"]["panda"], 2)
        self.assertEqual(payload["child"]["synced_creations_count"], 2)
        self.assertEqual(payload["child"]["current_streak"], 2)


if __name__ == "__main__":
    unittest.main()
