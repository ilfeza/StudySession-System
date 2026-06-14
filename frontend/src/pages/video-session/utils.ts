function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function getMediaAccessIssue() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return '';
  }

  const hasMediaApi = typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (hasMediaApi) {
    return '';
  }

  if (window.location.hostname === '0.0.0.0') {
    return 'Откройте приложение через http://localhost, а не через http://0.0.0.0. Для камеры и микрофона браузер считает localhost защищённым адресом, а 0.0.0.0 нет.';
  }

  if (!window.isSecureContext) {
    return 'Браузер разрешает доступ к камере и микрофону только на localhost или по HTTPS.';
  }

  return 'В этом браузере недоступен API для камеры и микрофона.';
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Не удалось подключиться к видеосессии.';
}

export function getDeviceLabel(device: MediaDeviceInfo, fallback: string, index: number) {
  if (device.label) {
    return device.label;
  }
  if (device.deviceId === 'default') {
    return `Системный ${fallback.toLowerCase()}`;
  }
  return `${fallback} ${index + 1}`;
}

export function formatRoomName(roomName: string) {
  return roomName.replace(/[_-]+/g, ' ').trim();
}

export function formatShortName(fullName?: string | null) {
  if (!fullName) {
    return '';
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ');
}

export function optionalDeviceId(deviceId: string): ConstrainDOMString | undefined {
  if (!deviceId || deviceId === 'default') {
    return undefined;
  }
  return { ideal: deviceId };
}

export function getLivekitServerUrl() {
  const configuredUrl = import.meta.env.VITE_LIVEKIT_URL?.trim();

  if (typeof window === 'undefined') {
    return configuredUrl && configuredUrl !== 'auto' ? configuredUrl : 'ws://localhost/livekit';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sameHostUrl = `${protocol}//${window.location.host}/livekit`;

  if (!configuredUrl || configuredUrl === 'auto') {
    return sameHostUrl;
  }

  try {
    const resolvedUrl = new URL(configuredUrl, window.location.href);
    if (isLoopbackHost(resolvedUrl.hostname) && !isLoopbackHost(window.location.hostname)) {
      return sameHostUrl;
    }
  } catch {
    return sameHostUrl;
  }

  return configuredUrl;
}
