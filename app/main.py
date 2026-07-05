from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.routers import api, pages, family, sharing, offline, achievements, speech
from app.logger import setup_logging, get_logger
from app.paths import STATIC_DIR

# 配置日志系统
setup_logging()
logger = get_logger(__name__)

# 配置请求限流
limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    app = FastAPI()

    # 添加限流器到应用状态
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # 先注册页面路由（优先级高于静态文件）
    app.include_router(pages.router)
    app.include_router(api.router)
    app.include_router(family.router)
    app.include_router(sharing.router)
    app.include_router(offline.router)
    app.include_router(achievements.router)
    app.include_router(speech.router)

    # 最后挂载静态文件（作为兜底）
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    logger.info("Application started", version="1.0.0")
    return app


app = create_app()
