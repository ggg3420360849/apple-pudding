from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)
    animal: str | None = None
    model: str | None = None
    mode: str | None = "qa"
    # Family account context
    account_id: str | None = None
    child_id: str | None = None


class CreateFamilyAccountRequest(BaseModel):
    parent_name: str = Field(min_length=1, max_length=80)
    phone: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class CreateChildProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    avatar: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=1, le=18)


class ChildAccessRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    entry_code: str = Field(min_length=4, max_length=20)


class ChildProgressSyncRequest(BaseModel):
    child_id: str = Field(min_length=1, max_length=80)
    progress: dict = Field(default_factory=dict)
    creations_count: int = Field(default=0, ge=0, le=10_000)


class CreateWeeklyGoalRequest(BaseModel):
    child_id: str
    goal_type: str  # "explore_animals", "answer_questions", "create_stories"
    target: int = Field(ge=1, le=10_000)


class RecordActivityRequest(BaseModel):
    id: Optional[str] = Field(default=None, min_length=1, max_length=200)
    account_id: str
    child_id: str
    activity_type: str  # "animal_explored", "question_answered", "story_created"
    data: dict = Field(default_factory=dict)
    timestamp: Optional[int] = Field(default=None, ge=0)


class ShareCardRequest(BaseModel):
    account_id: str
    child_id: str
    content_type: str  # "imagined_animal", "story"
    content_id: str
