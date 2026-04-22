from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import AnnouncementCreate, AnnouncementFeedItem
from app.services.announcement_service import AnnouncementService

router = APIRouter()


def _to_feed_item(row) -> AnnouncementFeedItem:
    return AnnouncementFeedItem(
        id=row.id,
        group_id=row.group_id,
        group_name=row.group.name,
        author_name=row.author.full_name,
        body=row.body,
        created_at=row.created_at,
    )


@router.get('/announcements', response_model=list[AnnouncementFeedItem])
def announcement_feed(
    limit: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = AnnouncementService(db).list_feed(user, limit=limit)
    return [_to_feed_item(r) for r in rows]


@router.post('/announcements', response_model=AnnouncementFeedItem, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_group_member(payload.group_id, user, db)
    try:
        row = AnnouncementService(db).create(payload.group_id, payload.body, user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_feed_item(row)
