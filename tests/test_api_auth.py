import asyncio
import json
import tempfile
import unittest

from app.config import Settings, get_settings
from app.database import SessionStore, get_session_store
from app.main import app


async def asgi_request(method: str, path: str, body=None, headers=None):
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
        "client": ("127.0.0.1", 12345),
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
        app.dependency_overrides[get_session_store] = lambda: self.store
        app.dependency_overrides[get_settings] = lambda: self.settings

    def tearDown(self):
        app.dependency_overrides.clear()
        self.temp.cleanup()

    def request(self, method, path, body=None, token=None):
        headers = {"authorization": f"Bearer {token}"} if token else None
        return asyncio.run(asgi_request(method, path, body, headers))

    def register(self, phone: str):
        status, payload = self.request("POST", "/api/family/register", {
            "parent_name": "Parent",
            "phone": phone,
            "password": "safe-password",
        })
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


if __name__ == "__main__":
    unittest.main()
