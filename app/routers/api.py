from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas import ChatRequest
from app.services.animal_chat import AnimalChatService

router = APIRouter(prefix="/api")


def get_animal_chat_service(
    settings: Settings = Depends(get_settings),
) -> AnimalChatService:
    return AnimalChatService(settings)


@router.get("/models")
def get_models(
    service: AnimalChatService = Depends(get_animal_chat_service),
) -> dict:
    return service.get_models()


@router.post("/animal/chat")
def animal_chat(
    req: ChatRequest,
    service: AnimalChatService = Depends(get_animal_chat_service),
) -> dict:
    return service.chat(req)
