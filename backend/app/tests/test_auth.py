def test_register_and_login(client):
    register = client.post(
        '/api/auth/register',
        json={
            'email': 'student@example.com',
            'full_name': 'Иван Студент',
            'password': 'secret123',
            'role': 'student',
            'skills': ['python', 'sql'],
        },
    )
    assert register.status_code == 200
    assert register.json()['email'] == 'student@example.com'

    login = client.post('/api/auth/login', json={'email': 'student@example.com', 'password': 'secret123'})
    assert login.status_code == 200
    body = login.json()
    assert 'access_token' in body
    assert body['message'] == 'Успешная авторизация.'
