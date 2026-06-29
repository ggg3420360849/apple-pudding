"""Family account management API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import uuid
from datetime import datetime

from app.database import get_session_store, SessionStore, FamilyAccount, ChildProfile, WeeklyGoal
from app.schemas import (
    CreateFamilyAccountRequest,
    LoginRequest,
    CreateChildProfileRequest,
    CreateWeeklyGoalRequest,
    RecordActivityRequest
)
from app.config import Settings, get_settings
from app.security import (
    AccountPrincipal, create_access_token, get_current_account, hash_password,
    public_account, require_account, require_child, verify_password,
)
from app.logger import get_logger

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/family")


@router.post("/register")
@limiter.limit("5/hour")
def register_account(
    request: Request,
    req: CreateFamilyAccountRequest,
    store: SessionStore = Depends(get_session_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    """注册家长账号"""
    try:
        # 检查手机号是否已存在
        if req.phone:
            existing = store.get_family_account_by_phone(req.phone)
            if existing:
                raise HTTPException(status_code=400, detail="该手机号已注册")
        if req.email and store.get_family_account_by_email(req.email):
            raise HTTPException(status_code=400, detail="该邮箱已注册")

        account = FamilyAccount(
            id=str(uuid.uuid4()),
            parent_name=req.parent_name,
            phone=req.phone if hasattr(req, 'phone') else None,
            email=req.email,
            password_hash=hash_password(req.password)
        )
        created_account = store.create_family_account(account)
        token = create_access_token(created_account.id, settings)

        logger.info("Family account registered", account_id=created_account.id, phone=req.phone)

        return {
            "success": True,
            "token": token,
            "account": public_account(created_account)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to register account", error=str(e))
        raise HTTPException(status_code=500, detail="注册失败")


@router.post("/login")
@limiter.limit("10/minute")
def login_account(
    request: Request,
    credentials: LoginRequest,
    store: SessionStore = Depends(get_session_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    """家长登录"""
    try:
        username = credentials.username
        password = credentials.password

        # 尝试通过手机号查找
        account = store.get_family_account_by_phone(username)

        # 如果没找到，尝试通过邮箱查找
        if not account:
            account = store.get_family_account_by_email(username)

        if not account:
            raise HTTPException(status_code=401, detail="账号不存在")

        # 验证密码
        valid_password, should_rehash = verify_password(password, account.password_hash)
        if not valid_password:
            raise HTTPException(status_code=401, detail="密码错误")
        if should_rehash:
            account.password_hash = hash_password(password)
            store.update_family_account(account)

        token = create_access_token(account.id, settings)

        logger.info("User logged in", account_id=account.id)

        return {
            "success": True,
            "message": "登录成功",
            "token": token,
            "account": public_account(account)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed", error=str(e))
        raise HTTPException(status_code=500, detail="登录失败")


@router.post("/accounts")
@limiter.limit("5/hour")
def create_family_account(
    request: Request,
    req: CreateFamilyAccountRequest,
    store: SessionStore = Depends(get_session_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Create a new family account"""
    try:
        account = FamilyAccount(
            id=str(uuid.uuid4()),
            parent_name=req.parent_name,
            email=req.email,
            phone=req.phone,
            password_hash=hash_password(req.password)
        )
        created_account = store.create_family_account(account)
        logger.info("Family account created", account_id=created_account.id)

        return {
            "success": True,
            "token": create_access_token(created_account.id, settings),
            "account_id": created_account.id,
            "parent_name": created_account.parent_name,
            "account": public_account(created_account),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create family account", error=str(e))
        raise HTTPException(status_code=500, detail="创建账户失败")


@router.get("/accounts/{account_id}")
def get_family_account(
    account_id: str,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Get family account details"""
    require_account(principal, account_id)
    account = store.get_family_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "success": True,
        "account": public_account(account)
    }


@router.post("/accounts/{account_id}/children")
@limiter.limit("10/hour")
def add_child_profile(
    request: Request,
    account_id: str,
    req: CreateChildProfileRequest,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Add a child profile to family account"""
    try:
        require_account(principal, account_id)
        child = ChildProfile(
            id=str(uuid.uuid4()),
            name=req.name,
            avatar=req.avatar,
            age=req.age
        )
        updated_account = store.add_child_profile(account_id, child)

        if not updated_account:
            raise HTTPException(status_code=404, detail="Account not found")

        logger.info("Child profile added", account_id=account_id, child_id=child.id)

        return {
            "success": True,
            "child_id": child.id,
            "child": child.model_dump(mode='json')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add child profile", error=str(e))
        raise HTTPException(status_code=500, detail="添加孩子失败")


@router.get("/accounts/{account_id}/children/{child_id}")
def get_child_profile(
    account_id: str,
    child_id: str,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Get child profile with progress"""
    require_account(principal, account_id)
    child = store.get_child_profile(account_id, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found")

    return {
        "success": True,
        "child": child.model_dump(mode='json')
    }


@router.get("/accounts/{account_id}/report")
def get_family_report(
    account_id: str,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Get comparison report for all children"""
    require_account(principal, account_id)
    report = store.get_comparison_report(account_id)
    if not report:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "success": True,
        "report": report
    }


@router.post("/activity")
@limiter.limit("100/hour")
def record_activity(
    request: Request,
    req: RecordActivityRequest,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Record learning activity for a child"""
    try:
        require_account(principal, req.account_id)
        require_child(store, principal, req.child_id)
        success = False

        if req.activity_type == "animal_explored":
            animal = req.data.get("animal")
            if animal:
                success = store.record_animal_explored(req.account_id, req.child_id, animal)

        elif req.activity_type == "question_answered":
            correct = req.data.get("correct", False)
            success = store.record_question_answer(req.account_id, req.child_id, correct)

        elif req.activity_type == "story_created":
            success = store.record_story_created(req.account_id, req.child_id)

        elif req.activity_type == "imagined_animal":
            animal_data = req.data.get("animal_data", {})
            success = store.add_imagined_animal(req.account_id, req.child_id, animal_data)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to record activity")

        logger.info("Activity recorded",
                   account_id=req.account_id,
                   child_id=req.child_id,
                   activity_type=req.activity_type)

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to record activity", error=str(e))
        raise HTTPException(status_code=500, detail="记录活动失败")


@router.post("/goals")
@limiter.limit("20/hour")
def create_weekly_goal(
    request: Request,
    req: CreateWeeklyGoalRequest,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Create a weekly learning goal"""
    try:
        require_child(store, principal, req.child_id)
        goal = WeeklyGoal(
            id=str(uuid.uuid4()),
            child_id=req.child_id,
            week_start=datetime.now(),
            goal_type=req.goal_type,
            target=req.target
        )
        created_goal = store.create_weekly_goal(goal)

        logger.info("Weekly goal created",
                   child_id=req.child_id,
                   goal_type=req.goal_type,
                   target=req.target)

        return {
            "success": True,
            "goal": created_goal.model_dump(mode='json')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create weekly goal", error=str(e))
        raise HTTPException(status_code=500, detail="创建目标失败")


@router.get("/goals/{child_id}")
def get_child_goals(
    child_id: str,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Get all weekly goals for a child"""
    require_child(store, principal, child_id)
    goals = store.get_child_weekly_goals(child_id)

    return {
        "success": True,
        "goals": [goal.model_dump(mode='json') for goal in goals]
    }


@router.post("/badges")
@limiter.limit("50/hour")
def award_badge(
    request: Request,
    account_id: str,
    child_id: str,
    badge_name: str,
    store: SessionStore = Depends(get_session_store),
    principal: AccountPrincipal = Depends(get_current_account),
) -> dict:
    """Award a badge to a child"""
    try:
        require_account(principal, account_id)
        require_child(store, principal, child_id)
        success = store.award_badge(account_id, child_id, badge_name)

        if not success:
            raise HTTPException(status_code=404, detail="Child not found")

        logger.info("Badge awarded",
                   account_id=account_id,
                   child_id=child_id,
                   badge=badge_name)

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to award badge", error=str(e))
        raise HTTPException(status_code=500, detail="授予徽章失败")
