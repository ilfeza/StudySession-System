import { Stack, TextField } from '@mui/material';

import { useEffect, useState } from 'react';



import { deadlineToParts, formatTimePart, nowDeadlineParts, partsToDeadlineIso } from './deadlineField';



export function DeadlineInput({

  value,

  onChange,

  disabled = false,

}: {

  value: string;

  onChange: (next: string) => void;

  disabled?: boolean;

}) {

  const parts = deadlineToParts(value);

  const [datePart, setDatePart] = useState(parts.date);

  const [timePart, setTimePart] = useState(parts.time);



  useEffect(() => {

    const next = deadlineToParts(value);

    setDatePart(next.date);

    setTimePart(next.time);

  }, [value]);



  function sync(nextDate: string, nextTime: string) {

    setDatePart(nextDate);

    setTimePart(nextTime);

    if (!nextDate.trim() && !nextTime.trim()) {

      onChange('');

      return;

    }

    const iso = partsToDeadlineIso(nextDate, nextTime);

    if (iso) {

      onChange(iso);

    }

  }



  function handleFocus() {

    if (datePart && timePart) {

      return;

    }

    const now = nowDeadlineParts();

    sync(now.date, now.time);

  }



  function handleTimeBlur() {

    if (!timePart.trim()) {

      return;

    }

    const formatted = formatTimePart(timePart);

    if (formatted !== timePart) {

      sync(datePart, formatted);

    }

  }



  return (

    <Stack direction="row" spacing={1}>

      <TextField

        label="Дата"

        placeholder="ДД.ММ"

        value={datePart}

        onFocus={handleFocus}

        onChange={(event) => sync(event.target.value, timePart)}

        disabled={disabled}

        fullWidth

        InputLabelProps={{ shrink: true }}

        inputProps={{ inputMode: 'numeric' }}

      />

      <TextField

        label="Время"

        placeholder="13:00"

        value={timePart}

        onFocus={handleFocus}

        onChange={(event) => sync(datePart, event.target.value)}

        onBlur={handleTimeBlur}

        disabled={disabled}

        fullWidth

        InputLabelProps={{ shrink: true }}

        inputProps={{ inputMode: 'numeric' }}

      />

    </Stack>

  );

}


