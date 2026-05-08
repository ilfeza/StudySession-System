import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import VideoCallRoundedIcon from '@mui/icons-material/VideoCallRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import { Box, Tab, Tabs } from '@mui/material';
import type { ReactElement } from 'react';

export type SessionView = 'video' | 'board' | 'chat';

const tabs: Array<{ value: SessionView; label: string; icon: ReactElement }> = [
  { value: 'video', label: 'Звонок', icon: <VideoCallRoundedIcon fontSize="small" /> },
  { value: 'board', label: 'Доска', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
  { value: 'chat', label: 'Чат', icon: <ChatBubbleOutlineRoundedIcon fontSize="small" /> },
];

const TAB_HEIGHT = 44;

export function TopTabs({
  value,
  onChange,
}: {
  value: SessionView;
  onChange: (value: SessionView) => void;
}) {
  return (
    <Box
      sx={{
        p: '4px',
        borderRadius: '16px',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#f8fafc',
        width: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <Tabs
        value={value}
        onChange={(_, next: SessionView) => onChange(next)}
        sx={{
          minHeight: TAB_HEIGHT,
          '& .MuiTabs-flexContainer': {
            gap: '4px',
            alignItems: 'center',
          },
          '& .MuiTabs-indicator': { display: 'none' },
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
              minHeight: `${TAB_HEIGHT}px`,
              height: `${TAB_HEIGHT}px`,
              px: '16px',
              py: 0,
              gap: '8px',
              borderRadius: '12px',
              color: 'text.secondary',
              boxSizing: 'border-box',
              '& .MuiTab-iconWrapper': {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
              },
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
