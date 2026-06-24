"""Achievement and badge system"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.database import SessionStore, get_session_store
from app.logger import get_logger

logger = get_logger(__name__)


class Achievement:
    """Achievement definition"""

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        icon: str,
        requirement_type: str,
        requirement_value: int,
        tier: str = "bronze"  # bronze, silver, gold, platinum
    ):
        self.id = id
        self.name = name
        self.description = description
        self.icon = icon
        self.requirement_type = requirement_type
        self.requirement_value = requirement_value
        self.tier = tier


class AchievementService:
    """Service for managing achievements and badges"""

    def __init__(self):
        self.achievements = self._initialize_achievements()

    def _initialize_achievements(self) -> Dict[str, Achievement]:
        """Initialize predefined achievements"""
        return {
            # Animal exploration achievements
            "explorer_beginner": Achievement(
                id="explorer_beginner",
                name="动物探索者",
                description="探索3种不同的动物",
                icon="🔍",
                requirement_type="animals_explored",
                requirement_value=3,
                tier="bronze"
            ),
            "explorer_advanced": Achievement(
                id="explorer_advanced",
                name="动物专家",
                description="探索10种不同的动物",
                icon="🎓",
                requirement_type="animals_explored",
                requirement_value=10,
                tier="silver"
            ),
            "explorer_master": Achievement(
                id="explorer_master",
                name="动物大师",
                description="探索25种不同的动物",
                icon="👑",
                requirement_type="animals_explored",
                requirement_value=25,
                tier="gold"
            ),

            # Question answering achievements
            "scholar_beginner": Achievement(
                id="scholar_beginner",
                name="知识新星",
                description="正确回答10道问题",
                icon="⭐",
                requirement_type="questions_correct",
                requirement_value=10,
                tier="bronze"
            ),
            "scholar_advanced": Achievement(
                id="scholar_advanced",
                name="智慧之星",
                description="正确回答50道问题",
                icon="🌟",
                requirement_type="questions_correct",
                requirement_value=50,
                tier="silver"
            ),
            "scholar_master": Achievement(
                id="scholar_master",
                name="天才少年",
                description="正确回答100道问题",
                icon="💫",
                requirement_type="questions_correct",
                requirement_value=100,
                tier="gold"
            ),

            # Story creation achievements
            "storyteller_beginner": Achievement(
                id="storyteller_beginner",
                name="小小作家",
                description="创作5个故事",
                icon="📝",
                requirement_type="stories_created",
                requirement_value=5,
                tier="bronze"
            ),
            "storyteller_advanced": Achievement(
                id="storyteller_advanced",
                name="故事大师",
                description="创作20个故事",
                icon="📚",
                requirement_type="stories_created",
                requirement_value=20,
                tier="silver"
            ),

            # Streak achievements
            "consistent_learner": Achievement(
                id="consistent_learner",
                name="坚持学习",
                description="连续学习7天",
                icon="🔥",
                requirement_type="current_streak",
                requirement_value=7,
                tier="silver"
            ),
            "dedication_master": Achievement(
                id="dedication_master",
                name="学习之光",
                description="连续学习30天",
                icon="💎",
                requirement_type="current_streak",
                requirement_value=30,
                tier="gold"
            ),

            # Imagination achievements
            "creative_mind": Achievement(
                id="creative_mind",
                name="想象力大师",
                description="创造10个想象动物",
                icon="🎨",
                requirement_type="imagined_animals",
                requirement_value=10,
                tier="gold"
            ),

            # Accuracy achievements
            "perfectionist": Achievement(
                id="perfectionist",
                name="完美主义者",
                description="答题正确率达到90%（至少回答20题）",
                icon="🎯",
                requirement_type="accuracy",
                requirement_value=90,
                tier="platinum"
            )
        }

    def check_achievements(
        self,
        account_id: str,
        child_id: str,
        store: SessionStore
    ) -> List[str]:
        """Check and award new achievements for a child"""
        child = store.get_child_profile(account_id, child_id)
        if not child:
            return []

        newly_earned = []

        for achievement_id, achievement in self.achievements.items():
            # Skip if already earned
            if achievement_id in child.badges:
                continue

            # Check if requirement is met
            if self._check_requirement(child, achievement):
                success = store.award_badge(account_id, child_id, achievement_id)
                if success:
                    newly_earned.append(achievement_id)
                    logger.info("Achievement unlocked",
                              child_id=child_id,
                              achievement=achievement.name)

        return newly_earned

    def _check_requirement(self, child, achievement: Achievement) -> bool:
        """Check if child meets achievement requirement"""
        if achievement.requirement_type == "animals_explored":
            return len(child.animals_explored) >= achievement.requirement_value

        elif achievement.requirement_type == "questions_correct":
            return child.questions_correct >= achievement.requirement_value

        elif achievement.requirement_type == "stories_created":
            return child.stories_created >= achievement.requirement_value

        elif achievement.requirement_type == "current_streak":
            return child.current_streak >= achievement.requirement_value

        elif achievement.requirement_type == "imagined_animals":
            return len(child.imagined_animals) >= achievement.requirement_value

        elif achievement.requirement_type == "accuracy":
            if child.questions_answered < 20:
                return False
            accuracy = (child.questions_correct / child.questions_answered) * 100
            return accuracy >= achievement.requirement_value

        return False

    def get_achievement_info(self, achievement_id: str) -> Optional[Achievement]:
        """Get achievement details"""
        return self.achievements.get(achievement_id)

    def get_all_achievements(self) -> List[Dict]:
        """Get all available achievements"""
        return [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "tier": a.tier,
                "requirement_type": a.requirement_type,
                "requirement_value": a.requirement_value
            }
            for a in self.achievements.values()
        ]

    def get_child_progress(
        self,
        account_id: str,
        child_id: str,
        store: SessionStore
    ) -> Dict:
        """Get child's achievement progress"""
        child = store.get_child_profile(account_id, child_id)
        if not child:
            return {}

        progress = {
            "earned_badges": child.badges,
            "total_achievements": len(self.achievements),
            "completion_percentage": (len(child.badges) / len(self.achievements)) * 100,
            "progress_by_achievement": {}
        }

        for achievement_id, achievement in self.achievements.items():
            current = 0

            if achievement.requirement_type == "animals_explored":
                current = len(child.animals_explored)
            elif achievement.requirement_type == "questions_correct":
                current = child.questions_correct
            elif achievement.requirement_type == "stories_created":
                current = child.stories_created
            elif achievement.requirement_type == "current_streak":
                current = child.current_streak
            elif achievement.requirement_type == "imagined_animals":
                current = len(child.imagined_animals)
            elif achievement.requirement_type == "accuracy":
                if child.questions_answered > 0:
                    current = (child.questions_correct / child.questions_answered) * 100
                else:
                    current = 0

            progress["progress_by_achievement"][achievement_id] = {
                "name": achievement.name,
                "current": current,
                "target": achievement.requirement_value,
                "percentage": min(100, (current / achievement.requirement_value) * 100),
                "earned": achievement_id in child.badges
            }

        return progress


