from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    animal: str | None = None
    model: str | None = None
    mode: str | None = "qa"
    # Family account context
    account_id: str | None = None
    child_id: str | None = None


class CreateFamilyAccountRequest(BaseModel):
    parent_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class CreateChildProfileRequest(BaseModel):
    name: str
    avatar: Optional[str] = None
    age: Optional[int] = None


class CreateWeeklyGoalRequest(BaseModel):
    child_id: str
    goal_type: str  # "explore_animals", "answer_questions", "create_stories"
    target: int


class RecordActivityRequest(BaseModel):
    account_id: str
    child_id: str
    activity_type: str  # "animal_explored", "question_answered", "story_created"
    data: dict = {}


class ShareCardRequest(BaseModel):
    account_id: str
    child_id: str
    content_type: str  # "imagined_animal", "story"
    content_id: str
