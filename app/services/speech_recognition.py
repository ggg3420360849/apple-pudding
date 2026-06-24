"""
语音识别服务适配器

支持多种语音识别服务提供商：
- 阿里云（推荐）
- 腾讯云
- 百度
- OpenAI Whisper API
- 本地Whisper模型
"""

import os
import base64
from typing import Optional
from app.logger import get_logger

logger = get_logger(__name__)


class SpeechRecognitionService:
    """语音识别服务基类"""

    def transcribe(self, audio_path: str) -> str:
        """
        将音频文件转换为文字

        Args:
            audio_path: 音频文件路径

        Returns:
            识别的文字内容

        Raises:
            Exception: 识别失败时抛出异常
        """
        raise NotImplementedError


class AlibabaASRService(SpeechRecognitionService):
    """阿里云语音识别服务"""

    def __init__(self, app_key: str, access_token: str):
        self.app_key = app_key
        self.access_token = access_token
        logger.info("Alibaba ASR service initialized")

    def transcribe(self, audio_path: str) -> str:
        """
        使用阿里云语音识别API

        文档: https://help.aliyun.com/document_detail/84428.html
        """
        try:
            # TODO: 接入阿里云SDK
            # from alibabacloud_nls20180518.client import Client as NlsClient
            # from alibabacloud_nls20180518.models import ...

            logger.info("Alibaba ASR transcribe called", file=audio_path)
            raise NotImplementedError("请安装 alibabacloud-nls20180518 SDK")

        except Exception as e:
            logger.error("Alibaba ASR failed", error=str(e))
            raise Exception(f"阿里云语音识别失败: {str(e)}")


class TencentASRService(SpeechRecognitionService):
    """腾讯云语音识别服务"""

    def __init__(self, secret_id: str, secret_key: str, region: str = "ap-guangzhou"):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.region = region
        logger.info("Tencent ASR service initialized")

    def transcribe(self, audio_path: str) -> str:
        """
        使用腾讯云语音识别API

        文档: https://cloud.tencent.com/document/product/1093
        """
        try:
            # TODO: 接入腾讯云SDK
            # from tencentcloud.common import credential
            # from tencentcloud.asr.v20190614 import asr_client, models

            logger.info("Tencent ASR transcribe called", file=audio_path)
            raise NotImplementedError("请安装 tencentcloud-sdk-python SDK")

        except Exception as e:
            logger.error("Tencent ASR failed", error=str(e))
            raise Exception(f"腾讯云语音识别失败: {str(e)}")


class BaiduASRService(SpeechRecognitionService):
    """百度语音识别服务"""

    def __init__(self, api_key: str, secret_key: str):
        self.api_key = api_key
        self.secret_key = secret_key
        logger.info("Baidu ASR service initialized")

    def transcribe(self, audio_path: str) -> str:
        """
        使用百度语音识别API

        文档: https://ai.baidu.com/ai-doc/SPEECH/Vk38lxily
        """
        try:
            # TODO: 接入百度SDK
            # from aip import AipSpeech

            logger.info("Baidu ASR transcribe called", file=audio_path)
            raise NotImplementedError("请安装 baidu-aip SDK")

        except Exception as e:
            logger.error("Baidu ASR failed", error=str(e))
            raise Exception(f"百度语音识别失败: {str(e)}")


class OpenAIWhisperService(SpeechRecognitionService):
    """OpenAI Whisper API服务"""

    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.openai.com/v1"
        logger.info("OpenAI Whisper service initialized")

    def transcribe(self, audio_path: str) -> str:
        """
        使用OpenAI Whisper API

        文档: https://platform.openai.com/docs/guides/speech-to-text
        """
        try:
            import requests

            logger.info("OpenAI Whisper transcribe called", file=audio_path)

            with open(audio_path, 'rb') as audio_file:
                response = requests.post(
                    f"{self.base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files={"file": audio_file},
                    data={"model": "whisper-1", "language": "zh"},
                    timeout=30
                )

            response.raise_for_status()
            result = response.json()
            text = result.get("text", "")

            logger.info("OpenAI Whisper succeeded", text_length=len(text))
            return text

        except Exception as e:
            logger.error("OpenAI Whisper failed", error=str(e))
            raise Exception(f"Whisper语音识别失败: {str(e)}")


class MockASRService(SpeechRecognitionService):
    """模拟语音识别服务（开发测试用）"""

    def transcribe(self, audio_path: str) -> str:
        """返回模拟的识别结果"""
        file_size = os.path.getsize(audio_path)

        if file_size < 1000:
            raise Exception("录音文件太小，请说话时间长一点")

        logger.warning("Using mock ASR service - for testing only", file_size=file_size)

        # 返回示例文本
        return "这是一个模拟的语音识别结果，请配置真实的语音识别服务"


def create_speech_service(provider: str = "mock") -> SpeechRecognitionService:
    """
    工厂函数：根据配置创建语音识别服务

    Args:
        provider: 服务提供商 (alibaba/tencent/baidu/openai/mock)

    Returns:
        SpeechRecognitionService实例

    Raises:
        ValueError: 不支持的服务提供商
    """
    provider = provider.lower()

    if provider == "alibaba":
        app_key = os.getenv("ALIBABA_ASR_APP_KEY")
        token = os.getenv("ALIBABA_ASR_ACCESS_TOKEN")
        if not app_key or not token:
            logger.warning("Alibaba ASR credentials not found, falling back to mock")
            return MockASRService()
        return AlibabaASRService(app_key, token)

    elif provider == "tencent":
        secret_id = os.getenv("TENCENT_SECRET_ID")
        secret_key = os.getenv("TENCENT_SECRET_KEY")
        if not secret_id or not secret_key:
            logger.warning("Tencent ASR credentials not found, falling back to mock")
            return MockASRService()
        return TencentASRService(secret_id, secret_key)

    elif provider == "baidu":
        api_key = os.getenv("BAIDU_ASR_API_KEY")
        secret_key = os.getenv("BAIDU_ASR_SECRET_KEY")
        if not api_key or not secret_key:
            logger.warning("Baidu ASR credentials not found, falling back to mock")
            return MockASRService()
        return BaiduASRService(api_key, secret_key)

    elif provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        if not api_key:
            logger.warning("OpenAI API key not found, falling back to mock")
            return MockASRService()
        return OpenAIWhisperService(api_key, base_url)

    elif provider == "mock":
        return MockASRService()

    else:
        raise ValueError(f"不支持的语音识别服务: {provider}")
