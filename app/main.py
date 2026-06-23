from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routers import api, pages


def create_app() -> FastAPI:
    app = FastAPI()
    app.mount("/static", StaticFiles(directory="static"), name="static")
    app.include_router(pages.router)
    app.include_router(api.router)
    return app


app = create_app()
