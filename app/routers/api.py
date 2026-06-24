from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request
import tempfile
import os

from app.config import Settings, get_settings
from app.schemas import ChatRequest
from app.services.animal_chat import AnimalChatService
from app.services.speech_service import SpeechRecognitionService
from app.logger import get_logger
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api")


def get_animal_chat_service(
    settings: Settings = Depends(get_settings),
) -> AnimalChatService:
    return AnimalChatService(settings)


def get_speech_service(
    settings: Settings = Depends(get_settings),
) -> SpeechRecognitionService:
    return SpeechRecognitionService(settings.speech_provider)


@router.get("/models")
def get_models(
    service: AnimalChatService = Depends(get_animal_chat_service),
) -> dict:
    return service.get_models()


@router.post("/animal/chat")
@limiter.limit("30/minute")
def animal_chat(
    request: Request,
    req: ChatRequest,
    service: AnimalChatService = Depends(get_animal_chat_service),
) -> dict:
    logger.info("Chat request received", animal=req.animal, mode=req.mode)
    result = service.chat(req)
    if result.get("success"):
        logger.info("Chat request succeeded", animal=req.animal, mode=req.mode)
    else:
        logger.warning("Chat request failed", error=result.get("error"))
    return result


@router.post("/speech-to-text")
@limiter.limit("10/minute")
async def speech_to_text(
    request: Request,
    audio: UploadFile = File(...),
    speech_service: SpeechRecognitionService = Depends(get_speech_service),
) -> dict:
    """将录音转换为文字"""
    tmp_path = None
    try:
        logger.info("Speech-to-text request received", filename=audio.filename)

        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # 调用语音识别服务
        text = speech_service.transcribe_audio(tmp_path)
        logger.info("Speech-to-text succeeded", text_length=len(text))
        return {"text": text, "success": True}

    except Exception as e:
        # 记录详细错误到日志系统
        logger.error("Speech-to-text failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="语音识别失败，请重试")

    finally:
        # 确保临时文件一定被删除
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug("Temp file cleaned", path=tmp_path)
            except Exception as cleanup_error:
                # 记录清理失败
                logger.warning("Failed to cleanup temp file", path=tmp_path, error=str(cleanup_error))


@router.post("/pronunciation-assessment")
@limiter.limit("20/minute")
async def pronunciation_assessment(
    request: Request,
    audio: UploadFile = File(...),
    reference_text: str = "",
    speech_service: SpeechRecognitionService = Depends(get_speech_service),
) -> dict:
    """评估发音质量"""
    tmp_path = None
    try:
        logger.info("Pronunciation assessment request received",
                   filename=audio.filename,
                   reference_length=len(reference_text))

        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # 调用发音评估服务
        assessment = speech_service.assess_pronunciation(tmp_path, reference_text)
        logger.info("Pronunciation assessment succeeded",
                   overall_score=assessment.get('overall_score'))

        return {
            "success": True,
            "assessment": assessment
        }

    except Exception as e:
        logger.error("Pronunciation assessment failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="发音评估失败，请重试")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug("Temp file cleaned", path=tmp_path)
            except Exception as cleanup_error:
                logger.warning("Failed to cleanup temp file",
                             path=tmp_path,
                             error=str(cleanup_error))
