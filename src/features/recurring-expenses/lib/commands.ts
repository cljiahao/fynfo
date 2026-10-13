import { recurringPayloadSchema } from '../schemas';
import type { RecurringMutation, RecurringPayload } from '../types';
import { occurrenceState } from './calendar';

/** Append-only terminal receipts; explicit commands never reset or remove history. */
export function applyRecurringCommand(
  current: RecurringPayload | null,
  input: RecurringMutation,
  today: string
): RecurringPayload {
  const next: RecurringPayload = current
    ? structuredClone(current)
    : { schemaVersion: 1, requestId: input.requestId, templates: [] };
  const command = input.command;
  if (command.kind === 'create') {
    if (
      next.templates.some(
        (entry) => entry.definition.id === command.definition.id
      )
    )
      throw new Error('Recurring conflict');
    next.templates.push({
      definition: command.definition,
      archived: false,
      occurrences: [],
    });
  } else {
    const id =
      'templateId' in command ? command.templateId : command.definition.id;
    const template = next.templates.find((entry) => entry.definition.id === id);
    if (!template) throw new Error('Recurring conflict');
    if (command.kind === 'archive') {
      template.archived = true;
      template.definition.enabled = false;
    } else if (command.kind === 'edit') {
      if (template.archived) throw new Error('Recurring conflict');
      template.definition = command.definition;
    } else {
      if (occurrenceState(template, command.month, today) !== 'due')
        throw new Error('Recurring conflict');
      template.occurrences.push(
        command.kind === 'confirm'
          ? {
              month: command.month,
              requestId: input.requestId,
              outcome: 'confirmed',
              expense: command.expense,
            }
          : {
              month: command.month,
              requestId: input.requestId,
              outcome: 'skipped',
              expense: null,
            }
      );
    }
  }
  next.requestId = input.requestId;
  return recurringPayloadSchema.parse(next);
}
export function recurringRequestRecorded(
  input: RecurringMutation,
  payload: RecurringPayload
): boolean {
  const command = input.command;
  if (command.kind !== 'confirm' && command.kind !== 'skip') {
    if (payload.requestId !== input.requestId) return false;
    if (command.kind === 'archive')
      return payload.templates.some(
        (entry) => entry.definition.id === command.templateId && entry.archived
      );
    return payload.templates.some(
      (entry) =>
        !entry.archived &&
        JSON.stringify(entry.definition) === JSON.stringify(command.definition)
    );
  }
  const receipt = payload.templates
    .find((entry) => entry.definition.id === command.templateId)
    ?.occurrences.find((entry) => entry.month === command.month);
  return (
    receipt?.requestId === input.requestId &&
    (command.kind === 'skip'
      ? receipt.outcome === 'skipped'
      : receipt.outcome === 'confirmed' &&
        JSON.stringify(receipt.expense) === JSON.stringify(command.expense))
  );
}
