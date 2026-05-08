def test_create_join_and_read_groups(client, auth_headers):
    create = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Инженерная группа', 'description': 'Работаем над релизом'},
    )
    assert create.status_code == 200
    group = create.json()
    assert group['name'] == 'Инженерная группа'

    listing = client.get('/api/groups', headers=auth_headers)
    assert listing.status_code == 200
    assert any(item['id'] == group['id'] for item in listing.json())

    detail = client.get(f"/api/groups/{group['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()['description'] == 'Работаем над релизом'


def test_join_group_rejects_duplicate_membership(client, auth_headers):
    create = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Продуктовая группа', 'description': 'Внутренние созвоны'},
    )
    group_id = create.json()['id']

    join_again = client.post(f'/api/groups/{group_id}/join', headers=auth_headers)
    assert join_again.status_code == 400
    assert 'уже состоите' in join_again.json()['detail']
