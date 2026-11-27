'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { MEMBER_COLORS } from '../constants';
import {
  useDeleteGoalItem,
  useDeleteItemPayment,
} from '../hooks/use-household';
import { useMemberLabels } from '../hooks/use-member-labels';
import { useUndoableDelete } from '../hooks/use-undoable-delete';
import { effectiveAmount } from '../lib/goal-stats';
import type { GoalItem, GoalItemPayment } from '../types';
import { EditPaymentDialog } from './edit-payment-dialog';
import { RecordPaymentDialog } from './record-payment-dialog';

/** About 5 payment rows; keep in step with GOAL_ITEM_PAYMENT_VISIBLE_ROWS (Tailwind needs the literal). */
const PAYMENTS_MAX_HEIGHT = 'max-h-[8rem]';

/** Invisible 44px touch target that leaves row height untouched. */
const TOUCH_TARGET =
  'relative after:absolute after:-inset-2.5 after:content-[""]';

/** Items already filtered of rows pending deletion; payments are filtered per row. */
export function GoalItemList({
  items,
  memberIds,
}: {
  items: GoalItem[];
  memberIds?: readonly string[];
}) {
  const { pendingIds } = useUndoableDelete();
  const pendingRef = useRef(pendingIds);
  useEffect(() => {
    pendingRef.current = pendingIds;
  }, [pendingIds]);

  return (
    <ul className="divide-y rounded-xl border">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          memberIds={memberIds}
          isItemPending={() => pendingRef.current.has(item.id)}
        />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  memberIds,
  isItemPending,
}: {
  item: GoalItem;
  memberIds?: readonly string[];
  isItemPending: () => boolean;
}) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const { label, colorIndex } = useMemberLabels();
  const { pendingIds, request } = useUndoableDelete();
  const fieldId = useId();
  // Remounting per open re-seeds the dialog fields.
  const [paying, setPaying] = useState({ open: false, session: 0 });
  const [showPayments, setShowPayments] = useState(false);
  const removeItem = useDeleteGoalItem();
  const removePayment = useDeleteItemPayment();
  const paymentsId = `${fieldId}-payments`;
  const payments = item.payments.filter(
    (payment) => !pendingIds.has(payment.id)
  );
  const [editing, setEditing] = useState<GoalItemPayment | null>(null);
  const effective = effectiveAmount(item);
  const over = Math.max(0, item.paid - effective);
  const left = Math.max(0, effective - item.paid);
  const scale = Math.max(effective, item.paid);
  const paidWidth = scale > 0 ? Math.min(100, (item.paid / scale) * 100) : 0;

  return (
    <li className="space-y-2 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-base font-medium">
            {mask(item.name)}
          </span>
          {item.description ? (
            <span className="text-muted-foreground block truncate text-xs">
              {mask(item.description)}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-sm whitespace-nowrap tabular-nums">
            {mask(formatSGD(item.paid))}
            <span className="text-muted-foreground">
              {' '}
              / {mask(formatSGD(effective))}
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive h-7 px-2 pointer-coarse:size-11"
            disabled={hidden}
            aria-label={`Delete item ${mask(item.name)}`}
            onClick={() => {
              if (!canReveal()) return;
              request({
                id: item.id,
                label: `${mask(item.name)} item deleted`,
                commit: () => removeItem.mutateAsync(item.id),
                errorMessage: 'Could not delete the item',
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
      {/* The track stays when amounts are hidden so the row keeps its height;
          a fill would leak the masked percentage. */}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        {!hidden && (
          <svg aria-hidden="true" className="block h-full w-full">
            <rect
              height="100%"
              width={`${paidWidth}%`}
              className={over > 0 ? 'fill-loss' : 'fill-primary'}
            />
          </svg>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {!hidden && over > 0 ? (
            <span className="text-loss-strong">Over by {formatSGD(over)}</span>
          ) : (
            <>{mask(formatSGD(left))} left</>
          )}
          {item.quote !== null &&
            ` · Quote ${mask(formatSGD(item.quote))} vs est. ${mask(formatSGD(item.budget))}`}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-9 pointer-coarse:min-h-11"
          disabled={hidden}
          onClick={() => {
            if (canReveal())
              setPaying((current) => ({
                open: true,
                session: current.session + 1,
              }));
          }}
        >
          Record payment
        </Button>
      </div>
      {payments.length > 0 && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground -ml-2 min-h-9 px-2 text-xs pointer-coarse:min-h-11"
            aria-expanded={showPayments}
            aria-controls={paymentsId}
            onClick={() => setShowPayments((current) => !current)}
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                showPayments && 'rotate-180'
              )}
            />
            {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
          </Button>
          <ul
            id={paymentsId}
            hidden={!showPayments}
            className={cn(
              'text-muted-foreground space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-2.5 text-xs',
              PAYMENTS_MAX_HEIGHT
            )}
          >
            {payments.map((payment) => {
              const who = label(payment.userId);
              const dot = MEMBER_COLORS[colorIndex(payment.userId)];
              const day = format(
                parseISO(payment.date.slice(0, 10)),
                'dd MMM yyyy'
              );
              return (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn('size-2 shrink-0 rounded-full', dot.dot)}
                    />
                    <span className="truncate">
                      {day} · {who}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums">
                    {mask(formatSGD(payment.amount))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={TOUCH_TARGET}
                      disabled={hidden}
                      aria-label={`Edit ${mask(formatSGD(payment.amount))} on ${day} by ${who}`}
                      onClick={() => {
                        if (canReveal()) setEditing(payment);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={`hover:text-destructive ${TOUCH_TARGET}`}
                      disabled={hidden}
                      aria-label={`Delete ${mask(formatSGD(payment.amount))} payment on ${day} by ${who}`}
                      onClick={() => {
                        if (!canReveal()) return;
                        request({
                          id: payment.id,
                          label: 'Payment deleted',
                          // Deleting the item cascades to its payments, so a payment
                          // commit after that would only fail.
                          commit: async () => {
                            if (isItemPending()) return;
                            await removePayment.mutateAsync(payment.id);
                          },
                          errorMessage: 'Could not delete the payment',
                        });
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <RecordPaymentDialog
        key={paying.session}
        open={paying.open}
        itemId={item.id}
        itemName={item.name}
        goalMemberIds={memberIds}
        onOpenChange={(open) => setPaying((current) => ({ ...current, open }))}
      />
      <EditPaymentDialog
        key={editing?.id}
        payment={editing}
        itemName={item.name}
        goalMemberIds={memberIds}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </li>
  );
}
