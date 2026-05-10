from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import SessionParticipant, SessionTaskStatus, Task, TaskPriority, User, VideoSession
from app.repositories.task_repository import TaskRepository
from app.services.assignment_service import AssignmentService
from app.services.session_stage_service import SessionStageService


class TaskService:
    def __init__(self, db: Session):
        self.repo = TaskRepository(db)
        self.assignment_service = AssignmentService(db)
        self.stage_service = SessionStageService(db)

    def create_task(self, group_id: int, title: str, description: str, required_skills: list[str], priority, deadline, user_id: int):
        task = Task(
            group_id=group_id,
            title=title,
            description=description,
            required_skills=self._normalize_skills(required_skills),
            priority=priority,
            deadline=deadline,
            created_by_id=user_id,
        )
        task = self.repo.create_task(task)
        assignment = self.assignment_service.assign_task(task)
        return task, assignment

    def create_session_task(self, session: VideoSession, creator: User, payload: dict) -> Task:
        status_value = self._normalize_status(payload.get('status', SessionTaskStatus.backlog))
        assignee_id = payload.get('assignee_id')
        task = Task(
            group_id=session.group_id,
            session_id=session.id,
            title=payload['title'],
            description=payload.get('description', ''),
            required_skills=self._normalize_skills(payload.get('required_skills', [])),
            priority=payload.get('priority', TaskPriority.medium),
            deadline=payload.get('deadline'),
            created_by_id=creator.id,
            assignee_id=assignee_id,
            status=status_value,
            is_completed=status_value == SessionTaskStatus.done,
        )
        self._apply_session_workflow_rules(session.id, task, previous_status=None)
        created = self.repo.create_task(task)
        self.stage_service.sync_stage_for_session(session.id)
        return created

    def list_tasks(self, group_id: int):
        return self.repo.list_group_tasks(group_id)

    def list_session_tasks(self, session_id: int):
        self.stage_service.sync_stage_for_session(session_id)
        return self.repo.list_session_tasks(session_id)

    def update_task(self, task_id: int, payload: dict):
        task = self.repo.get_task(task_id)
        if not task:
            raise ValueError('Задача не найдена.')

        for key, value in payload.items():
            if value is None:
                continue
            if key == 'required_skills':
                value = self._normalize_skills(value)
            setattr(task, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(task)
        return task

    def update_session_task(self, task_id: int, payload: dict) -> Task:
        task = self.repo.get_task(task_id)
        if not task or task.session_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Задача не найдена.')

        previous_status = task.status
        for key, value in payload.items():
            if key == 'required_skills' and value is not None:
                value = self._normalize_skills(value)
            setattr(task, key, value)

        task.status = self._normalize_status(task.status)
        self._apply_session_workflow_rules(task.session_id, task, previous_status=previous_status)
        self.repo.db.commit()
        self.repo.db.refresh(task)
        self.stage_service.sync_stage_for_session(task.session_id)
        return task

    def delete_session_task(self, task_id: int) -> Task:
        task = self.repo.get_task(task_id)
        if not task or task.session_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Задача не найдена.')
        session_id = task.session_id
        self.repo.delete_task(task)
        self.stage_service.sync_stage_for_session(session_id)
        return task

    def build_assignment_metadata(self, task: Task) -> tuple[str, str]:
        if task.session_id is None:
            return '', ''

        workflow_stage = self.stage_service._derive_stage(task.session_id).value
        suggestion = None
        if task.status in {SessionTaskStatus.backlog, SessionTaskStatus.assigned}:
            suggestion = self.assignment_service.suggest_session_assignee(task.session_id, task)

        if task.assignee_id is None and suggestion is not None:
            assignment_status = suggestion['reason']
        elif task.assignee is not None:
            assignment_status = f'Назначено: {task.assignee.full_name}'
        else:
            assignment_status = 'Ожидает распределения'
        return workflow_stage, assignment_status

    def _apply_session_workflow_rules(self, session_id: int, task: Task, previous_status: SessionTaskStatus | None) -> None:
        if task.assignee_id is not None:
            self._ensure_session_assignee(session_id, int(task.assignee_id))
            self.assignment_service.ensure_user_can_take_task(session_id, int(task.assignee_id), task.id)

        if task.assignee_id is not None and task.status == SessionTaskStatus.backlog:
            task.status = SessionTaskStatus.assigned

        if task.status == SessionTaskStatus.backlog:
            task.assignee_id = None
        elif task.status == SessionTaskStatus.assigned:
            if task.assignee_id is None:
                suggestion = self.assignment_service.suggest_session_assignee(session_id, task)
                if suggestion is None:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нет доступного исполнителя для назначения.')
                task.assignee_id = suggestion['user'].id
        elif task.status in {SessionTaskStatus.in_progress, SessionTaskStatus.blocked}:
            if task.assignee_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Для выполнения задачи нужен назначенный исполнитель.')
        elif task.status == SessionTaskStatus.done and task.assignee_id is None and previous_status != SessionTaskStatus.backlog:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нельзя завершить задачу без исполнителя.')

        task.is_completed = task.status == SessionTaskStatus.done

    def _ensure_session_assignee(self, session_id: int, assignee_id: int) -> SessionParticipant:
        participant = (
            self.repo.db.query(SessionParticipant)
            .filter(SessionParticipant.session_id == session_id, SessionParticipant.user_id == assignee_id)
            .first()
        )
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Исполнителем можно назначить только участника текущей видеосессии.',
            )
        return participant

    @staticmethod
    def _normalize_skills(required_skills: list[str]) -> str:
        return ','.join(sorted({skill.strip().lower() for skill in required_skills if skill.strip()}))

    @staticmethod
    def _normalize_status(status_value: SessionTaskStatus | str) -> SessionTaskStatus:
        if isinstance(status_value, SessionTaskStatus):
            return status_value
        try:
            return SessionTaskStatus(str(status_value))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Неизвестный статус задачи.') from exc
