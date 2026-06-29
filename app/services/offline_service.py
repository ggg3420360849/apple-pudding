"""Offline queue service for syncing activities when back online"""
import json
import os
import tempfile
import threading
from functools import wraps
from pathlib import Path
from typing import List, Dict
from datetime import datetime

from app.logger import get_logger

logger = get_logger(__name__)


def synchronized(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return wrapper


class OfflineQueue:
    """Manage offline activity queue"""

    def __init__(self, queue_dir: str = "data/offline_queue"):
        self._lock = threading.RLock()
        self.queue_dir = Path(queue_dir)
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.queue_file = self.queue_dir / "activities.json"

        if not self.queue_file.exists():
            self._save_queue([])

    def _load_queue(self) -> List[Dict]:
        """Load queued activities"""
        try:
            with open(self.queue_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to load offline queue", error=str(e))
            return []

    def _save_queue(self, queue: List[Dict]):
        """Save queued activities"""
        try:
            fd, temporary_path = tempfile.mkstemp(prefix=".activities.", suffix=".tmp", dir=self.queue_dir)
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(queue, f, ensure_ascii=False, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary_path, self.queue_file)
        except Exception as e:
            logger.error("Failed to save offline queue", error=str(e))

    @synchronized
    def enqueue(self, activity: Dict) -> bool:
        """Add activity to offline queue"""
        try:
            queue = self._load_queue()
            activity['queued_at'] = datetime.now().isoformat()
            activity['synced'] = False
            queue.append(activity)
            self._save_queue(queue)

            logger.info("Activity queued for offline sync",
                       activity_type=activity.get('activity_type'))
            return True

        except Exception as e:
            logger.error("Failed to queue activity", error=str(e))
            return False

    @synchronized
    def get_pending(self) -> List[Dict]:
        """Get all pending (unsynced) activities"""
        queue = self._load_queue()
        return [item for item in queue if not item.get('synced', False)]

    @synchronized
    def mark_synced(self, activity_id: str, account_id: str) -> bool:
        """Mark activity as synced"""
        try:
            queue = self._load_queue()
            for item in queue:
                if item.get('id') == activity_id and item.get('account_id') == account_id:
                    item['synced'] = True
                    item['synced_at'] = datetime.now().isoformat()

            self._save_queue(queue)
            logger.info("Activity marked as synced", activity_id=activity_id)
            return True

        except Exception as e:
            logger.error("Failed to mark activity as synced", error=str(e))
            return False

    @synchronized
    def clear_synced(self, account_id: str) -> int:
        """Remove all synced activities from queue"""
        try:
            queue = self._load_queue()
            pending = [
                item for item in queue
                if item.get('account_id') != account_id or not item.get('synced', False)
            ]
            removed_count = len(queue) - len(pending)

            self._save_queue(pending)
            logger.info("Cleared synced activities", count=removed_count)
            return removed_count

        except Exception as e:
            logger.error("Failed to clear synced activities", error=str(e))
            return 0

    @synchronized
    def get_stats(self, account_id: str) -> Dict:
        """Get queue statistics"""
        queue = self._load_queue()
        queue = [item for item in queue if item.get('account_id') == account_id]
        pending = [item for item in queue if not item.get('synced', False)]
        synced = [item for item in queue if item.get('synced', False)]

        return {
            "total": len(queue),
            "pending": len(pending),
            "synced": len(synced)
        }


# Global instance
_offline_queue: OfflineQueue = None


def get_offline_queue() -> OfflineQueue:
    """Get or create offline queue instance"""
    global _offline_queue
    if _offline_queue is None:
        _offline_queue = OfflineQueue()
    return _offline_queue
