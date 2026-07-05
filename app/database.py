"""Database models and connection for Apple Pudding Animal Park"""
from typing import Optional, List
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
import json
import os
import secrets
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
    entry_code: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    synced_progress: dict = Field(default_factory=dict)
    synced_creations_count: int = 0
    last_synced_at: Optional[datetime] = None

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

    def _collect_child_entry_codes(self, accounts: dict) -> set[str]:
        return {
            child_data["entry_code"]
            for account_data in accounts.values()
            for child_data in account_data.get("children", [])
            if child_data.get("entry_code")
        }

    def _generate_child_entry_code(self, used_codes: set[str]) -> str:
        while True:
            code = "".join(secrets.choice("0123456789") for _ in range(6))
            if code not in used_codes:
                return code

    def _ensure_child_entry_codes(self, accounts: dict) -> bool:
        used_codes = self._collect_child_entry_codes(accounts)
        changed = False

        for account_data in accounts.values():
            for child_data in account_data.get("children", []):
                if not child_data.get("entry_code"):
                    code = self._generate_child_entry_code(used_codes)
                    child_data["entry_code"] = code
                    used_codes.add(code)
                    changed = True

        return changed

    @synchronized
    def create_child_entry_code(self) -> str:
        accounts = self._load_accounts()
        used_codes = self._collect_child_entry_codes(accounts)
        return self._generate_child_entry_code(used_codes)

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
        if self._ensure_child_entry_codes(accounts):
            self._save_accounts(accounts)
        if account_id in accounts:
            return FamilyAccount(**accounts[account_id])
        return None

    @synchronized
    def get_family_account_by_phone(self, phone: str) -> Optional[FamilyAccount]:
        """Get family account by phone number"""
        accounts = self._load_accounts()
        if self._ensure_child_entry_codes(accounts):
            self._save_accounts(accounts)
        for account_data in accounts.values():
            if account_data.get('phone') == phone:
                return FamilyAccount(**account_data)
        return None

    @synchronized
    def get_family_account_by_email(self, email: str) -> Optional[FamilyAccount]:
        """Get family account by email"""
        accounts = self._load_accounts()
        if self._ensure_child_entry_codes(accounts):
            self._save_accounts(accounts)
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
    def find_child_by_name_and_entry_code(self, name: str, entry_code: str) -> Optional[tuple[FamilyAccount, ChildProfile]]:
        """Find a child profile by child name and entry code."""
        accounts = self._load_accounts()
        if self._ensure_child_entry_codes(accounts):
            self._save_accounts(accounts)

        for account_data in accounts.values():
            for child_data in account_data.get("children", []):
                if child_data.get("name") == name and child_data.get("entry_code") == entry_code:
                    return FamilyAccount(**account_data), ChildProfile(**child_data)
        return None

    @synchronized
    def sync_child_progress(self, account_id: str, child_id: str, progress: dict, creations_count: int = 0) -> Optional[ChildProfile]:
        """Persist a child's synced progress snapshot."""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return None

        progress = progress if isinstance(progress, dict) else {}
        existing_progress = child.synced_progress if isinstance(child.synced_progress, dict) else {}
        merged_progress = self._merge_progress_snapshots(existing_progress, progress)

        visits = merged_progress.get("visits", {}) if isinstance(merged_progress, dict) else {}
        child.animals_explored = [animal_id for animal_id, count in visits.items() if count]
        child.questions_answered = max(child.questions_answered, int(merged_progress.get("quizTotal", 0) or 0))
        child.questions_correct = max(child.questions_correct, int(merged_progress.get("quizCorrect", 0) or 0))
        child.stories_created = max(child.stories_created, int(merged_progress.get("stories", 0) or 0))
        child.synced_progress = merged_progress
        child.synced_creations_count = max(child.synced_creations_count, creations_count)
        child.last_synced_at = datetime.now()

        activities = child.synced_progress.get("activities", []) if isinstance(child.synced_progress, dict) else []
        activity_dates = sorted({
            datetime.fromtimestamp(item["time"] / 1000).date()
            for item in activities
            if isinstance(item, dict) and isinstance(item.get("time"), (int, float))
        })

        if activity_dates:
            child.last_activity_date = datetime.combine(activity_dates[-1], datetime.min.time())
            streak = 1
            longest = 1
            for previous, current in zip(activity_dates, activity_dates[1:]):
                if (current - previous).days == 1:
                    streak += 1
                    longest = max(longest, streak)
                elif (current - previous).days > 1:
                    streak = 1
            child.longest_streak = max(child.longest_streak, longest)

            current_streak = 1
            for index in range(len(activity_dates) - 1, 0, -1):
                if (activity_dates[index] - activity_dates[index - 1]).days == 1:
                    current_streak += 1
                else:
                    break
            child.current_streak = current_streak

        self.update_child_profile(account_id, child)
        return child

    @staticmethod
    def _merge_progress_snapshots(existing: dict, incoming: dict) -> dict:
        """Merge progress snapshots without letting stale local sessions erase newer data."""
        existing = existing if isinstance(existing, dict) else {}
        incoming = incoming if isinstance(incoming, dict) else {}
        merged = {**existing, **incoming}

        visits = {}
        for source in (existing.get("visits", {}), incoming.get("visits", {})):
            if not isinstance(source, dict):
                continue
            for animal_id, count in source.items():
                try:
                    visits[animal_id] = max(int(visits.get(animal_id, 0) or 0), int(count or 0))
                except (TypeError, ValueError):
                    visits[animal_id] = visits.get(animal_id, count) or count
        merged["visits"] = visits

        counter_keys = [
            "questions",
            "doctorChecks",
            "feedings",
            "treatments",
            "quizCorrect",
            "quizTotal",
            "stories",
            "creations",
            "totalChats",
            "totalQuestions",
            "totalQuizPassed",
            "totalStories",
            "storiesCompleted",
        ]
        for key in counter_keys:
            try:
                merged[key] = max(int(existing.get(key, 0) or 0), int(incoming.get(key, 0) or 0))
            except (TypeError, ValueError):
                merged[key] = incoming.get(key, existing.get(key, 0))

        unique_animals = []
        for source in (existing.get("uniqueAnimalsInteracted", []), incoming.get("uniqueAnimalsInteracted", [])):
            if not isinstance(source, list):
                continue
            for animal_id in source:
                if animal_id not in unique_animals:
                    unique_animals.append(animal_id)
        merged["uniqueAnimalsInteracted"] = unique_animals

        activity_by_key = {}
        for source in (existing.get("activities", []), incoming.get("activities", [])):
            if not isinstance(source, list):
                continue
            for item in source:
                if not isinstance(item, dict):
                    continue
                key = (
                    item.get("time"),
                    item.get("type"),
                    item.get("label"),
                    item.get("animalId"),
                )
                activity_by_key[key] = item

        merged["activities"] = sorted(
            activity_by_key.values(),
            key=lambda item: item.get("time", 0) if isinstance(item.get("time"), (int, float)) else 0,
            reverse=True,
        )[:1000]

        return merged

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

    @synchronized
    def delete_child_profile(self, account_id: str, child_id: str) -> Optional[FamilyAccount]:
        """Delete a child profile from a family account."""
        account = self.get_family_account(account_id)
        if not account:
            return None

        remaining_children = [child for child in account.children if child.id != child_id]
        if len(remaining_children) == len(account.children):
            return None

        account.children = remaining_children
        updated_account = self.update_family_account(account)

        goals = self._load_goals()
        remaining_goals = {
            goal_id: goal_data
            for goal_id, goal_data in goals.items()
            if goal_data.get("child_id") != child_id
        }
        if len(remaining_goals) != len(goals):
            self._save_goals(remaining_goals)

        return updated_account

    @synchronized
    def refresh_child_entry_code(self, account_id: str, child_id: str) -> Optional[ChildProfile]:
        """Generate and persist a new unique entry code for a child profile."""
        child = self.get_child_profile(account_id, child_id)
        if not child:
            return None

        child.entry_code = self.create_child_entry_code()
        updated = self.update_child_profile(account_id, child)
        if not updated:
            return None
        return child

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
