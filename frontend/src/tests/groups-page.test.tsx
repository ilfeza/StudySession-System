import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { GroupsPage } from '../pages/GroupsPage';

const mockGet = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../components/materials/MaterialsPanel', () => ({
  MaterialsPanel: ({ groupId }: { groupId: number }) => <div>Материалы группы #{groupId}</div>,
}));

test('страница групп показывает русскую навигацию и детали выбранной группы', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url === '/groups' || url === '/groups/catalog') {
      return Promise.resolve({
        data: [
          {
            id: 1,
            name: 'Группа тестирования',
            description: 'Описание группы',
            owner_id: 1,
            visibility: 'public',
            invite_key: 'TEST01',
            created_at: '2026-05-10T12:00:00Z',
          },
        ],
      });
    }
    if (url === '/social/friends' || url === '/social/conversations') {
      return Promise.resolve({ data: [] });
    }
    if (url === '/social/users') {
      return Promise.resolve({
        data: [
          {
            id: 2,
            full_name: 'Елена Смирнова',
            email: 'friend@example.com',
            role: 'student',
            is_online: false,
            current_status: 'Свободен',
            is_active: true,
          },
        ],
      });
    }
    if (url === '/sessions/group/1') {
      return Promise.resolve({ data: [] });
    }
    if (url === '/groups/1/history') {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Группы и сообщество')).toBeInTheDocument();
  expect(screen.getByText('Поиск')).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText('Группа тестирования').length).toBeGreaterThan(0));
  expect(screen.getByText('Ключ для приглашения: TEST01')).toBeInTheDocument();
});
