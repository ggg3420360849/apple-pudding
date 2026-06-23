from app.clients.xuanji import XuanjiClient
from app.config import Settings
from app.schemas import ChatRequest
from app.services.prompts import build_system_prompt
from app.services.reply_parser import parse_reply


class AnimalChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = XuanjiClient(settings)

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
                "error": "没有读取到 XUANJI_API_KEY，请检查 .env 文件",
            }

        if not self.settings.xuanji_api_url:
            return {
                "success": False,
                "error": "没有读取到 XUANJI_API_URL，请检查 .env 文件",
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
        """使用玄机API进行语音识别"""
        if not self.settings.xuanji_api_key:
            raise Exception("没有配置 XUANJI_API_KEY")

        try:
            # 调用玄机API的语音识别接口
            result = self.client.transcribe(audio_path)
            return result.get("text", "")
        except Exception as e:
            raise Exception(f"语音识别失败: {str(e)}")
