"""Real speech recognition service supporting multiple providers"""
import os
import json
import time
import hmac
import hashlib
import base64
from abc import ABC, abstractmethod
from typing import Optional
import requests
from datetime import datetime
from urllib.parse import urlencode

from app.logger import get_logger

logger = get_logger(__name__)


class SpeechRecognitionProvider(ABC):
    """Base class for speech recognition providers"""

    @abstractmethod
    def transcribe(self, audio_file_path: str, language: str = "zh-CN") -> str:
        """Transcribe audio file to text"""
        pass

    @abstractmethod
    def assess_pronunciation(self, audio_file_path: str, reference_text: str) -> dict:
        """Assess pronunciation quality"""
        pass


class TencentCloudSpeech(SpeechRecognitionProvider):
    """Tencent Cloud Speech Recognition Service"""

    def __init__(self, secret_id: str, secret_key: str, app_id: str):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.app_id = app_id
        self.endpoint = "asr.tencentcloudapi.com"
        self.service = "asr"
        self.version = "2019-06-14"

    def _sign(self, params: dict) -> str:
        """Generate Tencent Cloud signature"""
        # Sort parameters
        sorted_params = sorted(params.items())
        query_string = urlencode(sorted_params)

        # Create string to sign
        string_to_sign = f"GET{self.endpoint}/?{query_string}"

        # Generate signature
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha1
        ).digest()

        return base64.b64encode(signature).decode('utf-8')

    def transcribe(self, audio_file_path: str, language: str = "zh-CN") -> str:
        """Transcribe audio using Tencent Cloud ASR"""
        try:
            # Read audio file
            with open(audio_file_path, 'rb') as f:
                audio_data = f.read()

            # Convert to base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

            # Prepare request
            url = "https://asr.tencentcloudapi.com/"
            timestamp = int(time.time())
            nonce = int(time.time() * 1000)

            params = {
                'Action': 'SentenceRecognition',
                'Version': self.version,
                'Region': 'ap-guangzhou',
                'ProjectId': 0,
                'SubServiceType': 2,
                'EngSerViceType': '16k_zh',
                'SourceType': 1,
                'VoiceFormat': 'wav',
                'Data': audio_base64,
                'DataLen': len(audio_data),
                'Timestamp': timestamp,
                'Nonce': nonce,
                'SecretId': self.secret_id
            }

            # Add signature
            params['Signature'] = self._sign(params)

            # Make request
            response = requests.post(url, json=params, timeout=30)
            result = response.json()

            if result.get('Response', {}).get('Result'):
                text = result['Response']['Result']
                logger.info("Tencent ASR succeeded", text_length=len(text))
                return text
            else:
                error = result.get('Response', {}).get('Error', {}).get('Message', 'Unknown error')
                logger.error("Tencent ASR failed", error=error)
                raise Exception(f"Tencent ASR error: {error}")

        except Exception as e:
            logger.error("Tencent ASR exception", error=str(e), exc_info=True)
            raise

    def assess_pronunciation(self, audio_file_path: str, reference_text: str) -> dict:
        """Assess pronunciation using Tencent Cloud SOE"""
        try:
            with open(audio_file_path, 'rb') as f:
                audio_data = f.read()

            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

            url = "https://soe.tencentcloudapi.com/"
            timestamp = int(time.time())
            nonce = int(time.time() * 1000)

            params = {
                'Action': 'TransmitOralProcessWithInit',
                'Version': '2018-07-24',
                'Region': 'ap-guangzhou',
                'SessionId': f"session_{timestamp}",
                'RefText': reference_text,
                'WorkMode': 1,
                'EvalMode': 1,
                'ScoreCoeff': 1.0,
                'VoiceFileType': 3,
                'UserVoiceData': audio_base64,
                'Timestamp': timestamp,
                'Nonce': nonce,
                'SecretId': self.secret_id
            }

            params['Signature'] = self._sign(params)

            response = requests.post(url, json=params, timeout=30)
            result = response.json()

            if 'Response' in result and 'PronAccuracy' in result['Response']:
                assessment = {
                    "overall_score": result['Response']['PronAccuracy'],
                    "pronunciation_score": result['Response'].get('PronFluency', 0),
                    "fluency_score": result['Response'].get('PronCompletion', 0),
                    "words": result['Response'].get('Words', [])
                }
                logger.info("Pronunciation assessment succeeded", score=assessment['overall_score'])
                return assessment
            else:
                error = result.get('Response', {}).get('Error', {}).get('Message', 'Unknown error')
                logger.error("Pronunciation assessment failed", error=error)
                raise Exception(f"SOE error: {error}")

        except Exception as e:
            logger.error("Pronunciation assessment exception", error=str(e), exc_info=True)
            raise


