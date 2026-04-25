const GOOGLE_ENV_KEYS = {
  webClientId: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  iosClientId: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  androidClientId: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
} as const;

type GoogleAuthConfig = Record<keyof typeof GOOGLE_ENV_KEYS, string>;

export const googleAuthConfig: GoogleAuthConfig = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '',
};

export const analyticsConfig = {
  ingestUrl: process.env.EXPO_PUBLIC_ANALYTICS_INGEST_URL?.trim() ?? '',
};

export const hasGoogleAuthConfig = Object.values(googleAuthConfig).every(Boolean);

if (!hasGoogleAuthConfig) {
  console.warn(
    `Google auth is missing one or more EXPO_PUBLIC client IDs: ${Object.values(
      GOOGLE_ENV_KEYS
    ).join(', ')}`
  );
}
