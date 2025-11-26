'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Table, Tag, message, Spin } from 'antd';
import { DollarOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { setCurrencyConfig } from '@/lib/currency';
import { Bill, DashboardSummary } from '@/types';
import type { ColumnsType } from 'antd/es/table';

export default function DashboardClient() {
	const { token } = useAuth();
	const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		if (!token) return;

		setLoading(true);
		setError(null);

		try {
			const response = await apiFetch<DashboardSummary>('/dashboard', { token });
			setDashboard(response);
			// Set currency config from API
			if (response.currency) {
				setCurrencyConfig(response.currency);
			}
		} catch (err) {
			console.error(err);
			const errorMessage = err instanceof Error ? err.message : 'Unable to load dashboard data.';
			setError(errorMessage);
			message.error(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const billColumns: ColumnsType<Bill> = [
		{
			title: 'Month',
			dataIndex: 'for_month',
			key: 'for_month',
			render: (text, record) => (
				<div>
					<div className="font-medium">{text}</div>
					{/* <div className="text-xs text-gray-500">Ref: {record.reference}</div> */}
				</div>
			),
		},
		{
			title: 'Due Date',
			dataIndex: 'due_date',
			key: 'due_date',
			render: (date) => (date ? formatDate(date) : '—'),
		},
		{
			title: 'Amount',
			dataIndex: 'final_total',
			key: 'final_total',
			render: (amount) => formatCurrency(amount),
		},
		{
			title: 'Status',
			dataIndex: 'status',
			key: 'status',
			render: (status) => {
				const colorMap: Record<string, string> = {
					paid: 'green',
					partial: 'orange',
					pending: 'default',
					issued: 'blue',
					overdue: 'red',
					draft: 'default',
				};
				return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
			},
		},
		{
			title: 'Shares',
			key: 'shares',
			render: (_, record) => `${record.shares?.length ?? 0} allocations`,
		},
	];

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-4 sm:px-6 sm:py-6 shadow-sm text-white">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							Overview
						</p>
						<h1 className="mt-1 text-xl font-semibold sm:text-2xl">
							House Utility Dashboard
						</h1>
						<p className="mt-1 text-sm text-slate-300">
							Live summary of shared bills, payments, and outstanding balances.
						</p>
					</div>
				</div>
			</div>

			{loading ? (
				<div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white/70">
					<Spin size="large" />
				</div>
			) : error ? (
				<Card className="border-red-100 bg-red-50/80">
					<div className="text-center text-red-700">
						<ExclamationCircleOutlined className="mb-2 text-2xl" />
						<p className="font-medium">{error}</p>
						<p className="mt-1 text-sm text-red-500">
							Please try again in a moment. If the issue persists, contact the house admin.
						</p>
					</div>
				</Card>
			) : (
				<>
					<Row gutter={[16, 16]}>
						<Col xs={24} sm={12} lg={8}>
							<Card
								bordered={false}
								className="h-full rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-slate-50 to-sky-100"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
											Total Due
										</p>
										<p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
											<span className="bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-500 bg-clip-text text-transparent">
												{formatCurrency(dashboard?.totals.total_due ?? 0)}
											</span>
										</p>
									</div>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm sm:h-11 sm:w-11">
										<DollarOutlined />
									</div>
                                </div>
							</Card>
						</Col>
						<Col xs={24} sm={12} lg={8}>
							<Card
								bordered={false}
								className="h-full rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-100"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
											Total Paid
										</p>
										<p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
											<span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
												{formatCurrency(dashboard?.totals.total_paid ?? 0)}
											</span>
										</p>
									</div>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm sm:h-11 sm:w-11">
										<CheckCircleOutlined />
									</div>
								</div>
							</Card>
						</Col>
						<Col xs={24} sm={12} lg={8}>
							<Card
								bordered={false}
								className="h-full rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-slate-50 to-rose-100"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
											Outstanding Balance
										</p>
										<p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
											<span className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
												{formatCurrency(dashboard?.totals.total_outstanding ?? 0)}
											</span>
										</p>
									</div>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm sm:h-11 sm:w-11">
										<ExclamationCircleOutlined />
									</div>
								</div>
							</Card>
						</Col>
					</Row>

					<Card
						title={<span className="text-sm font-semibold text-slate-800">Latest Bills</span>}
						className="mt-4 rounded-2xl border border-slate-200 bg-white"
						bordered={false}
					>
						<Table
							columns={billColumns}
							dataSource={dashboard?.latest_bills ?? []}
							rowKey="id"
							pagination={{ pageSize: 10 }}
							size="small"
							className="table-compact"
						/>
					</Card>
				</>
			)}
		</div>
	);
}

