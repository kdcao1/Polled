import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app, auth } from '@/config/firebaseConfig';
import { analyticsConfig } from '@/config/env';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;
type GtagFunction = (...args: any[]) => void;
type StoredAnalyticsRecord = {
  id: string;
  name: string;
  params: Record<string, string | number>;
  createdAt: string;
  platform: string;
  kind: 'event' | 'screen_view';
  delivery: 'pending' | 'sent' | 'local_only' | 'failed';
  failureReason?: string;
};
type StoredJourney = {
  startedAt: number;
  params: Record<string, string | number>;
};

let analyticsPromise: Promise<any | null> | null = null;
let debugModeConfigured = false;
let persistQueue: Promise<void> = Promise.resolve();

const LOCAL_ANALYTICS_STORAGE_KEY = 'polled_local_analytics_events';
const MAX_LOCAL_ANALYTICS_EVENTS = 500;
const JOURNEY_STORAGE_PREFIX = 'polled_analytics_journey:';
const FLAG_STORAGE_PREFIX = 'polled_analytics_flag:';
const COUNTER_STORAGE_PREFIX = 'polled_analytics_counter:';

const isDebugAnalyticsEnabled = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  try {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      window.localStorage.getItem('polled_analytics_debug') === '1'
    );
  } catch {
    return false;
  }
};

const sanitizeParams = (params: AnalyticsParams = {}) =>
  Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === undefined || value === null) return [];
      if (typeof value === 'boolean') return [[key, value ? 'true' : 'false']];
      return [[key, value]];
    })
  ) as Record<string, string | number>;

const enableDebugModeIfNeeded = () => {
  if (!isDebugAnalyticsEnabled() || debugModeConfigured || typeof window === 'undefined') {
    return;
  }

  const measurementId = app.options.measurementId;
  const gtag = (window as Window & { gtag?: GtagFunction }).gtag;

  if (!measurementId || typeof gtag !== 'function') {
    return;
  }

  // Configure GA's actual debug mode on the web runtime, not just a custom event param.
  gtag('set', 'debug_mode', true);
  gtag('config', measurementId, { debug_mode: true });
  debugModeConfigured = true;
};

const getAnalyticsInstance = async () => {
  if (Platform.OS !== 'web') return null;

  if (!analyticsPromise) {
    analyticsPromise = import('firebase/analytics')
      .then(async ({ getAnalytics, isSupported }) => {
        const supported = await isSupported();
        if (!supported) return null;

        const analytics = getAnalytics(app);
        enableDebugModeIfNeeded();
        return analytics;
      })
      .catch((error) => {
        console.error('Analytics unavailable:', error);
        return null;
      });
  }

  return analyticsPromise;
};

const isServerAnalyticsEnabled = () => Boolean(analyticsConfig.ingestUrl);

const sendAnalyticsToServer = async (
  kind: StoredAnalyticsRecord['kind'],
  name: string,
  params: Record<string, string | number>
) => {
  const ingestUrl = analyticsConfig.ingestUrl;
  if (!ingestUrl) return { attempted: false, sent: false };

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('missing_auth_session');
  }

  const authToken = await currentUser.getIdToken();

  const response = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      kind,
      name,
      params,
      clientCreatedAt: new Date().toISOString(),
      platform: Platform.OS,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(responseText || `analytics-ingest-${response.status}`);
  }

  return { attempted: true, sent: true };
};

const readLocalAnalyticsRecords = async (): Promise<StoredAnalyticsRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ANALYTICS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Analytics local cache read failed:', error);
    return [];
  }
};

const writeLocalAnalyticsRecords = async (records: StoredAnalyticsRecord[]) => {
  try {
    await AsyncStorage.setItem(
      LOCAL_ANALYTICS_STORAGE_KEY,
      JSON.stringify(records.slice(-MAX_LOCAL_ANALYTICS_EVENTS))
    );
  } catch (error) {
    console.error('Analytics local cache write failed:', error);
  }
};

const queueLocalAnalyticsWrite = async (record: StoredAnalyticsRecord) => {
  persistQueue = persistQueue.then(async () => {
    const currentRecords = await readLocalAnalyticsRecords();
    await writeLocalAnalyticsRecords([...currentRecords, record]);
  });

  await persistQueue;
};

