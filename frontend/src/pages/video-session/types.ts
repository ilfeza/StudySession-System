export interface TokenResponse {
  room_name: string;
  participant_name: string;
  token: string;
  can_control_stage?: boolean;
}

export interface JoinPreferences {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
}

export const defaultJoinPreferences: JoinPreferences = {
  audioEnabled: false,
  videoEnabled: false,
  audioDeviceId: 'default',
  videoDeviceId: 'default',
};
