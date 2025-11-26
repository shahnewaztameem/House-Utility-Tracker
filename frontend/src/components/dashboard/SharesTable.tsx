'use client';

import { FormEvent, useMemo, useState } from "react";
import { BillShare, PaymentPayload, User } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";

interface SharesTableProps {
  shares: BillShare[];
  currentUser: User | null;
  savingShareId: number | null;
  onRecordPayment: (payload: PaymentPayload) => Promise<boolean>;
}

const statusColors: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function SharesTable({
  shares,
  currentUser,
  savingShareId,
  onRecordPayment,
}: SharesTableProps) {
  const [activeShareId, setActiveShareId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    bill_share_id: 0,
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    notes: "",
  });

  const sortedShares = useMemo(() => {
    return [...shares].sort((a, b) => b.outstanding - a.outstanding);
  }, [shares]);

  const openPaymentForm = (share: BillShare) => {
    setActiveShareId(share.id);
    setFormState({
      bill_share_id: share.id,
      amount: share.outstanding.toFixed(2),
      paid_on: new Date().toISOString().slice(0, 10),
      method: "cash",
      reference: "",
      notes: "",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.bill_share_id) return;

    const amountValue = Number(formState.amount);
    if (!amountValue || amountValue <= 0) return;

    const payload: PaymentPayload = {
      bill_share_id: formState.bill_share_id,
      amount: amountValue,
      paid_on: formState.paid_on,
      method: formState.method,
      reference: formState.reference,
      notes: formState.notes,
    };

    const success = await onRecordPayment(payload);
    if (success) {
      setActiveShareId(null);
    }
  };

  if (sortedShares.length === 0) {
    return <p className="text-sm text-slate-500">No share records found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Bill</th>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Outstanding</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last paid</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedShares.map((share) => {
              const canRecord =
                currentUser?.abilities.manage_bills ||
                share.user.id === currentUser?.id;
              return (
                <tr
                  key={share.id}
                  className="border-t border-slate-100 text-slate-700"
                >
                  <td className="px-3 py-2">
                    <p className="font-semibold">
                      {share.bill?.for_month ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(share.bill?.due_date)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{share.user.name}</p>
                    <p className="text-xs uppercase text-slate-500">
                      {share.user.role}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {formatCurrency(share.amount_due)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {formatCurrency(share.amount_paid)}
                  </td>
                  <td className="px-3 py-2 font-semibold text-amber-600">
                    {formatCurrency(share.outstanding)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        statusColors[share.status] ?? statusColors.pending
                      }`}
                    >
                      {share.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {formatDate(share.last_paid_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canRecord ? (
                      <button
                        className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        onClick={() => openPaymentForm(share)}
                        type="button"
                      >
                        Record Payment
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeShareId ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={handleSubmit}
        >
          <p className="text-sm font-semibold text-slate-700">
            Record payment for share #{activeShareId}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={formState.amount}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Paid on
              </label>
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={formState.paid_on}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    paid_on: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Method
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={formState.method}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    method: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Reference
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={formState.reference ?? ""}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Notes
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={formState.notes ?? ""}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingShareId === activeShareId}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingShareId === activeShareId
                ? "Saving..."
                : "Record payment"}
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-slate-600 underline"
              onClick={() => setActiveShareId(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

