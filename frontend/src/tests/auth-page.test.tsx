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

test('auth page renders russian labels', () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </BrowserRouter>,
  );

  expect(screen.getByText('Платформа совместной работы')).toBeInTheDocument();
  expect(screen.getByText('Вход')).toBeInTheDocument();
});
