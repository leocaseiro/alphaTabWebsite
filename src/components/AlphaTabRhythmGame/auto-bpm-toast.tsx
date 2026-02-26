"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "./styles.module.scss";

interface ToastItem {
  id: number;
  message: string;
}

const TOAST_DURATION_MS = 2500;

export function useAutoBpmToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return { toasts, showToast };
}

interface AutoBpmToastContainerProps {
  toasts: ToastItem[];
}

export const AutoBpmToastContainer: React.FC<AutoBpmToastContainerProps> =
  React.memo(({ toasts }) => {
    if (toasts.length === 0) return null;

    return (
      <div className={styles["auto-bpm-toast-container"]}>
        {toasts.map((toast) => (
          <AutoBpmToastItem key={toast.id} message={toast.message} />
        ))}
      </div>
    );
  });

const AutoBpmToastItem: React.FC<{ message: string }> = React.memo(
  ({ message }) => {
    const [exiting, setExiting] = useState(false);
    const exitTimeout = 400;

    useEffect(() => {
      const timer = setTimeout(() => {
        setExiting(true);
      }, TOAST_DURATION_MS - exitTimeout);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div
        className={styles["auto-bpm-toast"]}
        data-exiting={exiting || undefined}
      >
        <span className={styles["auto-bpm-toast-icon"]}>⬆</span>
        <span>{message}</span>
      </div>
    );
  },
);
