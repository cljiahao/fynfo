'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  statementZoomLevel,
  stepStatementZoom,
  type StatementZoom,
} from '../lib/statement-zoom';

type Point = { x: number; y: number };
type Anchor = Point & { ratioX: number; ratioY: number };

const PINCH_STEP = 1.25;

/** Stepped zoom with native-scroll panning, drag, pinch, Ctrl/⌘+wheel and keys. */
export function usePanZoom() {
  const container = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<StatementZoom>('fit');
  const anchor = useRef<Anchor | null>(null);
  const drag = useRef<(Point & { left: number; top: number }) | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<number | null>(null);

  function captureAnchor(point?: Point) {
    const element = container.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const x = point ? point.x - box.left : element.clientWidth / 2;
    const y = point ? point.y - box.top : element.clientHeight / 2;
    anchor.current = {
      x,
      y,
      ratioX: (element.scrollLeft + x) / (element.scrollWidth || 1),
      ratioY: (element.scrollTop + y) / (element.scrollHeight || 1),
    };
  }
  function step(direction: 1 | -1, point?: Point) {
    captureAnchor(point);
    setZoom((current) => stepStatementZoom(current, direction));
  }
  function fit() {
    anchor.current = null;
    setZoom('fit');
  }

  useLayoutEffect(() => {
    const element = container.current;
    const target = anchor.current;
    anchor.current = null;
    if (!element || !target || zoom === 'fit') return;
    element.scrollLeft = target.ratioX * element.scrollWidth - target.x;
    element.scrollTop = target.ratioY * element.scrollHeight - target.y;
  }, [zoom]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // React registers wheel listeners as passive, so preventDefault needs a
    // native listener to stop browser page zoom.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  });

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current = null;
      return;
    }
    const element = container.current;
    if (!element || zoom === 'fit' || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pinch.current !== null && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / (pinch.current || 1);
      if (ratio > PINCH_STEP || ratio < 1 / PINCH_STEP) {
        step(ratio > 1 ? 1 : -1, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        pinch.current = distance;
      }
      return;
    }
    const element = container.current;
    const start = drag.current;
    if (!element || !start) return;
    element.scrollLeft = start.left - (event.clientX - start.x);
    element.scrollTop = start.top - (event.clientY - start.y);
  }
  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === '+' || event.key === '=') step(1);
    else if (event.key === '-') step(-1);
    else if (event.key === '0') fit();
    else return;
    event.preventDefault();
  }

  return {
    container,
    zoom,
    level: statementZoomLevel(zoom),
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    fit,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onKeyDown,
    },
  };
}
