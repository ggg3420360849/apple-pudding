"""Achievement and calendar API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_session_store, SessionStore
from app.services.achievement_service import (
    get_achievement_service,
    get_calendar_service,
    AchievementService,
    CalendarService
)
from app.logger import get_logger

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/achievements")


@router.get("/all")
def get_all_achievements(
    achievement_service: AchievementService = Depends(get_achievement_service)
) -> dict:
    """Get all available achievements"""
    achievements = achievement_service.get_all_achievements()
    return {
        "success": True,
        "achievements": achievements
    }


@router.get("/progress/{account_id}/{child_id}")
def get_achievement_progress(
    account_id: str,
    child_id: str,
    store: SessionStore = Depends(get_session_store),
    achievement_service: AchievementService = Depends(get_achievement_service)
) -> dict:
    """Get child's achievement progress"""
    progress = achievement_service.get_child_progress(account_id, child_id, store)

    if not progress:
        raise HTTPException(status_code=404, detail="Child not found")

    return {
        "success": True,
        "progress": progress
    }


@router.post("/check/{account_id}/{child_id}")
@limiter.limit("60/hour")
async def check_new_achievements(
    request: Request,
    account_id: str,
    child_id: str,
    store: SessionStore = Depends(get_session_store),
    achievement_service: AchievementService = Depends(get_achievement_service)
) -> dict:
    """Check and award new achievements"""
    try:
        newly_earned = achievement_service.check_achievements(
            account_id,
            child_id,
            store
        )

        # Get achievement details for newly earned
        new_achievements = []
        for achievement_id in newly_earned:
            achievement = achievement_service.get_achievement_info(achievement_id)
            if achievement:
                new_achievements.append({
                    "id": achievement.id,
                    "name": achievement.name,
                    "description": achievement.description,
                    "icon": achievement.icon,
                    "tier": achievement.tier
                })

        logger.info("Achievement check completed",
                   account_id=account_id,
                   child_id=child_id,
                   newly_earned=len(newly_earned))

        return {
            "success": True,
            "newly_earned": new_achievements,
            "count": len(newly_earned)
        }

    except Exception as e:
        logger.error("Failed to check achievements", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calendar/{account_id}/{child_id}")
def get_weekly_calendar(
    account_id: str,
    child_id: str,
    store: SessionStore = Depends(get_session_store),
    calendar_service: CalendarService = Depends(get_calendar_service)
) -> dict:
    """Get child's weekly learning calendar"""
    calendar = calendar_service.get_weekly_calendar(account_id, child_id, store)

    if not calendar:
        raise HTTPException(status_code=404, detail="Child not found")

    return {
        "success": True,
        "calendar": calendar
    }


@router.get("/leaderboard/{account_id}")
def get_family_leaderboard(
    account_id: str,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Get family leaderboard comparing all children"""
    account = store.get_family_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    leaderboard = []
    for child in account.children:
        leaderboard.append({
            "child_id": child.id,
            "name": child.name,
            "avatar": child.avatar,
            "total_badges": len(child.badges),
            "animals_explored": len(child.animals_explored),
            "questions_correct": child.questions_correct,
            "stories_created": child.stories_created,
            "current_streak": child.current_streak,
            "accuracy": (
                (child.questions_correct / child.questions_answered * 100)
                if child.questions_answered > 0 else 0
            )
        })

    # Sort by total badges (primary), then by current streak (secondary)
    leaderboard.sort(
        key=lambda x: (x["total_badges"], x["current_streak"]),
        reverse=True
    )

    return {
        "success": True,
        "leaderboard": leaderboard
    }
