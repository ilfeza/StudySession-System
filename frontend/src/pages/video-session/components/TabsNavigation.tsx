import VideoCallRoundedIcon from '@mui/icons-material/VideoCallRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { Box, Tab, Tabs } from '@mui/material';
import type { ReactElement } from 'react';

export type SessionView = 'video' | 'kanban' | 'chat';

const tabs: Array<{ value: SessionView; label: string; icon: ReactElement }> = [
  { value: 'video', label: 'Видеосессия', icon: <VideoCallRoundedIcon fontSize="small" /> },
  { value: 'kanban', label: 'Канбан-доска', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
  { value: 'chat', label: 'Чат', icon: <ChatBubbleOutlineRoundedIcon fontSize="small" /> },
];

export function TabsNavigation({
  value,
  onChange,
}: {
  value: SessionView;
  onChange: (value: SessionView) => void;
}) {
  return (
    <Box
      sx={{
        p: 0.5,
        borderRadius: 999,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#f8fafc',
        width: 'fit-content',
      }}
    >
      <Tabs
        value={value}
        onChange={(_, next: SessionView) => onChange(next)}
        sx={{
          minHeight: 0,
          '& .MuiTabs-flexContainer': {
            gap: 0.5,
          },
          '& .MuiTabs-indicator': {
            display: 'none',
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
            sx={{
              minHeight: 40,
              borderRadius: 999,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'text.primary',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              },
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
