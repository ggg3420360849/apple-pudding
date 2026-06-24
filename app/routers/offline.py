"""Offline sync API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import List

from app.services.offline_service import get_offline_queue, OfflineQueue
from app.database import get_session_store, SessionStore
from app.schemas import RecordActivityRequest
from app.logger import get_logger

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/offline")


@router.post("/sync")
@limiter.limit("100/hour")
async def sync_offline_activities(
    request: Request,
    activities: List[RecordActivityRequest],
    store: SessionStore = Depends(get_session_store),
    queue: OfflineQueue = Depends(get_offline_queue)
) -> dict:
    """Sync offline activities to server"""
    try:
        synced_count = 0
        failed_count = 0

        for activity_req in activities:
            try:
                success = False

                if activity_req.activity_type == "animal_explored":
                    animal = activity_req.data.get("animal")
                    if animal:
                        success = store.record_animal_explored(
                            activity_req.account_id,
                            activity_req.child_id,
                            animal
                        )

                elif activity_req.activity_type == "question_answered":
                    correct = activity_req.data.get("correct", False)
                    success = store.record_question_answer(
                        activity_req.account_id,
                        activity_req.child_id,
                        correct
                    )

                elif activity_req.activity_type == "story_created":
                    success = store.record_story_created(
                        activity_req.account_id,
                        activity_req.child_id
                    )

                if success:
                    synced_count += 1
                    # Mark as synced if it has an ID
                    if hasattr(activity_req, 'id'):
                        queue.mark_synced(activity_req.id)
                else:
                    failed_count += 1

            except Exception as e:
                logger.error("Failed to sync activity",
                           activity_type=activity_req.activity_type,
                           error=str(e))
                failed_count += 1

        logger.info("Offline sync completed",
                   synced=synced_count,
                   failed=failed_count)

        return {
            "success": True,
            "synced": synced_count,
            "failed": failed_count
        }

    except Exception as e:
        logger.error("Offline sync failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/stats")
def get_queue_stats(
    queue: OfflineQueue = Depends(get_offline_queue)
) -> dict:
    """Get offline queue statistics"""
    stats = queue.get_stats()
    return {
        "success": True,
        "stats": stats
    }


@router.post("/queue/clear")
@limiter.limit("10/hour")
async def clear_synced_queue(
    request: Request,
    queue: OfflineQueue = Depends(get_offline_queue)
) -> dict:
    """Clear synced activities from queue"""
    try:
        removed = queue.clear_synced()
        logger.info("Cleared synced queue", removed_count=removed)

        return {
            "success": True,
            "removed": removed
        }

    except Exception as e:
        logger.error("Failed to clear queue", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
