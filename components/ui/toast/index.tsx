'use client';
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type ToastPlacement =
  | 'top'
  | 'top left'
  | 'top right'
  | 'bottom'
  | 'bottom left'
  | 'bottom right';

type ToastRenderParams = {
  id: string;
};

type ToastOptions = {
  id?: string;
  placement?: ToastPlacement;
  duration?: number | null;
  render: (params: ToastRenderParams) => React.ReactNode;
};

type ToastRecord = {
  id: string;
  placement: ToastPlacement;
  node: React.ReactNode;
};

type ToastContextValue = {
  show: (options: ToastOptions) => string;
  close: (id: string) => void;
  closeAll: () => void;
  isActive: (id: string) => boolean;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_PLACEMENT: ToastPlacement = 'top';
const DEFAULT_DURATION = 5000;

const placementStyles: Record<ToastPlacement, object> = {
  top: { top: 0, left: 0, right: 0, alignItems: 'center' },
  'top left': { top: 0, left: 0, alignItems: 'flex-start' },
  'top right': { top: 0, right: 0, alignItems: 'flex-end' },
  bottom: { bottom: 0, left: 0, right: 0, alignItems: 'center' },
  'bottom left': { bottom: 0, left: 0, alignItems: 'flex-start' },
  'bottom right': { bottom: 0, right: 0, alignItems: 'flex-end' },
};

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timeoutsRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nextIdRef = React.useRef(1);

  const close = React.useCallback((id: string) => {
    const timeout = timeoutsRef.current[id];
    if (timeout) {
      clearTimeout(timeout);
      delete timeoutsRef.current[id];
    }

    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const closeAll = React.useCallback(() => {
    Object.values(timeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current = {};
    setToasts([]);
  }, []);

  const isActive = React.useCallback(
    (id: string) => toasts.some((toast) => toast.id === id),
    [toasts]
  );

  const show = React.useCallback(
    ({ id, placement = DEFAULT_PLACEMENT, duration = DEFAULT_DURATION, render }: ToastOptions) => {
      const toastId = id ?? `toast-${nextIdRef.current++}`;
      const node = render({ id: toastId });

      setToasts((currentToasts) => [
        ...currentToasts.filter((toast) => toast.id !== toastId),
        { id: toastId, placement, node },
      ]);

      const existingTimeout = timeoutsRef.current[toastId];
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      if (duration !== null) {
        timeoutsRef.current[toastId] = setTimeout(() => {
          close(toastId);
        }, duration);
      }

      return toastId;
    },
    [close]
  );

  React.useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const groupedToasts = React.useMemo(() => {
    return toasts.reduce<Record<ToastPlacement, ToastRecord[]>>((acc, toast) => {
      acc[toast.placement] = [...(acc[toast.placement] || []), toast];
      return acc;
    }, {} as Record<ToastPlacement, ToastRecord[]>);
  }, [toasts]);

  const contextValue = React.useMemo(
    () => ({ show, close, closeAll, isActive }),
    [show, close, closeAll, isActive]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {(Object.keys(groupedToasts) as ToastPlacement[]).map((placement) => (
          <View
            key={placement}
            pointerEvents="none"
            style={[styles.placementContainer, placementStyles[placement]]}
          >
            {groupedToasts[placement].map((toast) => (
              <View key={toast.id} pointerEvents="none" style={styles.toastWrapper}>
                {toast.node}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

type BaseToastProps = React.ComponentProps<typeof View> & {
  className?: string;
};

const Toast = React.forwardRef<View, BaseToastProps>(function Toast(
  { className, pointerEvents = 'none', ...props },
  ref
) {
  return <View ref={ref} pointerEvents={pointerEvents} className={className} {...props} />;
});

type BaseTextProps = React.ComponentProps<typeof Text> & {
  className?: string;
};

const ToastTitle = React.forwardRef<Text, BaseTextProps>(function ToastTitle(
  { className, ...props },
  ref
) {
  return <Text ref={ref} className={className} {...props} />;
});

const ToastDescription = React.forwardRef<Text, BaseTextProps>(function ToastDescription(
  { className, ...props },
  ref
) {
  return <Text ref={ref} className={className} {...props} />;
});

const styles = StyleSheet.create({
  placementContainer: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  toastWrapper: {
    pointerEvents: 'none',
  },
});

Toast.displayName = 'Toast';
ToastTitle.displayName = 'ToastTitle';
ToastDescription.displayName = 'ToastDescription';

export { Toast, ToastTitle, ToastDescription };
