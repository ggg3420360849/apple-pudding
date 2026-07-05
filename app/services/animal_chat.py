from app.clients.xuanji import XuanjiClient
from app.config import Settings
from app.schemas import ChatRequest
from app.services.ai_scenes import get_scene
from app.services.reply_parser import parse_reply_payload
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

        mode = req.mode or "qa"
        scene = get_scene(mode)
        system_prompt = scene.system_prompt
        user_question = req.message

        if req.animal and scene.include_animal_context:
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

        parsed = parse_reply_payload(result["data"], contract=scene.contract, formatter=scene.formatter)
        scene_result = scene.apply_safety(parsed["structured"], parsed["reply"], req.message)

        return {
            "success": True,
            "model": selected_model,
            "mode": scene.name,
            "animal": req.animal,
            "message": req.message,
            "reply": scene_result.reply,
            "structured": scene_result.structured,
            "structured_errors": parsed["structured_errors"],
            "safety_warnings": scene_result.safety_warnings,
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
