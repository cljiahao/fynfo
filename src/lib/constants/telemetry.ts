// Anonymous, non-PII marketing telemetry event types. Shared by the /api/track
// ingestion route, the client beacon, the SQL CHECK constraint, and the admin
// read layer so all four stay in lock-step. See spec 004 / gov-013.
export const MARKETING_EVENT_TYPES = ['page_view', 'cta_click'] as const;

export type MarketingEventType = (typeof MARKETING_EVENT_TYPES)[number];

// Mirrors the `char_length(path) <= 128` CHECK in the migration.
export const TELEMETRY_PATH_MAX = 128;
