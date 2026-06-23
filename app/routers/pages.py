from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "static"
STATIC_INDEX = STATIC_DIR / "index.html"
STATIC_CHILD = STATIC_DIR / "child.html"
STATIC_PARENT = STATIC_DIR / "parent.html"


def index_response() -> HTMLResponse:
    return HTMLResponse(STATIC_INDEX.read_text(encoding="utf-8"))


def child_response() -> HTMLResponse:
    return HTMLResponse(STATIC_CHILD.read_text(encoding="utf-8"))


def parent_response() -> HTMLResponse:
    return HTMLResponse(STATIC_PARENT.read_text(encoding="utf-8"))


@router.get("/")
def home() -> HTMLResponse:
    return index_response()


@router.get("/child")
def child_page() -> HTMLResponse:
    return child_response()


@router.get("/parent")
def parent_page() -> HTMLResponse:
    return parent_response()


@router.get("/demo")
def demo_page() -> HTMLResponse:
    return index_response()


@router.get("/favicon.ico")
def favicon() -> Response:
    svg = """<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='#ffe7a6'/><text x='32' y='44' text-anchor='middle' font-size='38'>🍎</text></svg>"""
    return Response(content=svg, media_type="image/svg+xml")
