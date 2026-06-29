"""Social sharing API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_session_store, SessionStore
from app.services.sharing_service import SharingService
from app.schemas import ShareCardRequest
from app.logger import get_logger
from app.security import AccountPrincipal, get_current_account, require_account, require_child

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/sharing")


def get_sharing_service() -> SharingService:
    return SharingService()


@router.post("/card/animal")
@limiter.limit("20/hour")
async def generate_animal_card(
    request: Request,
    req: ShareCardRequest,
    store: SessionStore = Depends(get_session_store),
    sharing_service: SharingService = Depends(get_sharing_service),
    principal: AccountPrincipal = Depends(get_current_account),
) -> Response:
    """Generate shareable card for imagined animal"""
    try:
        require_account(principal, req.account_id)
        require_child(store, principal, req.child_id)
        # Get child profile
        child = store.get_child_profile(req.account_id, req.child_id)
        if not child:
            raise HTTPException(status_code=404, detail="Child profile not found")

        # Find the specific animal
        animal_data = None
        for animal in child.imagined_animals:
            if animal.get('id') == req.content_id:
                animal_data = animal
                break

        if not animal_data:
            raise HTTPException(status_code=404, detail="Imagined animal not found")

        # Generate card
        card_bytes = sharing_service.generate_imagined_animal_card(
            animal_name=animal_data.get('name', 'Unknown'),
            description=animal_data.get('description', ''),
            features=animal_data.get('features', []),
            child_name=child.name,
            child_age=child.age
        )

        logger.info("Animal card generated",
                   account_id=req.account_id,
                   child_id=req.child_id,
                   animal=animal_data.get('name'))

        return Response(
            content=card_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f"attachment; filename=animal_card_{req.content_id}.png"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate animal card", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="生成动物分享卡失败")


@router.post("/card/story")
@limiter.limit("20/hour")
async def generate_story_card(
    request: Request,
    req: ShareCardRequest,
    store: SessionStore = Depends(get_session_store),
    sharing_service: SharingService = Depends(get_sharing_service),
    principal: AccountPrincipal = Depends(get_current_account),
) -> Response:
    """Generate shareable card for story"""
    try:
        require_account(principal, req.account_id)
        require_child(store, principal, req.child_id)
        # Get child profile
        child = store.get_child_profile(req.account_id, req.child_id)
        if not child:
            raise HTTPException(status_code=404, detail="Child profile not found")

        # For now, we'll need to pass story data in the request
        # In a real implementation, you'd store stories in the database
        # This is a placeholder implementation

        card_bytes = sharing_service.generate_story_card(
            title="我的冒险故事",
            content="这是一个精彩的故事...",
            child_name=child.name,
            child_age=child.age
        )

        logger.info("Story card generated",
                   account_id=req.account_id,
                   child_id=req.child_id)

        return Response(
            content=card_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f"attachment; filename=story_card_{req.content_id}.png"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate story card", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="生成故事分享卡失败")


@router.get("/qr-code")
@limiter.limit("30/hour")
async def generate_invite_qr(
    request: Request,
    account_id: str,
    sharing_service: SharingService = Depends(get_sharing_service),
    principal: AccountPrincipal = Depends(get_current_account),
) -> Response:
    """Generate QR code for inviting friends"""
    try:
        require_account(principal, account_id)
        # Generate invite URL (you'd want a proper domain in production)
        invite_url = f"https://apple-pudding.app/invite?ref={account_id}"

        qr_bytes = sharing_service.generate_qr_code(invite_url)

        logger.info("QR code generated", account_id=account_id)

        return Response(
            content=qr_bytes,
            media_type="image/png"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate QR code", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="生成二维码失败")
