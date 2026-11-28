'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addKeyAction,
  createCallerAction,
  listCallers,
  revokeCallerAction,
  revokeKeyAction,
  setSealingKeyAction,
} from '../actions/callers-actions';
import type {
  AddKeyInput,
  CreateCallerInput,
  SetSealingKeyInput,
} from '../schemas/callers-schemas';

const CALLERS_KEY = ['invest-api-callers'] as const;

export function useCallers() {
  return useQuery({ queryKey: CALLERS_KEY, queryFn: () => listCallers() });
}

function useCallerMutation<TInput, TResult>(
  action: (input: TInput) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALLERS_KEY }),
  });
}

export function useCreateCaller() {
  return useCallerMutation((input: CreateCallerInput) =>
    createCallerAction(input)
  );
}

export function useAddCallerKey() {
  return useCallerMutation((input: AddKeyInput) => addKeyAction(input));
}

export function useRevokeCallerKey() {
  return useCallerMutation((keyId: string) => revokeKeyAction({ keyId }));
}

export function useRevokeCaller() {
  return useCallerMutation((callerId: string) =>
    revokeCallerAction({ callerId })
  );
}

export function useSetSealingKey() {
  return useCallerMutation((input: SetSealingKeyInput) =>
    setSealingKeyAction(input)
  );
}
