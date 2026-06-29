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


class CreateWeeklyGoalRequest(BaseModel):
    child_id: str
    goal_type: str  # "explore_animals", "answer_questions", "create_stories"
    target: int = Field(ge=1, le=10_000)


class RecordActivityRequest(BaseModel):
    account_id: str
    child_id: str
    activity_type: str  # "animal_explored", "question_answered", "story_created"
    data: dict = Field(default_factory=dict)


class ShareCardRequest(BaseModel):
    account_id: str
    child_id: str
    content_type: str  # "imagined_animal", "story"
    content_id: str