class AlibabaCloudSpeech(SpeechRecognitionProvider):
    """Alibaba Cloud Speech Recognition Service"""

    def __init__(self, access_key_id: str, access_key_secret: str, app_key: str):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.app_key = app_key
        self.endpoint = "https://nls-gateway-cn-shanghai.aliyuncs.com"

    def transcribe(self, audio_file_path: str, language: str = "zh-CN") -> str:
        """Transcribe audio using Alibaba Cloud NLS"""
        try:
            # Read audio file
            with open(audio_file_path, 'rb') as f:
                audio_data = f.read()

            # Get token
            token = self._get_token()

            # Prepare request
            url = f"{self.endpoint}/stream/v1/asr"
            headers = {
                'X-NLS-Token': token,
                'Content-Type': 'application/octet-stream'
            }

            params = {
                'appkey': self.app_key,
                'format': 'wav',
                'sample_rate': 16000,
                'enable_intermediate_result': False,
                'enable_punctuation_prediction': True,
                'enable_inverse_text_normalization': True
            }

            # Make request
            response = requests.post(
                url,
                params=params,
                headers=headers,
                data=audio_data,
                timeout=30
            )

            result = response.json()

            if result.get('status') == 20000000:  # Success
                text = result.get('result', '')
                logger.info("Alibaba ASR succeeded", text_length=len(text))
                return text
            else:
                error = result.get('message', 'Unknown error')
                logger.error("Alibaba ASR failed", error=error)
                raise Exception(f"Alibaba ASR error: {error}")

        except Exception as e:
            logger.error("Alibaba ASR exception", error=str(e), exc_info=True)
            raise

    def assess_pronunciation(self, audio_file_path: str, reference_text: str) -> dict:
        """Assess pronunciation using Alibaba Cloud"""
        try:
            with open(audio_file_path, 'rb') as f:
                audio_data = f.read()

            token = self._get_token()

            url = f"{self.endpoint}/stream/v1/FlashRecognizer"
            headers = {
                'X-NLS-Token': token,
                'Content-Type': 'application/octet-stream'
            }

            params = {
                'appkey': self.app_key,
                'format': 'wav',
                'sample_rate': 16000,
                'enable_soe': True,
                'soe_text': reference_text
            }

            response = requests.post(
                url,
                params=params,
                headers=headers,
                data=audio_data,
                timeout=30
            )

            result = response.json()

            if result.get('status') == 20000000:
                soe_result = result.get('soe_result', {})
                assessment = {
                    "overall_score": soe_result.get('overall_score', 0),
                    "pronunciation_score": soe_result.get('pronunciation_score', 0),
                    "fluency_score": soe_result.get('fluency_score', 0),
                    "words": soe_result.get('words', [])
                }
                logger.info("Pronunciation assessment succeeded", score=assessment['overall_score'])
                return assessment
            else:
                error = result.get('message', 'Unknown error')
                logger.error("Pronunciation assessment failed", error=error)
                raise Exception(f"SOE error: {error}")

        except Exception as e:
            logger.error("Pronunciation assessment exception", error=str(e), exc_info=True)
            raise

    def _get_token(self) -> str:
        """Get access token from Alibaba Cloud"""
        url = "https://nls-meta.cn-shanghai.aliyuncs.com/token"
        params = {
            'AccessKeyId': self.access_key_id,
            'Action': 'CreateToken'
        }

        response = requests.get(url, params=params, timeout=10)
        result = response.json()

        if 'Token' in result and 'Id' in result['Token']:
            return result['Token']['Id']
        else:
            raise Exception("Failed to get Alibaba Cloud token")


class MockSpeechProvider(SpeechRecognitionProvider):
    """Mock provider for development/testing"""

    def transcribe(self, audio_file_path: str, language: str = "zh-CN") -> str:
        """Mock transcription"""
        logger.info("Using mock speech recognition")
        return "这是模拟的语音识别结果"

    def assess_pronunciation(self, audio_file_path: str, reference_text: str) -> dict:
        """Mock pronunciation assessment"""
        logger.info("Using mock pronunciation assessment")
        return {
            "overall_score": 85.5,
            "pronunciation_score": 88.0,
            "fluency_score": 82.0,
            "words": [
                {"word": word, "score": 85.0}
                for word in reference_text
            ]
        }


class SpeechRecognitionService:
    """Unified speech recognition service"""

    def __init__(self, provider: str = "mock"):
        self.provider = self._create_provider(provider)

    def _create_provider(self, provider_name: str) -> SpeechRecognitionProvider:
        """Create appropriate provider based on configuration"""
        if provider_name == "tencent":
            secret_id = os.getenv("TENCENT_SECRET_ID", "")
            secret_key = os.getenv("TENCENT_SECRET_KEY", "")
            app_id = os.getenv("TENCENT_APP_ID", "")

            if not all([secret_id, secret_key, app_id]):
                logger.warning("Tencent Cloud credentials missing, falling back to mock")
                return MockSpeechProvider()

            return TencentCloudSpeech(secret_id, secret_key, app_id)

        elif provider_name == "alibaba":
            access_key_id = os.getenv("ALIBABA_ACCESS_KEY_ID", "")
            access_key_secret = os.getenv("ALIBABA_ACCESS_KEY_SECRET", "")
            app_key = os.getenv("ALIBABA_APP_KEY", "")

            if not all([access_key_id, access_key_secret, app_key]):
                logger.warning("Alibaba Cloud credentials missing, falling back to mock")
                return MockSpeechProvider()

            return AlibabaCloudSpeech(access_key_id, access_key_secret, app_key)

        else:
            logger.info("Using mock speech recognition provider")
            return MockSpeechProvider()

    def transcribe_audio(self, audio_file_path: str, language: str = "zh-CN") -> str:
        """Transcribe audio file to text"""
        return self.provider.transcribe(audio_file_path, language)

    def assess_pronunciation(self, audio_file_path: str, reference_text: str) -> dict:
        """Assess pronunciation quality"""
        return self.provider.assess_pronunciation(audio_file_path, reference_text)
