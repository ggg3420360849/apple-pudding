from fastapi import APIRouter
from fastapi.responses import FileResponse, RedirectResponse

router = APIRouter()


@router.get("/")
def index():
    """返回登录页面"""
    return FileResponse("static/index-login.html")


@router.get("/family")
def family_page():
    """家庭版页面 - 展示所有新功能"""
    return FileResponse("static/family.html")
