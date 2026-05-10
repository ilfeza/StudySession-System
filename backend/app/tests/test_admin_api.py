def _create_admin(client):
    created = client.post(
        '/api/auth/register',
        json={
            'email': 'admin@example.com',
            'full_name': 'Главный администратор',
            'password': 'admin123',
            'role': 'admin',
            'skills': ['admin'],
        },
    )
    assert created.status_code == 200
    login = client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'})
    assert login.status_code == 200
    return {'Authorization': f"Bearer {login.json()['access_token']}"}


def test_admin_can_manage_analytics_users_and_groups(client):
    admin_headers = _create_admin(client)

    member = client.post(
        '/api/auth/register',
        json={
            'email': 'member2@example.com',
            'full_name': 'Участник Группы',
            'password': 'secret123',
            'role': 'student',
            'skills': ['ui'],
        },
    ).json()

    group = client.post(
        '/api/groups',
        headers=admin_headers,
        json={'name': 'Группа админа', 'description': 'Для проверки админки', 'visibility': 'public'},
    ).json()
    added = client.post(
        f"/api/groups/{group['id']}/members",
        headers=admin_headers,
        json={'user_id': member['id'], 'can_moderate': False},
    )
    assert added.status_code == 200

    overview = client.get('/api/admin/analytics', headers=admin_headers)
    assert overview.status_code == 200
    assert overview.json()['total_users'] >= 2

    analyst = client.post(
        '/api/admin/users',
        headers=admin_headers,
        json={
            'email': 'analyst@example.com',
            'full_name': 'Аналитик Платформы',
            'password': 'secret123',
            'role': 'analyst',
            'skills': ['analytics'],
            'is_active': True,
        },
    )
    assert analyst.status_code == 201
    assert analyst.json()['role'] == 'analyst'

    updated_user = client.patch(
        f"/api/admin/users/{member['id']}",
        headers=admin_headers,
        json={'is_active': False, 'role': 'student', 'skills': ['qa']},
    )
    assert updated_user.status_code == 200

    groups = client.get('/api/admin/groups', headers=admin_headers)
    assert groups.status_code == 200
    assert any(item['id'] == group['id'] for item in groups.json())

    group_after_moderation = client.patch(
        f"/api/admin/groups/{group['id']}/members/{member['id']}",
        headers=admin_headers,
        json={'can_moderate': True},
    )
    assert group_after_moderation.status_code == 200
    matching_group = next(item for item in group_after_moderation.json()['members'] if item['user_id'] == member['id'])
    assert matching_group['can_moderate'] is True

    group_after_update = client.patch(
        f"/api/admin/groups/{group['id']}",
        headers=admin_headers,
        json={'description': 'Обновлено администратором', 'visibility': 'private'},
    )
    assert group_after_update.status_code == 200
    assert group_after_update.json()['visibility'] == 'private'


def test_analyst_can_only_read_admin_analytics(client):
    admin_headers = _create_admin(client)
    analyst = client.post(
        '/api/admin/users',
        headers=admin_headers,
        json={
            'email': 'readonly-analyst@example.com',
            'full_name': 'Только чтение',
            'password': 'secret123',
            'role': 'analyst',
            'skills': ['analytics'],
        },
    ).json()

    analyst_login = client.post('/api/auth/login', json={'email': analyst['email'], 'password': 'secret123'})
    analyst_headers = {'Authorization': f"Bearer {analyst_login.json()['access_token']}"}

    overview = client.get('/api/admin/analytics', headers=analyst_headers)
    assert overview.status_code == 200

    users = client.get('/api/admin/users', headers=analyst_headers)
    assert users.status_code == 403

    groups = client.get('/api/admin/groups', headers=analyst_headers)
    assert groups.status_code == 200

    update_group = client.patch('/api/admin/groups/1', headers=analyst_headers, json={'name': 'Нет доступа'})
    assert update_group.status_code == 403
