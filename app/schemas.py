from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    animal: str | None = None
    model: str | None = None
    mode: str | None = "qa"
