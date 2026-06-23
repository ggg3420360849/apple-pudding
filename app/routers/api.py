from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
import tempfile
import os

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


@router.post("/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    service: AnimalChatService = Depends(get_animal_chat_service),
) -> dict:
    """将录音转换为文字"""
    try:
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            # 调用语音识别服务
            text = service.transcribe_audio(tmp_path)
            return {"text": text, "success": True}
        finally:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音识别失败: {str(e)}")
