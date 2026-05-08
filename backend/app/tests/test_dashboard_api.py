def test_dashboard_announcements_flow(client, auth_headers):
    group = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Группа объявлений', 'description': 'Следим за новостями'},
    ).json()

    created = client.post(
        '/api/dashboard/announcements',
        headers=auth_headers,
        json={'group_id': group['id'], 'body': 'В пятницу переносим встречу на 18:00.'},
    )
    assert created.status_code == 201
    assert created.json()['group_name'] == 'Группа объявлений'

    feed = client.get('/api/dashboard/announcements', headers=auth_headers)
    assert feed.status_code == 200
    assert any(item['body'] == 'В пятницу переносим встречу на 18:00.' for item in feed.json())
