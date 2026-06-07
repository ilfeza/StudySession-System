import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Autocomplete, Chip, TextField } from '@mui/material';

const skillSuggestions = [
  'python',
  'backend',
  'frontend',
  'react',
  'typescript',
  'sql',
  'аналитика',
  'ml',
  'qa',
  'testing',
  'ui',
  'ux',
  'figma',
  'презентации',
  'research',
  'docs',
  'management',
];

export function SkillsTagInput({
  value,
  onChange,
  label = 'Навыки',
  helperText = 'Выберите или добавьте навыки через теги.',
  placeholder = 'Начните вводить навык',
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={skillSuggestions}
      value={value}
      onChange={(_, next) => onChange(next.map((item) => item.trim()).filter(Boolean))}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText}
          placeholder={value.length ? undefined : placeholder}
        />
      )}
      disabled={disabled}
      popupIcon={<AddRoundedIcon fontSize="small" />}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
    />
  );
}
