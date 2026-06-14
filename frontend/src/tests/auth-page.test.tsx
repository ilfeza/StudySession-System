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

test('страница авторизации показывает описание платформы и форму входа', async () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </BrowserRouter>,
  );

  expect(await screen.findByText('StudySession')).toBeInTheDocument();
  expect(screen.getByText(/Учитесь вместе/i)).toBeInTheDocument();
  expect(screen.getByText('Видеосессии')).toBeInTheDocument();
  expect(screen.queryByText(/admin \/ admin/i)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Логин или email' })).toBeInTheDocument();
});
