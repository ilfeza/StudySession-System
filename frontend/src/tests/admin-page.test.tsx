import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AdminOverviewPage } from '../pages/admin/AdminOverviewPage';

const mockUseAuth = vi.fn();
const mockGet = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

test('аналитик видит аналитику на странице обзора', async () => {
  mockUseAuth.mockReturnValue({ user: { role: 'analyst' } });
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/analytics') {
      return Promise.resolve({
        data: {
          total_users: 10,
          active_users: 8,
          total_groups: 4,
          private_groups: 1,
          total_friendships: 6,
          active_sessions: 2,
          completed_tasks: 12,
          pending_tasks: 5,
          role_distribution: { analyst: 1, admin: 1, student: 8 },
          top_groups: [{ id: 1, name: 'Команда 1', member_count: 5 }],
          recent_users: [{ id: 1, full_name: 'Иван Петров', email: 'ivan@example.com', role: 'student', is_online: false, current_status: 'Нет активной сессии', is_active: true }],
        },
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <AdminOverviewPage />
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText('Распределение ролей')).toBeInTheDocument());
});
