from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import File


class FileService:
    def __init__(self, db: Session, upload_dir: str):
        self.db = db
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, uploaded_by_id: int, file: UploadFile, task_id: int | None = None) -> File:
        suffix = Path(file.filename).suffix.lower()
        stored_name = f'{uuid4().hex}{suffix}'
        target = self.upload_dir / stored_name

        content = await file.read()
        target.write_bytes(content)

        model = File(
            task_id=task_id,
            uploaded_by_id=uploaded_by_id,
            original_name=file.filename,
            stored_name=stored_name,
            mime_type=file.content_type or 'application/octet-stream',
            size_bytes=len(content),
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model
