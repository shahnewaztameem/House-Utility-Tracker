'use client';

import { useCallback, useEffect, useState } from 'react';
import {
	Card,
	Descriptions,
	Tag,
	message,
	Button,
	Table,
	Space,
	Divider,
	Spin,
	Modal,
	Form,
	InputNumber,
	DatePicker,
	Select,
	Input,
} from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Bill, BillShare, PaymentPayload } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import dayjs, { type Dayjs } from 'dayjs';

interface BillDetailClientProps {
	billId: string;
}

export default function BillDetailClient({ billId }: BillDetailClientProps) {
	const { token, user } = useAuth();
	const router = useRouter();
	const [bill, setBill] = useState<Bill | null>(null);
	const [loading, setLoading] = useState(true);
	const [paymentModalVisible, setPaymentModalVisible] = useState(false);
	const [selectedShare, setSelectedShare] = useState<BillShare | null>(null);
	const [paymentLoading, setPaymentLoading] = useState(false);
	const [paymentForm] = Form.useForm();
	
	// Check if user can edit bills (admin or super_admin)
	const canEdit = user?.abilities?.manage_bills || user?.role === 'admin' || user?.role === 'super_admin';

	const loadBill = useCallback(async () => {
		if (!token || !billId) return;

		setLoading(true);
		try {
			const response = await apiFetch<{ data: Bill }>(`/bills/${billId}`, { token });
			setBill(response.data);
		} catch (err) {
			console.error(err);
			message.error('Failed to load bill details');
			router.push('/bills');
		} finally {
			setLoading(false);
		}
	}, [token, billId, router]);

	useEffect(() => {
		loadBill();
	}, [loadBill]);

	const openPaymentModal = (share: BillShare) => {
		setSelectedShare(share);
		paymentForm.setFieldsValue({
			amount: share.outstanding,
			paid_on: dayjs(),
			method: 'cash',
		});
		setPaymentModalVisible(true);
	};

	const handleRecordPayment = async (values: {
		amount: number;
		paid_on: Dayjs;
		method: string;
		reference?: string;
		notes?: string;
	}) => {
		if (!token || !selectedShare) return;

		setPaymentLoading(true);
		try {
			const payload: PaymentPayload = {
				bill_share_id: selectedShare.id,
				amount: values.amount,
				paid_on: values.paid_on.format('YYYY-MM-DD'),
				method: values.method,
				reference: values.reference || '',
				notes: values.notes || '',
			};

			await apiFetch('/payments', {
				method: 'POST',
				token,
				body: payload,
			});

			message.success('Payment recorded successfully');
			setPaymentModalVisible(false);
			paymentForm.resetFields();
			await loadBill();
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Failed to record payment');
		} finally {
			setPaymentLoading(false);
		}
	};

	const shareColumns: ColumnsType<BillShare> = [
		{
			title: 'User',
			key: 'user',
			render: (_, record) => (
				<div>
					<div className="font-medium">{record.user.name}</div>
					
				</div>
			),
		},
		{
			title: 'Amount Due',
			dataIndex: 'amount_due',
			key: 'amount_due',
			render: (amount) => <span className="font-semibold">{formatCurrency(amount)}</span>,
		},
		{
			title: 'Amount Paid',
			dataIndex: 'amount_paid',
			key: 'amount_paid',
			render: (amount) => <span className="text-green-600">{formatCurrency(amount)}</span>,
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
				};
				return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
			},
		},
		{
			title: 'Last Paid',
			dataIndex: 'last_paid_at',
			key: 'last_paid_at',
			render: (date) => (date ? formatDate(date) : '—'),
		},
	];

	// Only non-resident roles see the Actions column (record payment from bill details)
	const shareColumnsWithActions: ColumnsType<BillShare> =
		user?.role === 'resident'
			? shareColumns
			: [
					...shareColumns,
					{
						title: 'Actions',
						key: 'actions',
						render: (_, record) => (
							<Button
								type="primary"
								size="small"
								disabled={record.outstanding <= 0}
								onClick={() => openPaymentModal(record)}
							>
								Record Payment
							</Button>
						),
					},
			  ];

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[400px]">
				<Spin size="large" />
			</div>
		);
	}

	if (!bill) {
		return null;
	}

	const statusColorMap: Record<string, string> = {
		paid: 'green',
		partial: 'orange',
		pending: 'default',
		issued: 'blue',
		overdue: 'red',
		draft: 'default',
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div className="flex items-center gap-4">
					<Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/bills')}>
						Back
					</Button>
					<div>
						<h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Bill Details</h1>
						<p className="text-sm sm:text-base text-gray-600">Reference: {bill.reference}</p>
					</div>
				</div>
				<Space>
					{canEdit && (
						<Button icon={<EditOutlined />} onClick={() => router.push(`/bills/${billId}/edit`)} size="large" className="w-full sm:w-auto">
							<span className="hidden sm:inline">Edit</span>
							<span className="sm:hidden">Edit</span>
						</Button>
					)}
					<Button icon={<ReloadOutlined />} onClick={loadBill} loading={loading} size="large" className="w-full sm:w-auto">
						<span className="hidden sm:inline">Refresh</span>
						<span className="sm:hidden">Reload</span>
					</Button>
				</Space>
			</div>

			<Card title="Bill Information" className="mb-4">
				<Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
					<Descriptions.Item label="Reference">{bill.reference}</Descriptions.Item>
					<Descriptions.Item label="Month">{bill.for_month}</Descriptions.Item>
					<Descriptions.Item label="Due Date">{bill.due_date ? formatDate(bill.due_date) : '—'}</Descriptions.Item>
					<Descriptions.Item label="Status">
						<Tag color={statusColorMap[bill.status] || 'default'}>{bill.status.toUpperCase()}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="Total Due">{formatCurrency(bill.total_due)}</Descriptions.Item>
					<Descriptions.Item label="Returned Amount">{formatCurrency(bill.returned_amount)}</Descriptions.Item>
					<Descriptions.Item label="Final Total">
						<span className="font-semibold text-blue-600">{formatCurrency(bill.final_total)}</span>
					</Descriptions.Item>
					{bill.created_at && (
						<Descriptions.Item label="Created At">{formatDate(bill.created_at)}</Descriptions.Item>
					)}
					{bill.created_by && (
						<Descriptions.Item label="Created By">
							<div className="flex items-center gap-2">
								<div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
									{bill.created_by.name.charAt(0).toUpperCase()}
								</div>
								<span className="font-medium">{bill.created_by.name}</span>
							</div>
						</Descriptions.Item>
					)}
					{bill.shares && bill.shares.length > 0 && (
						<Descriptions.Item label="Paid To" span={3}>
							<div className="flex flex-wrap gap-2">
								{bill.shares.map((share) => (
									<div key={share.id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200">
										<div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
											{share.user.name.charAt(0).toUpperCase()}
										</div>
										<span className="text-sm font-medium text-gray-700">{share.user.name}</span>
										<span className="text-xs text-gray-500">({formatCurrency(share.amount_due)})</span>
									</div>
								))}
							</div>
						</Descriptions.Item>
					)}
				</Descriptions>
			</Card>

			{bill.line_items && bill.line_items.length > 0 && (
				<Card title="Charge Items" className="mb-4">
					<Table
						dataSource={bill.line_items}
						rowKey="key"
						pagination={false}
						size="small"
						className="table-compact"
						columns={[
							{
								title: 'Item',
								dataIndex: 'label',
								key: 'label',
								render: (label, record) => label || record.key,
							},
							{
								title: 'Amount',
								dataIndex: 'amount',
								key: 'amount',
								render: (amount) => formatCurrency(amount),
								align: 'right',
							},
						]}
					/>
				</Card>
			)}

			{bill.electricity_units !== undefined && bill.electricity_units !== null && (
				<Card title="Electricity Details" className="mb-4">
					<Descriptions bordered column={{ xs: 1, sm: 2 }}>
						{bill.electricity_start_unit !== null && (
							<Descriptions.Item label="Start Unit">{bill.electricity_start_unit}</Descriptions.Item>
						)}
						{bill.electricity_end_unit !== null && (
							<Descriptions.Item label="End Unit">{bill.electricity_end_unit}</Descriptions.Item>
						)}
						<Descriptions.Item label="Units Consumed">{bill.electricity_units}</Descriptions.Item>
						{bill.electricity_rate !== undefined && (
							<Descriptions.Item label="Rate per Unit">{formatCurrency(bill.electricity_rate)}</Descriptions.Item>
						)}
						{bill.electricity_bill !== undefined && (
							<Descriptions.Item label="Electricity Bill">
								<span className="font-semibold">{formatCurrency(bill.electricity_bill)}</span>
							</Descriptions.Item>
						)}
					</Descriptions>
				</Card>
			)}

			{bill.shares && bill.shares.length > 0 && (
				<Card title="Bill Shares">
					<Table
						columns={shareColumnsWithActions}
						dataSource={bill.shares}
						rowKey="id"
						pagination={false}
						size="small"
						className="table-compact"
						summary={(pageData) => {
							const totalDue = pageData.reduce((sum, record) => sum + record.amount_due, 0);
							const totalPaid = pageData.reduce((sum, record) => sum + record.amount_paid, 0);
							return (
								<Table.Summary fixed>
									<Table.Summary.Row>
										<Table.Summary.Cell index={0}>
											<span className="font-semibold">Total</span>
										</Table.Summary.Cell>
										<Table.Summary.Cell index={1}>
											<span className="font-semibold">{formatCurrency(totalDue)}</span>
										</Table.Summary.Cell>
										<Table.Summary.Cell index={2}>
											<span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
										</Table.Summary.Cell>
										<Table.Summary.Cell index={3}></Table.Summary.Cell>
										<Table.Summary.Cell index={4}></Table.Summary.Cell>
									</Table.Summary.Row>
								</Table.Summary>
							);
						}}
					/>
				</Card>
			)}

			{bill.notes && (
				<Card title="Notes">
					<p className="text-gray-700 whitespace-pre-wrap">{bill.notes}</p>
				</Card>
			)}

			<Modal
				title="Record Payment"
				open={paymentModalVisible}
				onCancel={() => {
					setPaymentModalVisible(false);
					paymentForm.resetFields();
				}}
				footer={null}
				width="90%"
				style={{ maxWidth: 640 }}
			>
				<Form
					form={paymentForm}
					layout="vertical"
					onFinish={handleRecordPayment}
					initialValues={{
						method: 'cash',
						paid_on: dayjs(),
					}}
				>
					<Space direction="vertical" size="large" className="w-full">
						<div className="grid gap-4 md:grid-cols-2">
							<Form.Item
								label="Amount"
								name="amount"
								rules={[{ required: true, message: 'Please enter amount' }]}
							>
								<InputNumber
									min={0.01}
									step={0.01}
									prefix="৳"
									style={{ width: '100%' }}
									precision={2}
								/>
							</Form.Item>
							<Form.Item
								label="Paid On"
								name="paid_on"
								rules={[{ required: true, message: 'Please select date' }]}
							>
								<DatePicker style={{ width: '100%' }} />
							</Form.Item>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<Form.Item
								label="Payment Method"
								name="method"
								rules={[{ required: true, message: 'Please select method' }]}
							>
								<Select>
									<Select.Option value="cash">Cash</Select.Option>
									<Select.Option value="bank">Bank Transfer</Select.Option>
									<Select.Option value="check">Check</Select.Option>
									<Select.Option value="other">Other</Select.Option>
								</Select>
							</Form.Item>
							<Form.Item label="Reference" name="reference">
								<Input placeholder="Transaction reference (optional)" />
							</Form.Item>
						</div>

						<Form.Item label="Notes" name="notes">
							<Input.TextArea rows={3} placeholder="Additional notes (optional)" />
						</Form.Item>

						<div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
							<Button
								onClick={() => {
									setPaymentModalVisible(false);
									paymentForm.resetFields();
								}}
							>
								Cancel
							</Button>
							<Button type="primary" htmlType="submit" loading={paymentLoading}>
								Record Payment
							</Button>
						</div>
					</Space>
				</Form>
			</Modal>
		</div>
	);
}

