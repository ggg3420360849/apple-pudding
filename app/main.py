from fastapi import FastAPI

from app.routers import api, pages


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(pages.router)
    app.include_router(api.router)
    return app


app = create_app()
