'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Tag, message, Button, Space } from 'antd';
import { ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Bill } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';

export default function BillsClient() {
	const { token, user } = useAuth();
	const router = useRouter();
	const [bills, setBills] = useState<Bill[]>([]);
	const [loading, setLoading] = useState(true);
	
	// Check if user can edit bills (admin or super_admin)
	const canEdit = user?.abilities?.manage_bills || user?.role === 'admin' || user?.role === 'super_admin';

	const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

	const loadBills = useCallback(async (page = 1, pageSize = 20) => {
		if (!token) return;

		setLoading(true);
		try {
			const response = await apiFetch<{ data: Bill[]; meta?: { total: number; per_page: number; current_page: number } }>(
				`/bills?per_page=${pageSize}&page=${page}`,
				{ token }
			);
			setBills(response.data);
			if (response.meta) {
				setPagination({
					current: response.meta.current_page,
					pageSize: response.meta.per_page,
					total: response.meta.total,
				});
			}
		} catch (err) {
			console.error(err);
			message.error('Failed to load bills');
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadBills();
	}, [loadBills]);

	const columns: ColumnsType<Bill> = [
		{
			title: 'Reference',
			dataIndex: 'reference',
			key: 'reference',
			width: 120,
			fixed: 'left' as const,
			responsive: ['md'],
		},
		{
			title: 'Month',
			dataIndex: 'for_month',
			key: 'for_month',
			render: (text) => <span className="font-medium">{text}</span>,
			responsive: ['sm'],
		},
		{
			title: 'Due Date',
			dataIndex: 'due_date',
			key: 'due_date',
			render: (date) => (date ? formatDate(date) : '—'),
			responsive: ['md'],
		},
		{
			title: 'Amount',
			dataIndex: 'final_total',
			key: 'final_total',
			render: (amount) => <span className="font-semibold text-blue-600">{formatCurrency(amount)}</span>,
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
			title: 'Created By',
			key: 'created_by',
			render: (_, record) => {
				if (!record.created_by) return '—';
				return (
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
							{record.created_by.name.charAt(0).toUpperCase()}
						</div>
						<span className="text-xs">{record.created_by.name}</span>
					</div>
				);
			},
			responsive: ['lg'],
		},
		{
			title: 'Created At',
			dataIndex: 'created_at',
			key: 'created_at',
			render: (date) => (date ? formatDate(date) : '—'),
			responsive: ['lg'],
		},
		{
			title: 'Paid At',
			key: 'paid_at',
			render: (_, record) => {
				if (!record.shares || record.shares.length === 0) return '—';
				const lastPaidDates = record.shares
					.map((share) => share.last_paid_at)
					.filter((date) => date !== null)
					.sort()
					.reverse();
				return lastPaidDates.length > 0 ? formatDate(lastPaidDates[0]) : '—';
			},
			responsive: ['lg'],
		},
		{
			title: 'Owed To',
			key: 'owed_to',
			render: (_, record) => {
				if (!record.shares || record.shares.length === 0) return '—';
				const usersWithOutstanding = record.shares.filter((share) => share.outstanding > 0);
				if (usersWithOutstanding.length === 0) return <span className="text-green-600">All Paid</span>;
				
				return (
					<div className="flex flex-wrap gap-1">
						{usersWithOutstanding.slice(0, 2).map((share) => (
							<div
								key={share.id}
								className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 border border-orange-200 rounded text-xs"
							>
								<div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
									{share.user.name.charAt(0).toUpperCase()}
								</div>
								<span className="text-gray-700">{share.user.name}</span>
							</div>
						))}
						{usersWithOutstanding.length > 2 && (
							<div className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
								+{usersWithOutstanding.length - 2}
							</div>
						)}
					</div>
				);
			},
			responsive: ['xl'],
		},
		{
			title: 'Actions',
			key: 'actions',
			fixed: 'right' as const,
			width: canEdit ? 150 : 100,
			render: (_, record) => (
				<Space>
					<Button
						type="link"
						icon={<EyeOutlined />}
						onClick={() => router.push(`/bills/${record.id}`)}
						size="small"
					>
						<span className="hidden sm:inline">View</span>
					</Button>
					{canEdit && (
						<Button
							type="link"
							icon={<EditOutlined />}
							onClick={() => router.push(`/bills/${record.id}/edit`)}
							size="small"
						>
							<span className="hidden sm:inline">Edit</span>
						</Button>
					)}
				</Space>
			),
		},
	];

	return (
		<div className="space-y-4 sm:space-y-6">
			<Card
				className="overflow-hidden"
				title={<span className="text-lg font-semibold">Bills</span>}
				extra={
					<Button 
						icon={<ReloadOutlined />} 
						onClick={() => loadBills(pagination.current, pagination.pageSize)} 
						loading={loading}
					>
						Refresh
					</Button>
				}
			>
				<div className="overflow-x-auto">
					<Table
						columns={columns}
						dataSource={bills}
						rowKey="id"
						loading={loading}
						pagination={{
							current: pagination.current,
							pageSize: pagination.pageSize,
							total: pagination.total,
							showSizeChanger: true,
							showTotal: (total) => `Total ${total} bills`,
							responsive: true,
							onChange: (page, pageSize) => {
								loadBills(page, pageSize);
							},
							onShowSizeChange: (current, size) => {
								loadBills(1, size);
							},
						}}
						size="small"
						scroll={{ x: 'max-content' }}
						className="table-compact"
					/>
				</div>
			</Card>
		</div>
	);
}

