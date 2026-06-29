"""Bounded streaming helpers for uploaded media."""
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, UploadFile


async def save_upload_limited(
    upload: UploadFile,
    destination: str,
    max_bytes: int,
    allowed_content_types: Iterable[str] = ("audio/wav", "audio/x-wav", "audio/mpeg", "audio/webm", "audio/mp4"),
) -> int:
    if upload.content_type and upload.content_type not in set(allowed_content_types):
        raise HTTPException(status_code=415, detail="不支持的音频格式")

    total = 0
    try:
        with Path(destination).open("wb") as handle:
            while chunk := await upload.read(1024 * 1024):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="音频文件过大")
                handle.write(chunk)
    finally:
        await upload.close()
    return total