class CalendarService:
    """Service for managing learning calendar and daily tasks"""

    def get_weekly_calendar(
        self,
        account_id: str,
        child_id: str,
        store: SessionStore
    ) -> Dict:
        """Get child's weekly activity calendar"""
        goals = store.get_child_weekly_goals(child_id)
        child = store.get_child_profile(account_id, child_id)

        if not child:
            return {}

        # Get current week dates
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday())
        week_days = [week_start + timedelta(days=i) for i in range(7)]

        calendar = {
            "week_start": week_start.isoformat(),
            "days": [],
            "goals": []
        }

        # Add daily data
        for day in week_days:
            day_data = {
                "date": day.date().isoformat(),
                "has_activity": False,
                "is_today": day.date() == today.date()
            }

            # Check if there was activity on this day
            if child.last_activity_date:
                day_data["has_activity"] = child.last_activity_date.date() == day.date()

            calendar["days"].append(day_data)

        # Add goals
        for goal in goals:
            goal_data = goal.model_dump(mode='json')
            goal_data["percentage"] = min(
                100,
                (goal.current_progress / goal.target) * 100 if goal.target > 0 else 0
            )
            calendar["goals"].append(goal_data)

        return calendar


# Global instances
_achievement_service: Optional[AchievementService] = None
_calendar_service: Optional[CalendarService] = None


def get_achievement_service() -> AchievementService:
    """Get or create achievement service instance"""
    global _achievement_service
    if _achievement_service is None:
        _achievement_service = AchievementService()
    return _achievement_service


def get_calendar_service() -> CalendarService:
    """Get or create calendar service instance"""
    global _calendar_service
    if _calendar_service is None:
        _calendar_service = CalendarService()
    return _calendar_service
