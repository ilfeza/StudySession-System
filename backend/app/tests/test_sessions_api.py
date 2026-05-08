from datetime import datetime, timedelta


def test_create_session_and_fetch_token_and_participants(client, auth_headers):
    group = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Учебная группа', 'description': 'Подготовка к занятию'},
    ).json()

    create_session = client.post(
        '/api/sessions',
        headers=auth_headers,
        json={
            'group_id': group['id'],
            'title': 'Разбор домашнего задания',
            'description': 'Проверяем прогресс',
            'template_key': 'topic_review',
            'starts_at': (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        },
    )
    assert create_session.status_code == 200
    session = create_session.json()

    token = client.get(f"/api/sessions/{session['id']}/token", headers=auth_headers)
    assert token.status_code == 200
    token_payload = token.json()
    assert token_payload['room_name']
    assert token_payload['participant_name'] == 'Анна Тестова'
    assert isinstance(token_payload['can_control_stage'], bool)

    participants = client.get(f"/api/sessions/{session['id']}/participants", headers=auth_headers)
    assert participants.status_code == 200
    assert any(item['full_name'] == 'Анна Тестова' for item in participants.json())
