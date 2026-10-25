import { STATEMENT_ZOOM_LEVELS } from '../constants';

export type StatementZoom = (typeof STATEMENT_ZOOM_LEVELS)[number]['value'];

export function statementZoomLevel(zoom: StatementZoom) {
  return (
    STATEMENT_ZOOM_LEVELS.find((level) => level.value === zoom) ??
    STATEMENT_ZOOM_LEVELS[0]
  );
}

export function stepStatementZoom(
  zoom: StatementZoom,
  direction: 1 | -1
): StatementZoom {
  const index = STATEMENT_ZOOM_LEVELS.findIndex(
    (level) => level.value === zoom
  );
  const next = Math.min(
    STATEMENT_ZOOM_LEVELS.length - 1,
    Math.max(0, index + direction)
  );
  return STATEMENT_ZOOM_LEVELS[next].value;
}
