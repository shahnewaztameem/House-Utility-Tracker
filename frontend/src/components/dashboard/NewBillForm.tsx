'use client';

import { FormEvent, useMemo, useState } from "react";
import {
  BillingSetting,
  CreateBillPayload,
  User,
} from "@/types";
import { formatCurrency } from "@/lib/format";

interface ShareRow {
  user_id: number;
  name: string;
  include: boolean;
  amount_due: string;
}

interface NewBillFormProps {
  settings: BillingSetting[];
  users: User[];
  submitting: boolean;
  onSubmit: (payload: CreateBillPayload) => Promise<void>;
}

const chargeKeys = [
  { key: "moyla", label: "Moyla" },
  { key: "water", label: "Water" },
  { key: "drinking_water", label: "Drinking Water" },
  { key: "gas", label: "Gas" },
  { key: "internet", label: "Internet" },
  { key: "ac", label: "AC" },
];

const initialForm = {
  for_month: "",
  due_date: "",
  electricity_units: "",
  electricity_rate: "",
  returned_amount: "",
  notes: "",
};

export default function NewBillForm({
  settings,
  users,
  submitting,
  onSubmit,
}: NewBillFormProps) {
  const [form, setForm] = useState(initialForm);
  const [chargeOverrides, setChargeOverrides] = useState<Record<string, string>>({});
  const [shareOverrides, setShareOverrides] = useState<
    Record<number, { include: boolean; amount_due: string }>
  >({});

  const settingLookup = useMemo(() => {
    return settings.reduce<Record<string, number>>((acc, setting) => {
      acc[setting.key] = setting.amount;
      return acc;
    }, {});
  }, [settings]);

  const shareRows = useMemo<ShareRow[]>(() => {
    return users
      .filter((user) => user.role === "resident")
      .map((user) => {
        const override = shareOverrides[user.id];
        return {
          user_id: user.id,
          name: user.name,
          include: override?.include ?? true,
          amount_due: override?.amount_due ?? "",
        };
      });
  }, [users, shareOverrides]);

  const updateCharge = (key: string, value: string) => {
    setChargeOverrides((prev) => {
      const next = { ...prev };
      if (value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const updateShareOverride = (
    userId: number,
    value: Partial<{ include: boolean; amount_due: string }>,
  ) => {
    setShareOverrides((prev) => {
      const next = { ...prev };
      const current = next[userId] ?? { include: true, amount_due: "" };
      next[userId] = { ...current, ...value };

      if (next[userId].include === true && next[userId].amount_due === "") {
        delete next[userId];
      }

      return next;
    });
  };

  const chargeLineItems = chargeKeys
    .map(({ key, label }) => {
      const fallback = settingLookup[key];
      const rawValue =
        chargeOverrides[key] ??
        (fallback !== undefined ? `${fallback}` : "");

      return {
        key,
        label,
        amount: Number(rawValue) || 0,
      };
    })
    .filter((item) => item.amount > 0);

  const electricityUnits = Number(form.electricity_units) || 0;
  const electricityRate =
    Number(
      form.electricity_rate || settingLookup["electricity_rate"] || 0,
    ) || 0;
  const electricityBill = electricityUnits * electricityRate;

  const totalDue =
    chargeLineItems.reduce((sum, item) => sum + item.amount, 0) +
    electricityBill;
  const returnedAmount = Number(form.returned_amount) || 0;
  const finalTotal = Math.max(totalDue - returnedAmount, 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CreateBillPayload = {
      for_month: form.for_month,
      due_date: form.due_date || null,
      electricity_units: electricityUnits,
      electricity_rate: electricityRate,
      electricity_bill: Number(electricityBill.toFixed(2)),
      line_items: chargeLineItems.map((item) => ({
        key: item.key,
        label: item.label,
        amount: Number(item.amount.toFixed(2)),
      })),
      total_due: Number(totalDue.toFixed(2)),
      returned_amount: Number(returnedAmount.toFixed(2)),
      final_total: Number(finalTotal.toFixed(2)),
      notes: form.notes || null,
      shares: shareRows
        .filter((row) => row.include && Number(row.amount_due) > 0)
        .map((row) => ({
          user_id: row.user_id,
          amount_due: Number(Number(row.amount_due).toFixed(2)),
        })),
    };

    await onSubmit(payload);
    setForm(initialForm);
  };

  const splitEvenly = () => {
    const activeRows = shareRows.filter((row) => row.include);
    if (activeRows.length === 0) return;

    const perPerson = finalTotal / activeRows.length;
    setShareOverrides((prev) => {
      const next = { ...prev };
      shareRows.forEach((row) => {
        if (row.include) {
          next[row.user_id] = {
            include: true,
            amount_due: perPerson.toFixed(2),
          };
        }
      });
      return next;
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-700">
            For Month
          </label>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="December 2025"
            value={form.for_month}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, for_month: event.target.value }))
            }
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">
            Due Date
          </label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.due_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, due_date: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Charge items</p>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {chargeKeys.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500 block mb-2">
                {label}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={
              chargeOverrides[key] ??
              (settingLookup[key] !== undefined
                ? `${settingLookup[key]}`
                : "")
            }
            onChange={(event) => updateCharge(key, event.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 block mb-2">
              Electricity units
            </label>
            <input
              type="number"
              min="0"
              step="1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.electricity_units}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  electricity_units: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 block mb-2">
              Electricity rate
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={
                form.electricity_rate ||
                settingLookup["electricity_rate"]?.toString() ||
                ""
              }
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  electricity_rate: event.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-700">
            Returned amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.returned_amount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                returned_amount: event.target.value,
              }))
            }
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">
            Notes
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Optional notes..."
            value={form.notes}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, notes: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Bill shares</p>
          <button
            type="button"
            className="text-xs font-semibold text-slate-600 underline"
            onClick={splitEvenly}
          >
            Split evenly
          </button>
        </div>
        {shareRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Invite residents to split this bill.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {shareRows.map((row) => (
              <div
                key={row.user_id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={(event) =>
                    updateShareOverride(row.user_id, {
                      include: event.target.checked,
                    })
                  }
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {row.name}
                  </p>
                  <p className="text-xs text-slate-500">Resident</p>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!row.include}
                  className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="0.00"
                  value={row.amount_due}
                  onChange={(event) =>
                    updateShareOverride(row.user_id, {
                      amount_due: event.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t-2 border-gray-200 bg-gray-50 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <p className="font-semibold text-gray-900 text-base">
              Total due: {formatCurrency(totalDue)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Electricity: {formatCurrency(electricityBill)} · Returned:{" "}
              {formatCurrency(returnedAmount)}
            </p>
          </div>
          <p className="text-lg font-semibold text-blue-600">
            Final total: {formatCurrency(finalTotal)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end items-center gap-3">
          <button
            type="button"
            className="px-6 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            onClick={() => {
              const now = new Date();
              setForm({
                for_month: `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`,
                due_date: now.toISOString().split('T')[0],
                electricity_units: "",
                electricity_rate: "",
                returned_amount: "",
                notes: "",
              });
              setChargeOverrides({});
              setShareOverrides({});
            }}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {submitting ? "Saving bill..." : "Save Bill"}
          </button>
        </div>
      </div>
    </form>
  );
}

