import type { UserRole } from '../types';

export function roleLabel(role?: UserRole) {
  switch (role) {
    case 'admin':
      return 'Администратор';
    case 'instructor':
      return 'Куратор';
    case 'analyst':
      return 'Аналитик';
    case 'student':
    default:
      return 'Участник';
  }
}
