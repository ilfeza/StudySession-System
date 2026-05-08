from datetime import datetime, timedelta


def test_user_progress_and_history(client, auth_headers):
    group = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'История пользователя', 'description': 'Смотрим активность'},
    ).json()

    session = client.post(
        '/api/sessions',
        headers=auth_headers,
        json={
            'group_id': group['id'],
            'title': 'Ретро по задачам',
            'description': 'Итоги недели',
            'template_key': 'team_project',
            'starts_at': (datetime.utcnow() - timedelta(days=1)).isoformat(),
        },
    ).json()

    client.get(f"/api/sessions/{session['id']}/token", headers=auth_headers)
    client.post(
        '/api/tasks',
        headers=auth_headers,
        json={
            'room_id': session['id'],
            'title': 'Подготовить выводы',
            'description': 'Зафиксировать решения',
            'priority': 'medium',
        },
    )

    progress = client.get('/api/users/me/progress', headers=auth_headers)
    assert progress.status_code == 200
    progress_body = progress.json()
    assert progress_body['full_name'] == 'Анна Тестова'
    assert progress_body['sessions_attended'] >= 1
    assert progress_body['tasks_created'] >= 1

    history = client.get('/api/users/me/history', headers=auth_headers)
    assert history.status_code == 200
    assert any(item['session_title'] == 'Ретро по задачам' for item in history.json())
