import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../api/client';
import type { GroupMaterial } from '../../types';

function formatFileSize(sizeBytes: number) {
  if (!sizeBytes) {
    return 'Ссылка';
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }
  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
}

export function MaterialsPanel({
  groupId,
  compact = false,
}: {
  groupId: number;
  compact?: boolean;
}) {
  const [materials, setMaterials] = useState<GroupMaterial[]>([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<GroupMaterial[]>(`/groups/${groupId}/materials`);
      setMaterials(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материалы.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  async function handleAddLink() {
    if (!title.trim() || !url.trim()) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await api.post<GroupMaterial>(`/groups/${groupId}/materials/link`, {
        title: title.trim(),
        url: url.trim(),
      });
      setMaterials((prev) => [response.data, ...prev]);
      setTitle('');
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить ссылку.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadPdf() {
    if (!file || !fileTitle.trim()) {
      return;
    }
    const formData = new FormData();
    formData.append('title', fileTitle.trim());
    formData.append('file', file);
    setSubmitting(true);
    setError('');
    try {
      const response = await api.post<GroupMaterial>(`/groups/${groupId}/materials/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMaterials((prev) => [response.data, ...prev]);
      setFile(null);
      setFileTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить PDF.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>
      <Paper
        sx={{
          p: compact ? 1.25 : 2,
          borderRadius: 4,
          background: compact ? alpha('#ffffff', 0.04) : 'rgba(255,255,255,0.86)',
          color: compact ? '#ffffff' : 'text.primary',
          border: `1px solid ${compact ? alpha('#ffffff', 0.08) : '#dbe4f0'}`,
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="h6" fontWeight={800}>
            Материалы
          </Typography>
          <Typography variant="body2" sx={{ color: compact ? alpha('#ffffff', 0.7) : 'text.secondary' }}>
            PDF и полезные ссылки комнаты доступны всем участникам прямо во время сессии.
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              label="Название ссылки"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              fullWidth
              size="small"
            />
            <Button variant="contained" onClick={() => void handleAddLink()} disabled={submitting || !title.trim() || !url.trim()}>
              Добавить материал
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              label="Название PDF"
              value={fileTitle}
              onChange={(event) => setFileTitle(event.target.value)}
              fullWidth
              size="small"
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileRoundedIcon />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {file ? file.name : 'Выбрать PDF'}
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Button variant="contained" onClick={() => void handleUploadPdf()} disabled={submitting || !file || !fileTitle.trim()}>
              Загрузить PDF
            </Button>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}
        </Stack>
      </Paper>

      <Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          <Typography variant="body2" sx={{ color: compact ? alpha('#ffffff', 0.7) : 'text.secondary' }}>
            Загружаем материалы...
          </Typography>
        ) : null}
        {!loading && materials.length === 0 ? (
          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              textAlign: 'center',
              background: compact ? alpha('#ffffff', 0.04) : 'rgba(255,255,255,0.8)',
              border: `1px dashed ${compact ? alpha('#ffffff', 0.16) : '#d6e0ee'}`,
            }}
          >
            <Typography variant="body2" sx={{ color: compact ? alpha('#ffffff', 0.7) : 'text.secondary' }}>
              Пока нет материалов. Добавьте первый PDF или ссылку.
            </Typography>
          </Paper>
        ) : null}
        {materials.map((material) => (
          <Paper
            key={material.id}
            sx={{
              p: 1.5,
              borderRadius: 3.5,
              background: compact
                ? 'linear-gradient(180deg, rgba(22, 39, 68, 0.96) 0%, rgba(10, 18, 32, 0.96) 100%)'
                : 'rgba(255,255,255,0.92)',
              border: `1px solid ${compact ? alpha('#ffffff', 0.08) : '#dde6f2'}`,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <Typography fontWeight={800} sx={{ color: compact ? '#ffffff' : 'text.primary' }}>
                  {material.title}
                </Typography>
                <Chip
                  size="small"
                  label={material.kind === 'pdf' ? 'PDF' : 'Ссылка'}
                  icon={material.kind === 'pdf' ? <PictureAsPdfRoundedIcon /> : <LinkRoundedIcon />}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: compact ? alpha('#ffffff', 0.62) : 'text.secondary' }}>
                {new Date(material.created_at).toLocaleString('ru-RU')} · {formatFileSize(material.size_bytes)}
              </Typography>
              <Box>
                <Button
                  variant={compact ? 'outlined' : 'contained'}
                  href={material.kind === 'pdf' ? material.file_url : material.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть
                </Button>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
