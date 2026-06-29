from app.services.ai_scenes import get_scene


def build_system_prompt(mode: str | None) -> str:
    """Backward-compatible prompt entrypoint for older imports."""
    return get_scene(mode).system_prompt
