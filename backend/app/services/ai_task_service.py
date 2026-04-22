import json
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

TASKS_JSON_SCHEMA = {
    'type': 'object',
    'properties': {
        'tasks': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'assignee': {'type': ['string', 'null']},
                },
                'required': ['title', 'description', 'assignee'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['tasks'],
    'additionalProperties': False,
}


class AiTaskService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def build_prompt(self, room_title: str, description: str, messages: list[dict[str, str]]) -> str:
        normalized_title = room_title.strip() or 'Учебная видеосессия'
        normalized_description = description.strip() or 'Описание не указано.'
        chat_lines = self._normalize_messages(messages)
        chat_block = '\n'.join(chat_lines) if chat_lines else 'Сообщений пока нет.'

        return (
            'Ты помогаешь студентам после учебной видеосессии.\n'
            'На основе названия комнаты, описания и переписки выдели только реальные следующие задачи.\n'
            'Не придумывай лишние задачи. Не дублируй одинаковые пункты. Верни от 1 до 8 задач.\n'
            'Если исполнитель неочевиден, укажи null.\n'
            'Описание каждой задачи должно быть коротким и практичным, максимум 2 предложения.\n\n'
            f'Название комнаты:\n{normalized_title}\n\n'
            f'Описание сессии:\n{normalized_description}\n\n'
            f'Чат сессии:\n{chat_block}\n'
        )

    async def generate_tasks(self, room_title: str, description: str, messages: list[dict[str, str]]) -> list[dict[str, str | None]]:
        if not self.settings.openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail='AI-генерация недоступна: не настроен OPENAI_API_KEY.',
            )

        url = f"{self.settings.openai_base_url.rstrip('/')}/responses"
        payload = {
            'model': self.settings.openai_model,
            'input': [
                {
                    'role': 'system',
                    'content': (
                        'Ты генерируешь список задач по итогам учебного обсуждения. '
                        'Возвращай только валидный JSON по заданной схеме.'
                    ),
                },
                {
                    'role': 'user',
                    'content': self.build_prompt(room_title, description, messages),
                },
            ],
            'text': {
                'format': {
                    'type': 'json_schema',
                    'name': 'session_tasks',
                    'strict': True,
                    'schema': TASKS_JSON_SCHEMA,
                },
            },
        }
        headers = {
            'Authorization': f'Bearer {self.settings.openai_api_key}',
            'Content-Type': 'application/json',
        }

        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail='Не удалось связаться с AI API.',
            ) from exc

        if response.status_code >= 400:
            detail = 'AI API вернул ошибку.'
            try:
                error_payload = response.json()
                detail = error_payload.get('error', {}).get('message') or detail
            except Exception:
                pass
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        try:
            data = response.json()
            parsed = json.loads(self._extract_text_output(data))
            tasks = parsed.get('tasks', [])
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail='AI вернул ответ в неожиданном формате.',
            ) from exc

        normalized_tasks: list[dict[str, str | None]] = []
        for item in tasks[:8]:
            title = str(item.get('title', '')).strip()
            description_value = str(item.get('description', '')).strip()
            assignee_raw = item.get('assignee')
            assignee = str(assignee_raw).strip() if assignee_raw else None
            if not title:
                continue
            normalized_tasks.append(
                {
                    'title': title[:200],
                    'description': description_value[:1000],
                    'assignee': assignee[:255] if assignee else None,
                },
            )

        return normalized_tasks

    def _normalize_messages(self, messages: list[dict[str, str]]) -> list[str]:
        lines: list[str] = []
        total_chars = 0

        for item in messages[-80:]:
            sender = str(item.get('sender_name') or item.get('senderName') or 'Участник').strip() or 'Участник'
            text = str(item.get('message', '')).strip()
            if not text:
                continue
            line = f'{sender}: {text}'
            total_chars += len(line)
            if total_chars > 12000:
                break
            lines.append(line)

        return lines

    def _extract_text_output(self, data: dict[str, Any]) -> str:
        output_text = data.get('output_text')
        if isinstance(output_text, str) and output_text.strip():
            return output_text

        for item in data.get('output', []):
            for content in item.get('content', []):
                text_value = content.get('text')
                if isinstance(text_value, str) and text_value.strip():
                    return text_value
                if isinstance(text_value, dict):
                    value = text_value.get('value')
                    if isinstance(value, str) and value.strip():
                        return value

        raise ValueError('Empty response output')
