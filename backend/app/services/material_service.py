from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import GroupMaterial, GroupMaterialKind


class MaterialService:
    def __init__(self, db: Session, upload_dir: str):
        self.db = db
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def list_group_materials(self, group_id: int) -> list[GroupMaterial]:
        return (
            self.db.query(GroupMaterial)
            .filter(GroupMaterial.group_id == group_id)
            .order_by(GroupMaterial.created_at.desc())
            .all()
        )

    def create_link(self, group_id: int, user_id: int, title: str, url: str) -> GroupMaterial:
        model = GroupMaterial(
            group_id=group_id,
            uploaded_by_id=user_id,
            title=title,
            kind=GroupMaterialKind.link,
            url=url,
            stored_name=f'group-link-{uuid4().hex}',
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    async def upload_pdf(self, group_id: int, user_id: int, title: str, file: UploadFile) -> GroupMaterial:
        suffix = Path(file.filename or '').suffix.lower() or '.pdf'
        stored_name = f'group-material-{uuid4().hex}{suffix}'
        target = self.upload_dir / stored_name

        content = await file.read()
        target.write_bytes(content)

        model = GroupMaterial(
            group_id=group_id,
            uploaded_by_id=user_id,
            title=title,
            kind=GroupMaterialKind.pdf,
            original_name=file.filename or title,
            stored_name=stored_name,
            mime_type=file.content_type or 'application/pdf',
            size_bytes=len(content),
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model
