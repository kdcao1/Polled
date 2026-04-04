const GOOGLE_ENV_KEYS = {
  webClientId: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  iosClientId: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  androidClientId: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
} as const;

type GoogleAuthConfig = Record<keyof typeof GOOGLE_ENV_KEYS, string>;

const readEnv = (key: string) => process.env[key]?.trim() ?? '';

export const googleAuthConfig: GoogleAuthConfig = {
  webClientId: readEnv(GOOGLE_ENV_KEYS.webClientId),
  iosClientId: readEnv(GOOGLE_ENV_KEYS.iosClientId),
  androidClientId: readEnv(GOOGLE_ENV_KEYS.androidClientId),
};

export const hasGoogleAuthConfig = Object.values(googleAuthConfig).every(Boolean);

if (!hasGoogleAuthConfig) {
  console.warn(
    `Google auth is missing one or more EXPO_PUBLIC client IDs: ${Object.values(
      GOOGLE_ENV_KEYS
    ).join(', ')}`
  );
}
