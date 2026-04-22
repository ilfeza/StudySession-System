from fastapi import APIRouter, Depends, File as FastAPIFile, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import File
from app.schemas import FileRead
from app.services.file_service import FileService

router = APIRouter()


@router.post('/upload', response_model=FileRead)
async def upload_file(
    task_id: int | None = None,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    service = FileService(db, get_settings().uploads_dir)
    model = await service.save(user.id, file, task_id)
    return FileRead.model_validate(model)


@router.get('', response_model=list[FileRead])
def list_files(db: Session = Depends(get_db), _=Depends(get_current_user)):
    files = db.query(File).order_by(File.created_at.desc()).limit(200).all()
    return [FileRead.model_validate(item) for item in files]
