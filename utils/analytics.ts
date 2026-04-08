import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app } from '@/config/firebaseConfig';

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

let analyticsPromise: Promise<any | null> | null = null;
let debugModeConfigured = false;
let persistQueue: Promise<void> = Promise.resolve();

const LOCAL_ANALYTICS_STORAGE_KEY = 'polled_local_analytics_events';
const MAX_LOCAL_ANALYTICS_EVENTS = 500;

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
    const analytics = await getAnalyticsInstance();
    if (!analytics) {
      await queueLocalAnalyticsWrite(buildAnalyticsRecord(kind, name, finalParams, 'local_only'));
      return;
    }

    const { logEvent } = await import('firebase/analytics');
    await logEvent(analytics, name, finalParams);
    await queueLocalAnalyticsWrite(buildAnalyticsRecord(kind, name, finalParams, 'sent'));
  } catch (error) {
    console.error(`Analytics ${kind} failed: ${name}`, error);
    const failureReason = error instanceof Error ? error.message : 'unknown_error';
    await queueLocalAnalyticsWrite(buildAnalyticsRecord(kind, name, finalParams, 'failed', failureReason));
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
