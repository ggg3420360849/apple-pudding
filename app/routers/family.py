"""Family account management API routes"""
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import List
import uuid
import hashlib
from datetime import datetime, timedelta

from app.database import get_session_store, SessionStore, FamilyAccount, ChildProfile, WeeklyGoal
from app.schemas import (
    CreateFamilyAccountRequest,
    CreateChildProfileRequest,
    CreateWeeklyGoalRequest,
    RecordActivityRequest
)
from app.logger import get_logger

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/family")


def hash_password(password: str) -> str:
    """简单的密码哈希（生产环境应使用bcrypt）"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token(account_id: str) -> str:
    """生成简单的token（生产环境应使用JWT）"""
    return hashlib.sha256(f"{account_id}_{datetime.now().isoformat()}".encode()).hexdigest()


@router.post("/register")
@limiter.limit("5/hour")
def register_account(
    request: Request,
    req: CreateFamilyAccountRequest,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """注册家长账号"""
    try:
        # 检查手机号是否已存在
        if req.phone:
            existing = store.get_family_account_by_phone(req.phone)
            if existing:
                raise HTTPException(status_code=400, detail="该手机号已注册")

        account = FamilyAccount(
            id=str(uuid.uuid4()),
            parent_name=req.parent_name,
            phone=req.phone if hasattr(req, 'phone') else None,
            email=req.email,
            password_hash=hash_password(req.password)
        )
        created_account = store.create_family_account(account)
        token = generate_token(created_account.id)

        logger.info("Family account registered", account_id=created_account.id, phone=req.phone)

        return {
            "success": True,
            "token": token,
            "account": {
                "id": created_account.id,
                "parent_name": created_account.parent_name,
                "phone": created_account.phone,
                "email": created_account.email
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to register account", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
@limiter.limit("10/minute")
def login_account(
    request: Request,
    credentials: dict,  # 接收 {username, password}
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """家长登录"""
    try:
        username = credentials.get('username')
        password = credentials.get('password')

        if not username or not password:
            raise HTTPException(status_code=400, detail="请提供用户名和密码")

        # 尝试通过手机号查找
        account = store.get_family_account_by_phone(username)

        # 如果没找到，尝试通过邮箱查找
        if not account:
            account = store.get_family_account_by_email(username)

        if not account:
            raise HTTPException(status_code=401, detail="账号不存在")

        # 验证密码
        if account.password_hash != hash_password(password):
            raise HTTPException(status_code=401, detail="密码错误")

        token = generate_token(account.id)

        logger.info("User logged in", account_id=account.id)

        return {
            "success": True,
            "message": "登录成功",
            "token": token,
            "account": {
                "id": account.id,
                "parent_name": account.parent_name,
                "phone": account.phone,
                "email": account.email
            }
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
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Create a new family account"""
    try:
        account = FamilyAccount(
            id=str(uuid.uuid4()),
            parent_name=req.parent_name,
            email=req.email,
            password_hash=req.password  # TODO: Implement proper password hashing
        )
        created_account = store.create_family_account(account)
        logger.info("Family account created", account_id=created_account.id)

        return {
            "success": True,
            "account_id": created_account.id,
            "parent_name": created_account.parent_name
        }
    except Exception as e:
        logger.error("Failed to create family account", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/{account_id}")
def get_family_account(
    account_id: str,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Get family account details"""
    account = store.get_family_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "success": True,
        "account": account.model_dump(mode='json')
    }


@router.post("/accounts/{account_id}/children")
@limiter.limit("10/hour")
def add_child_profile(
    request: Request,
    account_id: str,
    req: CreateChildProfileRequest,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Add a child profile to family account"""
    try:
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/{account_id}/children/{child_id}")
def get_child_profile(
    account_id: str,
    child_id: str,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Get child profile with progress"""
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
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Get comparison report for all children"""
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
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Record learning activity for a child"""
    try:
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/goals")
@limiter.limit("20/hour")
def create_weekly_goal(
    request: Request,
    req: CreateWeeklyGoalRequest,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Create a weekly learning goal"""
    try:
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
    except Exception as e:
        logger.error("Failed to create weekly goal", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/goals/{child_id}")
def get_child_goals(
    child_id: str,
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Get all weekly goals for a child"""
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
    store: SessionStore = Depends(get_session_store)
) -> dict:
    """Award a badge to a child"""
    try:
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
        raise HTTPException(status_code=500, detail=str(e))
