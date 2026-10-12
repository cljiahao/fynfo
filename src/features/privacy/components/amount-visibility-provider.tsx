'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { HIDDEN_FINANCIAL_VALUE } from '../constants';

interface AmountVisibility {
  hidden: boolean;
  mask: (value: string | number) => string;
  canReveal: () => boolean;
  getHideEpoch: () => number;
  showAmounts: () => void;
  hideAmounts: () => void;
}

const visibleDefaults: AmountVisibility = {
  hidden: false,
  mask: (value) => String(value),
  canReveal: () => true,
  getHideEpoch: () => 0,
  showAmounts: () => undefined,
  hideAmounts: () => undefined,
};
const AmountVisibilityContext =
  createContext<AmountVisibility>(visibleDefaults);

// Recharts 3.8.1 keeps measured label text in a body-level span after chart teardown.
// Clear its disposable text, preserving the node and measurement geometry for later charts.
function clearChartMeasurementText() {
  if (typeof document === 'undefined') return;
  const measurement = document.getElementById('recharts_measurement_span');
  if (measurement) measurement.textContent = '';
}

/** Memory-only presentation state; the unlocked subtree owns its lifetime. */
export function AmountVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const current = useRef({ hidden: false, hideEpoch: 0, active: true });
  useLayoutEffect(function activatePresentationOwner() {
    const owner = current.current;
    owner.active = true;
    return function invalidatePresentationOwner() {
      owner.active = false;
      owner.hideEpoch += 1;
      clearChartMeasurementText();
    };
  }, []);
  const showAmounts = useCallback(() => {
    if (!current.current.active) return;
    current.current.hidden = false;
    setHidden(false);
  }, []);
  const hideAmounts = useCallback(() => {
    if (!current.current.active) return;
    if (!current.current.hidden) current.current.hideEpoch += 1;
    current.current.hidden = true;
    clearChartMeasurementText();
    setHidden(true);
  }, []);
  // Imperative reads also protect deferred callbacks before effects can run.
  const canReveal = useCallback(
    () => current.current.active && !current.current.hidden,
    []
  );
  const getHideEpoch = useCallback(() => current.current.hideEpoch, []);
  const mask = useCallback(
    (value: string | number) =>
      hidden || !current.current.active || current.current.hidden
        ? HIDDEN_FINANCIAL_VALUE
        : String(value),
    [hidden]
  );
  const value = useMemo(
    () => ({ hidden, mask, canReveal, getHideEpoch, showAmounts, hideAmounts }),
    [hidden, mask, canReveal, getHideEpoch, showAmounts, hideAmounts]
  );
  return (
    <AmountVisibilityContext.Provider value={value}>
      {children}
    </AmountVisibilityContext.Provider>
  );
}

export function useAmountVisibility(): AmountVisibility {
  return useContext(AmountVisibilityContext);
}
