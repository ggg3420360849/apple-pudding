from app.clients.xuanji import XuanjiClient
from app.config import Settings
from app.schemas import ChatRequest
from app.services.prompts import build_system_prompt
from app.services.reply_parser import parse_reply
from app.services.speech_recognition import create_speech_service
from app.logger import get_logger

logger = get_logger(__name__)


class AnimalChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = XuanjiClient(settings)

        # 初始化语音识别服务
        self.speech_service = create_speech_service(settings.speech_provider)
        logger.info("AnimalChatService initialized", speech_provider=settings.speech_provider)

    def get_models(self) -> dict:
        return {
            "success": True,
            "default_model": self.settings.default_model,
            "models": self.settings.allowed_models,
        }

    def chat(self, req: ChatRequest) -> dict:
        if not self.settings.xuanji_api_key:
            return {
                "success": False,
                "error": "AI服务暂时不可用，请稍后再试",
            }

        if not self.settings.xuanji_api_url:
            return {
                "success": False,
                "error": "AI服务暂时不可用，请稍后再试",
            }

        selected_model = req.model or self.settings.default_model

        if selected_model not in self.settings.allowed_models:
            return {
                "success": False,
                "error": "模型名称不支持",
                "allowed_models": self.settings.allowed_models,
            }

        system_prompt = build_system_prompt(req.mode)
        user_question = req.message

        # 对于故事模式，保持原始消息结构，因为前端已经构建好了完整提示词
        # 对于其他模式，添加动物信息前缀
        if req.animal and req.mode != "story":
            user_question = f"当前动物是：{req.animal}。孩子的问题是：{req.message}"

        try:
            result = self.client.chat(selected_model, system_prompt, user_question)
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

        if not result.get("success"):
            return result

        return {
            "success": True,
            "model": selected_model,
            "mode": req.mode or "qa",
            "animal": req.animal,
            "message": req.message,
            "reply": parse_reply(result["data"]),
        }

    def transcribe_audio(self, audio_path: str) -> str:
        """使用配置的语音识别服务进行转录"""
        try:
            logger.info("Transcribing audio", path=audio_path, provider=self.settings.speech_provider)
            text = self.speech_service.transcribe(audio_path)
            logger.info("Transcription succeeded", text_length=len(text))
            return text
        except Exception as e:
            logger.error("Transcription failed", error=str(e), exc_info=True)
            raise Exception(f"语音识别失败: {str(e)}")
