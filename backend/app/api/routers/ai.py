from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ensure_session_member, get_current_user
from app.db.session import get_db
from app.schemas import AiGenerateTasksRequest, AiGeneratedTaskRead
from app.services.ai_task_service import AiTaskService

router = APIRouter()


@router.post('/generate-tasks', response_model=list[AiGeneratedTaskRead])
async def generate_tasks(
    payload: AiGenerateTasksRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if payload.room_id is not None:
        ensure_session_member(payload.room_id, user, db)

    items = await AiTaskService().generate_tasks(
        room_title=payload.room_title,
        description=payload.description,
        messages=[item.model_dump(by_alias=True) for item in payload.messages],
    )
    return [AiGeneratedTaskRead.model_validate(item) for item in items]
