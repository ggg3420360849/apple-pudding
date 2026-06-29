"""Speech recognition API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from slowapi import Limiter
from slowapi.util import get_remote_address
import tempfile
import os

from app.services.speech_service import SpeechRecognitionService
from app.config import Settings, get_settings
from app.logger import get_logger
from app.uploads import save_upload_limited

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/speech")

def get_speech_service(provider: str = "mock") -> SpeechRecognitionService:
    """Get speech recognition service instance"""
    return SpeechRecognitionService(provider)


@router.post("/transcribe")
@limiter.limit("20/minute")
async def transcribe_audio(
    request: Request,
    audio: UploadFile = File(...),
    provider: str = Form("mock"),
    settings: Settings = Depends(get_settings),
) -> dict:
    """转录音频为文本"""
    tmp_path = None
    try:
        logger.info("Transcription request", provider=provider, filename=audio.filename)

        # 保存上传的音频到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name
        await save_upload_limited(audio, tmp_path, settings.max_upload_bytes)

        # 调用语音识别服务
        speech_service = get_speech_service(provider)
        text = speech_service.transcribe_audio(tmp_path)

        logger.info("Transcription completed", text_length=len(text))

        return {
            "success": True,
            "text": text,
            "provider": provider
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Transcription failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="语音转录失败")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning("Failed to delete temp file", path=tmp_path, error=str(e))


@router.post("/assess")
@limiter.limit("20/minute")
async def assess_pronunciation(
    request: Request,
    audio: UploadFile = File(...),
    provider: str = Form("mock"),
    reference_text: str = Form(...),
    settings: Settings = Depends(get_settings),
) -> dict:
    """评估发音质量"""
    tmp_path = None
    try:
        logger.info("Assessment request", provider=provider, reference=reference_text[:50])

        # 保存上传的音频到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name
        await save_upload_limited(audio, tmp_path, settings.max_upload_bytes)

        # 调用发音评估服务
        speech_service = get_speech_service(provider)
        assessment = speech_service.assess_pronunciation(tmp_path, reference_text)

        logger.info("Assessment completed", score=assessment.get('overall_score'))

        return {
            "success": True,
            "overall_score": assessment.get('overall_score', 0),
            "pronunciation_score": assessment.get('pronunciation_score', 0),
            "fluency_score": assessment.get('fluency_score', 0),
            "words": assessment.get('words', []),
            "provider": provider
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Assessment failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="发音评估失败")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning("Failed to delete temp file", path=tmp_path, error=str(e))


@router.get("/providers")
def get_available_providers() -> dict:
    """获取可用的语音服务提供商"""
    providers = [
        {
            "id": "mock",
            "name": "模拟模式",
            "description": "用于测试，不需要API密钥",
            "available": True
        },
        {
            "id": "tencent",
            "name": "腾讯云语音",
            "description": "需要配置 TENCENT_SECRET_ID, TENCENT_SECRET_KEY, TENCENT_APP_ID",
            "available": bool(os.getenv("TENCENT_SECRET_ID"))
        },
        {
            "id": "alibaba",
            "name": "阿里云语音",
            "description": "需要配置 ALIBABA_ACCESS_KEY_ID, ALIBABA_ACCESS_KEY_SECRET, ALIBABA_APP_KEY",
            "available": bool(os.getenv("ALIBABA_ACCESS_KEY_ID"))
        }
    ]

    return {
        "success": True,
        "providers": providers
    }
