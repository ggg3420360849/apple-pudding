"""Database models and connection for Apple Pudding Animal Park"""
from typing import Optional, List
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
import json
import os
import tempfile
import threading
from functools import wraps
from pathlib import Path


def synchronized(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return wrapper


class UserRole(str, Enum):
    PARENT = "parent"
    CHILD = "child"


class ChildProfile(BaseModel):
    """Child profile within a family account"""
    id: str
    name: str
    avatar: Optional[str] = None
    age: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.now)

    # Learning progress
    animals_explored: List[str] = Field(default_factory=list)
    questions_answered: int = 0
    questions_correct: int = 0
    stories_created: int = 0
    imagined_animals: List[dict] = Field(default_factory=list)

    # Achievements
    badges: List[str] = Field(default_factory=list)
    current_streak: int = 0
    longest_streak: int = 0
    last_activity_date: Optional[datetime] = None


class WeeklyGoal(BaseModel):
    """Weekly learning goal"""
    id: str
    child_id: str
    week_start: datetime
    goal_type: str  # "explore_animals", "answer_questions", "create_stories"
    target: int
    current_progress: int = 0
    completed: bool = False


class FamilyAccount(BaseModel):
    """Parent/Family account with multiple children"""
    id: str
    parent_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    children: List[ChildProfile] = Field(default_factory=list)


