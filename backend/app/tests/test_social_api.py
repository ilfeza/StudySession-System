def test_social_friendships_and_conversations(client, auth_headers):
    second_user = client.post(
        '/api/auth/register',
        json={
            'email': 'social.friend@example.com',
            'full_name': 'Ирина Соболева',
            'password': 'StrongPass123',
            'role': 'student',
            'skills': ['design'],
        },
    )
    assert second_user.status_code == 200

    users = client.get('/api/social/users', headers=auth_headers, params={'query': 'Ирина'})
    assert users.status_code == 200
    target = users.json()[0]
    assert target['full_name'] == 'Ирина Соболева'

    friendship = client.post('/api/social/friends', headers=auth_headers, json={'user_id': target['id']})
    assert friendship.status_code == 200
    assert friendship.json()['status'] == 'pending'

    direct = client.post(f"/api/social/conversations/direct/{target['id']}", headers=auth_headers)
    assert direct.status_code == 200
    conversation_id = direct.json()['id']

    message = client.post(
        f'/api/social/conversations/{conversation_id}/messages',
        headers=auth_headers,
        json={'body': 'Привет, давай обсудим группу и материалы.'},
    )
    assert message.status_code == 200

    history = client.get(f'/api/social/conversations/{conversation_id}/messages', headers=auth_headers)
    assert history.status_code == 200
    assert history.json()[-1]['body'] == 'Привет, давай обсудим группу и материалы.'


def test_friend_request_auto_accepts_when_other_user_already_sent_request(client, auth_headers):
    second_user = client.post(
        '/api/auth/register',
        json={
            'email': 'auto.accept@example.com',
            'full_name': 'Авто Принятие',
            'password': 'StrongPass123',
            'role': 'student',
            'skills': [],
        },
    ).json()

    login = client.post('/api/auth/login', json={'email': 'auto.accept@example.com', 'password': 'StrongPass123'})
    second_headers = {'Authorization': f"Bearer {login.json()['access_token']}"}

    pending = client.post('/api/social/friends', headers=second_headers, json={'user_id': 1})
    assert pending.status_code == 200
    assert pending.json()['status'] == 'pending'

    accepted = client.post('/api/social/friends', headers=auth_headers, json={'user_id': second_user['id']})
    assert accepted.status_code == 200
    assert accepted.json()['status'] == 'accepted'


def test_friend_can_be_removed(client, auth_headers):
    second_user = client.post(
        '/api/auth/register',
        json={
            'email': 'remove.friend@example.com',
            'full_name': 'Удалить Друга',
            'password': 'StrongPass123',
            'role': 'student',
            'skills': [],
        },
    ).json()

    friendship = client.post('/api/social/friends', headers=auth_headers, json={'user_id': second_user['id']})
    assert friendship.status_code == 200

    login = client.post('/api/auth/login', json={'email': 'remove.friend@example.com', 'password': 'StrongPass123'})
    second_headers = {'Authorization': f"Bearer {login.json()['access_token']}"}

    accepted = client.patch(
        f"/api/social/friends/{friendship.json()['id']}",
        headers=second_headers,
        json={'action': 'accept'},
    )
    assert accepted.status_code == 200
    assert accepted.json()['status'] == 'accepted'

    removed = client.patch(
        f"/api/social/friends/{friendship.json()['id']}",
        headers=auth_headers,
        json={'action': 'remove'},
    )
    assert removed.status_code == 200

    friendships = client.get('/api/social/friends', headers=auth_headers)
    assert all(item['id'] != friendship.json()['id'] for item in friendships.json())


def test_group_chat_can_be_created_for_member_group(client, auth_headers):
    group = client.post(
        '/api/groups',
        headers=auth_headers,
        json={'name': 'Группа для общего чата', 'description': 'Проверяем чат группы', 'visibility': 'public'},
    ).json()

    conversation = client.post(f"/api/social/conversations/group/{group['id']}", headers=auth_headers)
    assert conversation.status_code == 200
    assert conversation.json()['kind'] == 'group'
    assert conversation.json()['group_id'] == group['id']
