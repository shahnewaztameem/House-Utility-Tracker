'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Bill,
  BillShare,
  BillingSetting,
  BillingSettingsPayload,
  CreateBillPayload,
  DashboardSummary,
  PaymentPayload,
  User,
} from "@/types";
import NewBillForm from "./NewBillForm";
import BillingSettingsForm from "./BillingSettingsForm";
import SharesTable from "./SharesTable";

const LoadingState = () => (
  <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 p-8 sm:p-16 text-gray-500">
    <p className="text-sm font-medium">Loading dashboard data...</p>
  </div>
);

const StatCard = ({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
    <p className="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
    <p className={`mt-2 sm:mt-3 text-xl sm:text-2xl font-semibold ${accentClass}`}>{value}</p>
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between">
    <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
    <span className="h-px flex-1 bg-gray-200 ml-4" />
  </div>
);

export default function DashboardView() {
  const { user, token, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [shares, setShares] = useState<BillShare[]>([]);
  const [settings, setSettings] = useState<BillingSetting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [paymentLoadingId, setPaymentLoadingId] = useState<number | null>(null);

  const canManageBills = Boolean(user?.abilities.manage_bills);
  const canManageSettings = Boolean(user?.abilities.manage_settings);

  const loadData = useCallback(
    async (silent = false) => {
      if (!token) return;

      if (!silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const [dashboardResponse, billsResponse, sharesResponse, settingsRes] =
          await Promise.all([
            apiFetch<DashboardSummary>("/dashboard", { token }),
            apiFetch<{ data: Bill[] }>("/bills", { token }),
            apiFetch<{ data: BillShare[] }>("/bill-shares", { token }),
            apiFetch<{ data: BillingSetting[] }>("/billing-settings", {
              token,
            }),
          ]);

        setDashboard(dashboardResponse);
        setBills(billsResponse.data);
        setShares(sharesResponse.data);
        setSettings(settingsRes.data);

        if (canManageBills) {
          const userResponse = await apiFetch<{ data: User[] }>("/users", {
            token,
          });
          setUsers(userResponse.data);
        } else {
          setUsers([]);
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard data right now.",
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [token, canManageBills],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const latestBills = dashboard?.latest_bills ?? bills.slice(0, 5);

  const handleCreateBill = useCallback(
    async (payload: CreateBillPayload) => {
      if (!token) return;
      setBillSubmitting(true);
      setError(null);

      try {
        await apiFetch("/bills", {
          method: "POST",
          token,
          body: payload,
        });
        setStatus("Bill saved successfully! Notifications have been sent to all users via Telegram.");
        await loadData(true);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to save bill. Please try again.",
        );
      } finally {
        setBillSubmitting(false);
      }
    },
    [token, loadData],
  );

  const handleSaveSettings = useCallback(
    async (payload: BillingSettingsPayload) => {
      if (!token) return;
      setSettingsSaving(true);
      setError(null);

      try {
        await apiFetch("/billing-settings", {
          method: "PUT",
          token,
          body: payload,
        });
        setStatus("Billing settings updated.");
        await loadData(true);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update settings right now.",
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    [token, loadData],
  );

  const handleRecordPayment = useCallback(
    async (payload: PaymentPayload) => {
      if (!token) return false;
      setPaymentLoadingId(payload.bill_share_id);
      setError(null);

      try {
        await apiFetch("/payments", {
          method: "POST",
          token,
          body: payload,
        });
        setStatus("Payment recorded.");
        await loadData(true);
        return true;
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to record payment. Please try again.",
        );
        return false;
      } finally {
        setPaymentLoadingId(null);
      }
    },
    [token, loadData],
  );

  const outstandingShares = useMemo(
    () => shares.filter((share) => share.outstanding > 0),
    [shares],
  );

  return (
    <div className="space-y-4 sm:space-y-6">
          <header
            className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-6 shadow-sm lg:flex-row lg:items-center lg:justify-between"
            id="overview"
          >
            <div>
              <p className="text-sm text-gray-500">Welcome back</p>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                {user?.name ?? "Resident"}
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="rounded-full bg-blue-50 px-2 sm:px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-700">
                {user?.role_label}
              </span>
            </div>
          </header>

          {status ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {status}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : (
            <>
              <section>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard
                    label="Total due"
                    value={formatCurrency(dashboard?.totals.total_due ?? 0)}
                    accentClass="text-gray-900"
                  />
                  <StatCard
                    label="Total paid"
                    value={formatCurrency(dashboard?.totals.total_paid ?? 0)}
                    accentClass="text-green-600"
                  />
                  <StatCard
                    label="Outstanding balance"
                    value={formatCurrency(
                      dashboard?.totals.total_outstanding ?? 0,
                    )}
                    accentClass="text-amber-600"
                  />
                </div>
              </section>

              <section id="bills" className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
                <SectionTitle title="Latest bills" />
                {latestBills.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No bills available yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-gray-500">
                          <th className="px-2 sm:px-3 py-2">Month</th>
                          <th className="px-2 sm:px-3 py-2 hidden sm:table-cell">Due</th>
                          <th className="px-2 sm:px-3 py-2">Status</th>
                          <th className="px-2 sm:px-3 py-2 hidden md:table-cell">Line items</th>
                          <th className="px-2 sm:px-3 py-2 hidden lg:table-cell">Shares</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestBills.map((bill) => (
                          <tr
                            key={bill.id}
                            className="border-t border-gray-100 text-gray-700"
                          >
                            <td className="px-2 sm:px-3 py-2 font-medium">
                              <div className="text-sm">{bill.for_month}</div>
                              <p className="text-xs text-gray-500">
                                Ref: {bill.reference}
                              </p>
                              <p className="text-xs text-gray-500 sm:hidden">
                                {formatCurrency(bill.final_total)} · Due {formatDate(bill.due_date)}
                              </p>
                            </td>
                            <td className="px-2 sm:px-3 py-2 hidden sm:table-cell">
                              <div className="font-semibold text-blue-600">{formatCurrency(bill.final_total)}</div>
                              <p className="text-xs text-gray-500">
                                Due {formatDate(bill.due_date)}
                              </p>
                            </td>
                            <td className="px-2 sm:px-3 py-2">
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                                {bill.status}
                              </span>
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                              {bill.line_items?.length
                                ? bill.line_items
                                    .map(
                                      (item) =>
                                        `${item.label ?? item.key}: ${formatCurrency(item.amount)}`,
                                    )
                                    .join(" · ")
                                : "—"}
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-xs text-gray-500 hidden lg:table-cell">
                              {bill.shares?.length ?? 0} allocations
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section
                id="shares"
                className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm"
              >
                <SectionTitle title="Your shares & recent payments" />
                <SharesTable
                  shares={shares}
                  currentUser={user}
                  onRecordPayment={handleRecordPayment}
                  savingShareId={paymentLoadingId}
                />
                {outstandingShares.length > 0 ? (
                  <p className="text-xs text-amber-600 font-medium">
                    {outstandingShares.length} households still owe money on
                    issued bills.
                  </p>
                ) : null}
              </section>

              {canManageBills ? (
                <section
                  id="manage-bills"
                  className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm"
                >
                  <SectionTitle title="Create / adjust bill" />
                  <NewBillForm
                    settings={settings}
                    users={users}
                    submitting={billSubmitting}
                    onSubmit={handleCreateBill}
                  />
                </section>
              ) : null}

              {canManageSettings ? (
                <section
                  id="billing-settings"
                  className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm"
                >
                  <SectionTitle title="Billing settings" />
                  <BillingSettingsForm
                    settings={settings}
                    onSave={handleSaveSettings}
                    saving={settingsSaving}
                  />
                </section>
              ) : null}
            </>
          )}
    </div>
  );
}