class SessionStore:
    """File-based session storage for family accounts"""

    def __init__(self, storage_dir: str = "data"):
        self._lock = threading.RLock()
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self.accounts_file = self.storage_dir / "family_accounts.json"
        self.goals_file = self.storage_dir / "weekly_goals.json"

        # Initialize files if they don't exist
        if not self.accounts_file.exists():
            self._save_accounts({})
        if not self.goals_file.exists():
            self._save_goals({})

    def _load_accounts(self) -> dict:
        """Load all family accounts"""
        with open(self.accounts_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_accounts(self, accounts: dict):
        """Save all family accounts"""
        self._atomic_json_write(self.accounts_file, accounts)

    def _load_goals(self) -> dict:
        """Load all weekly goals"""
        with open(self.goals_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_goals(self, goals: dict):
        """Save all weekly goals"""
        self._atomic_json_write(self.goals_file, goals)

    def _atomic_json_write(self, path: Path, value) -> None:
        fd, temporary_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(value, handle, ensure_ascii=False, indent=2, default=str)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, path)
        except Exception:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass
            raise

    # Family Account Operations
    @synchronized
    def create_family_account(self, account: FamilyAccount) -> FamilyAccount:
        """Create a new family account"""
        accounts = self._load_accounts()
        accounts[account.id] = account.model_dump(mode='json')
        self._save_accounts(accounts)
        return account

    @synchronized
    def get_family_account(self, account_id: str) -> Optional[FamilyAccount]:
        """Get family account by ID"""
        accounts = self._load_accounts()
        if account_id in accounts:
            return FamilyAccount(**accounts[account_id])
        return None

    @synchronized
    def get_family_account_by_phone(self, phone: str) -> Optional[FamilyAccount]:
        """Get family account by phone number"""
        accounts = self._load_accounts()
        for account_data in accounts.values():
            if account_data.get('phone') == phone:
                return FamilyAccount(**account_data)
        return None

    @synchronized
    def get_family_account_by_email(self, email: str) -> Optional[FamilyAccount]:
        """Get family account by email"""
        accounts = self._load_accounts()
        for account_data in accounts.values():
            if account_data.get('email') == email:
                return FamilyAccount(**account_data)
        return None

    @synchronized
    def update_family_account(self, account: FamilyAccount) -> FamilyAccount:
        """Update family account"""
        accounts = self._load_accounts()
        accounts[account.id] = account.model_dump(mode='json')
        self._save_accounts(accounts)
        return account

    # Child Profile Operations
    @synchronized
    def add_child_profile(self, account_id: str, child: ChildProfile) -> Optional[FamilyAccount]:
        """Add a child profile to family account"""
        account = self.get_family_account(account_id)
        if not account:
            return None

        account.children.append(child)
        return self.update_family_account(account)

    @synchronized
    def get_child_profile(self, account_id: str, child_id: str) -> Optional[ChildProfile]:
        """Get specific child profile"""
        account = self.get_family_account(account_id)
        if not account:
            return None

        for child in account.children:
            if child.id == child_id:
                return child
        return None

    @synchronized
    def update_child_profile(self, account_id: str, child: ChildProfile) -> Optional[FamilyAccount]:
        """Update child profile"""
        account = self.get_family_account(account_id)
        if not account:
            return None

        for i, c in enumerate(account.children):
            if c.id == child.id:
                account.children[i] = child
                return self.update_family_account(account)
        return None

    # Learning Progress Operations
    @synchronized
    def record_animal_explored(self, account_id: str, child_id: str, animal: str) -> bool:
        """Record that a child explored an animal"""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return False

        if animal not in child.animals_explored:
            previous_activity_date = child.last_activity_date
            child.animals_explored.append(animal)
            child.last_activity_date = datetime.now()
            self._update_streak(child, previous_activity_date)
            self.update_child_profile(account_id, child)
        return True

    @synchronized
    def record_question_answer(self, account_id: str, child_id: str, correct: bool) -> bool:
        """Record a question answer"""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return False

        previous_activity_date = child.last_activity_date
        child.questions_answered += 1
        if correct:
            child.questions_correct += 1
        child.last_activity_date = datetime.now()
        self._update_streak(child, previous_activity_date)
        self.update_child_profile(account_id, child)
        return True

    @synchronized
    def record_story_created(self, account_id: str, child_id: str) -> bool:
        """Record that a child created a story"""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return False

        previous_activity_date = child.last_activity_date
        child.stories_created += 1
        child.last_activity_date = datetime.now()
        self._update_streak(child, previous_activity_date)
        self.update_child_profile(account_id, child)
        return True

    @synchronized
    def add_imagined_animal(self, account_id: str, child_id: str, animal_data: dict) -> bool:
        """Add an imagined animal to child's collection"""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return False

        animal_data['created_at'] = datetime.now().isoformat()
        child.imagined_animals.append(animal_data)
        self.update_child_profile(account_id, child)
        return True

    def _update_streak(self, child: ChildProfile, previous_activity_date: Optional[datetime]):
        """Update child's learning streak"""
        if not child.last_activity_date:
            return
        if previous_activity_date is None:
            child.current_streak = 1
        else:
            days = (child.last_activity_date.date() - previous_activity_date.date()).days
            if days == 1:
                child.current_streak = max(1, child.current_streak + 1)
            elif days > 1:
                child.current_streak = 1
            # days == 0: another activity today, streak stays unchanged.
        child.longest_streak = max(child.longest_streak, child.current_streak)

    # Weekly Goals Operations
    @synchronized
    def create_weekly_goal(self, goal: WeeklyGoal) -> WeeklyGoal:
        """Create a weekly goal for a child"""
        goals = self._load_goals()
        goals[goal.id] = goal.model_dump(mode='json')
        self._save_goals(goals)
        return goal

    @synchronized
    def get_child_weekly_goals(self, child_id: str) -> List[WeeklyGoal]:
        """Get all weekly goals for a child"""
        goals = self._load_goals()
        child_goals = []
        for goal_data in goals.values():
            if goal_data['child_id'] == child_id:
                child_goals.append(WeeklyGoal(**goal_data))
        return child_goals

    @synchronized
    def update_goal_progress(self, goal_id: str, progress: int) -> Optional[WeeklyGoal]:
        """Update progress on a weekly goal"""
        goals = self._load_goals()
        if goal_id not in goals:
            return None

        goal = WeeklyGoal(**goals[goal_id])
        goal.current_progress = progress
        if goal.current_progress >= goal.target:
            goal.completed = True

        goals[goal_id] = goal.model_dump(mode='json')
        self._save_goals(goals)
        return goal

    # Badge/Achievement Operations
    @synchronized
    def award_badge(self, account_id: str, child_id: str, badge_name: str) -> bool:
        """Award a badge to a child"""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return False

        if badge_name not in child.badges:
            child.badges.append(badge_name)
            self.update_child_profile(account_id, child)
        return True

    @synchronized
    def get_comparison_report(self, account_id: str) -> dict:
        """Generate comparison report for all children in family"""
        account = self.get_family_account(account_id)
        if not account:
            return {}

        report = {
            "family_id": account_id,
            "parent_name": account.parent_name,
            "children": []
        }

        for child in account.children:
            report["children"].append({
                "id": child.id,
                "name": child.name,
                "animals_explored": len(child.animals_explored),
                "questions_answered": child.questions_answered,
                "questions_correct": child.questions_correct,
                "accuracy": child.questions_correct / child.questions_answered if child.questions_answered > 0 else 0,
                "stories_created": child.stories_created,
                "badges": len(child.badges),
                "current_streak": child.current_streak,
                "longest_streak": child.longest_streak
            })

        return report


# Global session store instance
_session_store: Optional[SessionStore] = None


def get_session_store() -> SessionStore:
    """Get or create the global session store instance"""
    global _session_store
    if _session_store is None:
        _session_store = SessionStore()
    return _session_store