const queueStorageWrite = async (work: () => Promise<void>) => {
  persistQueue = persistQueue.then(work);
  await persistQueue;
};

const getScopedStorageKey = (prefix: string, key: string) => `${prefix}${key}`;

const readStoredJson = async <T>(storageKey: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Analytics storage read failed for ${storageKey}:`, error);
    return null;
  }
};

const buildAnalyticsRecord = (
  kind: StoredAnalyticsRecord['kind'],
  name: string,
  params: Record<string, string | number>,
  delivery: StoredAnalyticsRecord['delivery'],
  failureReason?: string
): StoredAnalyticsRecord => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  kind,
  name,
  params,
  createdAt: new Date().toISOString(),
  platform: Platform.OS,
  delivery,
  failureReason,
});

const logDebugAnalytics = (name: string, params: Record<string, string | number>, kind: StoredAnalyticsRecord['kind']) => {
  if (!isDebugAnalyticsEnabled()) return;
  console.info('[analytics]', kind, name, params);
};

const recordAnalytics = async (
  kind: StoredAnalyticsRecord['kind'],
  name: string,
  params: AnalyticsParams = {}
) => {
  const finalParams = sanitizeParams(params);

  logDebugAnalytics(name, finalParams, kind);

  try {
    const serverDelivery = await sendAnalyticsToServer(kind, name, finalParams);

    const analytics = await getAnalyticsInstance();
    if (analytics) {
      try {
        const { logEvent } = await import('firebase/analytics');
        await logEvent(analytics, name, finalParams);
      } catch (mirrorError) {
        console.error(`Analytics GA mirror failed: ${name}`, mirrorError);
      }
    }

    if (serverDelivery.sent) {
      await queueLocalAnalyticsWrite(buildAnalyticsRecord(kind, name, finalParams, 'sent'));
      return;
    }

    await queueLocalAnalyticsWrite(
      buildAnalyticsRecord(
        kind,
        name,
        finalParams,
        isServerAnalyticsEnabled() ? 'failed' : 'local_only',
        isServerAnalyticsEnabled() ? 'server_analytics_unavailable' : undefined
      )
    );
  } catch (error) {
    console.error(`Analytics ${kind} failed: ${name}`, error);
    const failureReason = error instanceof Error ? error.message : 'unknown_error';

    if (!isServerAnalyticsEnabled()) {
      await queueLocalAnalyticsWrite(
        buildAnalyticsRecord(kind, name, finalParams, 'local_only', failureReason)
      );
      return;
    }

    await queueLocalAnalyticsWrite(
      buildAnalyticsRecord(kind, name, finalParams, 'failed', failureReason)
    );
  }
};

export const trackEvent = async (eventName: string, params: AnalyticsParams = {}) => {
  try {
    await recordAnalytics('event', eventName, params);
  } catch (error) {
    console.error(`Analytics event failed: ${eventName}`, error);
  }
};

export const trackScreenView = async (screenName: string, screenClass = 'expo_router_screen') => {
  try {
    await recordAnalytics('screen_view', 'screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenClass,
    });
  } catch (error) {
    console.error(`Analytics screen view failed: ${screenName}`, error);
  }
};

export const getLocalAnalyticsEvents = async () => readLocalAnalyticsRecords();

export const clearLocalAnalyticsEvents = async () => {
  try {
    await AsyncStorage.removeItem(LOCAL_ANALYTICS_STORAGE_KEY);
  } catch (error) {
    console.error('Analytics local cache clear failed:', error);
  }
};

export const startAnalyticsJourney = async (
  key: string,
  params: AnalyticsParams = {},
  options?: { overwrite?: boolean }
) => {
  const storageKey = getScopedStorageKey(JOURNEY_STORAGE_PREFIX, key);
  const overwrite = options?.overwrite ?? true;

  if (!overwrite) {
    const existing = await readStoredJson<StoredJourney>(storageKey);
    if (existing) return existing;
  }

  const journey: StoredJourney = {
    startedAt: Date.now(),
    params: sanitizeParams(params),
  };

  await queueStorageWrite(async () => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(journey));
    } catch (error) {
      console.error(`Analytics journey start failed for ${key}:`, error);
    }
  });

  return journey;
};

export const ensureAnalyticsJourneyStarted = async (key: string, params: AnalyticsParams = {}) =>
  startAnalyticsJourney(key, params, { overwrite: false });

export const continueAnalyticsJourney = async (
  sourceKey: string,
  targetKey: string,
  params: AnalyticsParams = {}
) => {
  const sourceStorageKey = getScopedStorageKey(JOURNEY_STORAGE_PREFIX, sourceKey);
  const sourceJourney = await readStoredJson<StoredJourney>(sourceStorageKey);
  if (!sourceJourney) {
    return startAnalyticsJourney(targetKey, params, { overwrite: true });
  }

  const targetJourney: StoredJourney = {
    startedAt: sourceJourney.startedAt,
    params: {
      ...sourceJourney.params,
      ...sanitizeParams(params),
    },
  };

  await queueStorageWrite(async () => {
    try {
      await AsyncStorage.multiSet([
        [getScopedStorageKey(JOURNEY_STORAGE_PREFIX, targetKey), JSON.stringify(targetJourney)],
      ]);
      await AsyncStorage.removeItem(sourceStorageKey);
    } catch (error) {
      console.error(`Analytics journey continue failed from ${sourceKey} to ${targetKey}:`, error);
    }
  });

  return targetJourney;
};

export const clearAnalyticsJourney = async (key: string) => {
  try {
    await AsyncStorage.removeItem(getScopedStorageKey(JOURNEY_STORAGE_PREFIX, key));
  } catch (error) {
    console.error(`Analytics journey clear failed for ${key}:`, error);
  }
};

export const completeAnalyticsJourney = async (
  key: string,
  eventName: string,
  params: AnalyticsParams = {}
) => {
  const storageKey = getScopedStorageKey(JOURNEY_STORAGE_PREFIX, key);
  const journey = await readStoredJson<StoredJourney>(storageKey);
  if (!journey) return null;

  const durationSeconds = Number(((Date.now() - journey.startedAt) / 1000).toFixed(2));

  await trackEvent(eventName, {
    ...journey.params,
    ...params,
    duration_seconds: durationSeconds,
  });
  await clearAnalyticsJourney(key);
  return durationSeconds;
};

export const abandonAnalyticsJourney = async (
  key: string,
  node: string,
  params: AnalyticsParams = {}
) => {
  const storageKey = getScopedStorageKey(JOURNEY_STORAGE_PREFIX, key);
  const journey = await readStoredJson<StoredJourney>(storageKey);
  if (!journey) return false;

  const durationSeconds = Number(((Date.now() - journey.startedAt) / 1000).toFixed(2));
  await trackEvent('abandonment_node', {
    ...journey.params,
    ...params,
    node,
    duration_seconds: durationSeconds,
  });
  await clearAnalyticsJourney(key);
  return true;
};

export const trackEventOnce = async (
  key: string,
  eventName: string,
  params: AnalyticsParams = {}
) => {
  const storageKey = getScopedStorageKey(FLAG_STORAGE_PREFIX, key);
  const alreadyTracked = await AsyncStorage.getItem(storageKey);
  if (alreadyTracked) return false;

  await trackEvent(eventName, params);

  await queueStorageWrite(async () => {
    try {
      await AsyncStorage.setItem(storageKey, '1');
    } catch (error) {
      console.error(`Analytics event-once flag failed for ${key}:`, error);
    }
  });

  return true;
};

export const incrementAnalyticsCounter = async (key: string) => {
  const storageKey = getScopedStorageKey(COUNTER_STORAGE_PREFIX, key);
  const currentRaw = await AsyncStorage.getItem(storageKey);
  const currentValue = currentRaw ? Number.parseInt(currentRaw, 10) || 0 : 0;
  const nextValue = currentValue + 1;

  await queueStorageWrite(async () => {
    try {
      await AsyncStorage.setItem(storageKey, String(nextValue));
    } catch (error) {
      console.error(`Analytics counter increment failed for ${key}:`, error);
    }
  });

  return nextValue;
};
