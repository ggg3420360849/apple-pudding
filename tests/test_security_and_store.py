import asyncio
import io
import os
import tempfile
import threading
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from app.database import ChildProfile, FamilyAccount, SessionStore
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    public_account,
    verify_password,
)
from app.uploads import save_upload_limited


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.settings = SimpleNamespace(auth_secret="test-secret-that-is-long-enough", auth_token_ttl_seconds=3600)

    def test_password_hash_and_legacy_migration(self):
        encoded = hash_password("correct horse battery staple")
        self.assertTrue(encoded.startswith("pbkdf2_sha256$"))
        self.assertEqual(verify_password("correct horse battery staple", encoded), (True, False))
        self.assertEqual(verify_password("wrong", encoded), (False, False))

        import hashlib
        legacy = hashlib.sha256(b"old-password").hexdigest()
        self.assertEqual(verify_password("old-password", legacy), (True, True))

    def test_signed_token_rejects_tampering(self):
        token = create_access_token("account-1", self.settings)
        self.assertEqual(decode_access_token(token, self.settings), "account-1")
        with self.assertRaises(HTTPException):
            decode_access_token(token[:-1] + ("a" if token[-1] != "a" else "b"), self.settings)

    def test_public_account_excludes_password_hash(self):
        account = FamilyAccount(id="a", parent_name="Parent", password_hash="secret")
        self.assertNotIn("password_hash", public_account(account))

    def test_upload_limit_is_enforced_while_streaming(self):
        upload = UploadFile(
            file=io.BytesIO(b"12345"),
            filename="sample.wav",
            headers=Headers({"content-type": "audio/wav"}),
        )
        with tempfile.NamedTemporaryFile(delete=False) as destination:
            path = destination.name
        try:
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(save_upload_limited(upload, path, max_bytes=4))
            self.assertEqual(raised.exception.status_code, 413)
        finally:
            os.unlink(path)


class SessionStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SessionStore(self.temp.name)
        self.account = FamilyAccount(id="a", parent_name="Parent")
        self.child = ChildProfile(id="c", name="Child")
        self.account.children.append(self.child)
        self.store.create_family_account(self.account)

    def tearDown(self):
        self.temp.cleanup()

    def test_streak_counts_days_not_actions(self):
        self.store.record_question_answer("a", "c", True)
        self.store.record_question_answer("a", "c", True)
        child = self.store.get_child_profile("a", "c")
        self.assertEqual(child.current_streak, 1)

        child.last_activity_date = datetime.now() - timedelta(days=1)
        self.store.update_child_profile("a", child)
        self.store.record_story_created("a", "c")
        child = self.store.get_child_profile("a", "c")
        self.assertEqual(child.current_streak, 2)

    def test_concurrent_updates_are_not_lost(self):
        workers = [threading.Thread(target=self.store.record_question_answer, args=("a", "c", True)) for _ in range(20)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        child = self.store.get_child_profile("a", "c")
        self.assertEqual(child.questions_answered, 20)
        self.assertEqual(child.questions_correct, 20)


if __name__ == "__main__":
    unittest.main()
