'use client';

import { FormEvent, useEffect, useState } from "react";
import {
  BillingSetting,
  BillingSettingsPayload,
} from "@/types";

interface BillingSettingsFormProps {
  settings: BillingSetting[];
  saving: boolean;
  onSave: (payload: BillingSettingsPayload) => Promise<void>;
}

export default function BillingSettingsForm({
  settings,
  saving,
  onSave,
}: BillingSettingsFormProps) {
  const [values, setValues] = useState<BillingSetting[]>(settings);

  useEffect(() => {
    setValues(settings);
  }, [settings]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: BillingSettingsPayload = {
      settings: values.map((setting) => ({
        key: setting.key,
        amount: Number(setting.amount) || 0,
        metadata: { label: setting.label },
      })),
    };

    await onSave(payload);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {values.map((setting) => (
          <div
            key={setting.id ?? setting.key}
            className="rounded-lg border border-slate-200 p-3 bg-white"
          >
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              {setting.label}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={setting.amount}
              onChange={(event) =>
                setValues((prev) =>
                  prev.map((entry) =>
                    entry.key === setting.key
                      ? { ...entry, amount: Number(event.target.value) }
                      : entry,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t-2 border-gray-200 bg-gray-50 rounded-lg p-4">
        <div className="flex flex-wrap justify-end items-center gap-3">
          <button
            type="button"
            className="px-6 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            onClick={() => setValues(settings)}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </form>
  );
}

