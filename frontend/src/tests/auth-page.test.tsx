import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '../context/AuthContext';
import { AuthPage } from '../pages/AuthPage';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(() => Promise.reject(new Error('Нет токена'))),
    post: vi.fn(),
  },
}));

test('страница авторизации показывает русские подписи и подсказку для admin', async () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </BrowserRouter>,
  );

  expect(await screen.findByText('Платформа StudySession')).toBeInTheDocument();
  expect(screen.getByText('Вход в рабочее пространство')).toBeInTheDocument();
  expect(screen.getByText(/admin \/ admin/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Логин или email' })).toBeInTheDocument();
});
