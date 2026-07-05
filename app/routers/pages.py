from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.paths import STATIC_DIR

router = APIRouter()


@router.get("/")
def index():
    """返回登录页面"""
    return FileResponse(STATIC_DIR / "index-login.html")


@router.get("/family")
def family_page():
    """家庭版页面 - 展示所有新功能"""
    return FileResponse(STATIC_DIR / "family.html")
