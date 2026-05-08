from datetime import datetime, timedelta


def test_create_update_and_delete_session_task(client, auth_headers):
    group = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Команда QA', 'description': 'Проверка задач'},
    ).json()

    session = client.post(
        '/api/sessions',
        headers=auth_headers,
        json={
            'group_id': group['id'],
            'title': 'Спринт-планирование',
            'description': 'Назначаем работу',
            'template_key': 'team_project',
            'starts_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat(),
        },
    ).json()

    client.get(f"/api/sessions/{session['id']}/token", headers=auth_headers)

    create_task = client.post(
        '/api/tasks',
        headers=auth_headers,
        json={
            'room_id': session['id'],
            'title': 'Проверить уведомления',
            'description': 'Убедиться, что индикатор сбрасывается',
            'required_skills': ['qa'],
            'priority': 'high',
        },
    )
    assert create_task.status_code == 200
    task = create_task.json()
    assert task['title'] == 'Проверить уведомления'

    update = client.patch(
        f"/api/tasks/{task['id']}",
        headers=auth_headers,
        json={'status': 'done'},
    )
    assert update.status_code == 200
    assert update.json()['status'] == 'done'
    assert update.json()['is_completed'] is True

    delete = client.delete(f"/api/tasks/{task['id']}", headers=auth_headers)
    assert delete.status_code == 200
    assert 'удалена' in delete.json()['message']
