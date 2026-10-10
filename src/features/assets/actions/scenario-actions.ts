'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { z } from 'zod';
import { computeSalaryPlan } from '../lib/salary-plan';
import { isScenarioPlanFinite } from '../lib/scenario-plan';
import {
  createScenarioSchema,
  scenarioIdentitySchema,
  scenarioPayloadSchema,
  scenarioRevisionSchema,
  updateScenarioSchema,
} from '../schemas';
import type {
  ScenarioCreateResult,
  ScenarioDeleteResult,
  ScenarioPayload,
  ScenarioRecord,
  ScenarioSaveResult,
} from '../types';

function unavailable(): never {
  throw new AppError(
    'VALIDATION',
    'Scenario unavailable. Reload before retrying.'
  );
}
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) return unavailable();
  return result.data;
}
function qualifyPayload(value: unknown): ScenarioPayload {
  const payload = validate(scenarioPayloadSchema, value);
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 8192)
    return unavailable();
  if (!isScenarioPlanFinite(computeSalaryPlan(payload.inputs)))
    return unavailable();
  return payload;
}
function seal(payload: ScenarioPayload, dek: Buffer): string {
  const ciphertext = encryptPayload(
    JSON.stringify(qualifyPayload(payload)),
    dek
  );
  if (Buffer.byteLength(ciphertext, 'utf8') > 32768) return unavailable();
  return ciphertext;
}
function firstRow(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== 1) return unavailable();
  return validate(z.record(z.string(), z.unknown()), value[0]);
}
const storedRowSchema = z.strictObject({
  id: z.uuid(),
  creation_request_id: z.uuid(),
  payload: z.string().min(1).max(32768),
  revision: scenarioRevisionSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export async function getScenarios(): Promise<ScenarioRecord[]> {
  const { dek, supabase } = await requireActionContext();
  const { data, error } = await supabase.rpc('get_personal_planning_scenarios');
  throwIfSupabaseError(error, 'scenario read');
  const rows = validate(z.array(storedRowSchema).max(10), data);
  return rows.map((row) => {
    let decoded: unknown;
    try {
      const plaintext = decryptPayload(row.payload, dek);
      if (Buffer.byteLength(plaintext, 'utf8') > 8192) return unavailable();
      decoded = JSON.parse(plaintext);
    } catch {
      return unavailable();
    }
    return {
      id: row.id,
      creationRequestId: row.creation_request_id,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payload: qualifyPayload(decoded),
    };
  });
}

export async function createScenario(
  input: unknown
): Promise<ScenarioCreateResult> {
  const { dek, supabase } = await requireActionContext();
  const value = validate(createScenarioSchema, input);
  const { data, error } = await supabase.rpc(
    'create_personal_planning_scenario',
    {
      p_creation_request_id: value.creationRequestId,
      p_payload: seal(value.payload, dek),
    }
  );
  throwIfSupabaseError(error, 'scenario create');
  const row = firstRow(data);
  if (row.status === 'CAPACITY') return { status: 'CAPACITY' };
  if (row.status !== 'CREATED' && row.status !== 'EXISTING')
    return unavailable();
  return {
    status: row.status,
    id: validate(z.uuid(), row.id),
    revision: validate(scenarioRevisionSchema, row.revision),
  };
}

export async function updateScenario(
  input: unknown
): Promise<ScenarioSaveResult> {
  const { dek, supabase } = await requireActionContext();
  const value = validate(updateScenarioSchema, input);
  const { data, error } = await supabase.rpc(
    'compare_save_personal_planning_scenario',
    {
      p_id: value.id,
      p_expected_revision: value.revision,
      p_payload: seal(value.payload, dek),
    }
  );
  throwIfSupabaseError(error, 'scenario save');
  const row = firstRow(data);
  if (row.status === 'CONFLICT') return { status: 'CONFLICT' };
  if (row.status !== 'SAVED') return unavailable();
  return {
    status: 'SAVED',
    revision: validate(scenarioRevisionSchema, row.revision),
  };
}

export async function deleteScenario(
  input: unknown
): Promise<ScenarioDeleteResult> {
  const { supabase } = await requireActionContext();
  const value = validate(scenarioIdentitySchema, input);
  const { data, error } = await supabase.rpc(
    'compare_delete_personal_planning_scenario',
    { p_id: value.id, p_expected_revision: value.revision }
  );
  throwIfSupabaseError(error, 'scenario delete');
  const row = firstRow(data);
  if (row.status !== 'DELETED' && row.status !== 'CONFLICT')
    return unavailable();
  return { status: row.status };
}
