'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { Card, Table, Tag, message, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Space, Row, Col } from 'antd';
import { ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { BillShare, PaymentPayload } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';

export default function SharesClient() {
	const { token, user } = useAuth();
	const [shares, setShares] = useState<BillShare[]>([]);
	const [loading, setLoading] = useState(true);
	const [paymentModalVisible, setPaymentModalVisible] = useState(false);
	const [selectedShare, setSelectedShare] = useState<BillShare | null>(null);
	const [paymentLoading, setPaymentLoading] = useState(false);
	const [form] = Form.useForm();

	const loadShares = useCallback(async () => {
		if (!token) return;

		setLoading(true);
		try {
			const response = await apiFetch<{ data: BillShare[] }>('/bill-shares', { token });
			setShares(response.data);
		} catch (err) {
			console.error(err);
			message.error('Failed to load shares');
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadShares();
	}, [loadShares]);

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
			form.resetFields();
			await loadShares();
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Failed to record payment');
		} finally {
			setPaymentLoading(false);
		}
	};

	const openPaymentModal = (share: BillShare) => {
		setSelectedShare(share);
		form.setFieldsValue({
			amount: share.outstanding,
			paid_on: dayjs(),
			method: 'cash',
		});
		setPaymentModalVisible(true);
	};

	const outstandingShares = useMemo(
		() => shares.filter((share) => share.outstanding > 0),
		[shares]
	);

	const baseColumns: ColumnsType<BillShare> = [
		{
			title: 'User',
			key: 'user',
			fixed: 'left' as const,
			width: 150,
			render: (_, record) => (
				<div>
					<div className="font-medium text-sm">{record.user?.name || 'Unknown'}</div>
					{/* <div className="text-xs text-gray-500">{(record.user as any)?.role_label || record.user?.role || ''}</div> */}
				</div>
			),
		},
		{
			title: 'Bill Ref',
			key: 'bill',
			render: (_, record) => <span className="text-xs font-mono">{record.bill?.reference || '—'}</span>,
			responsive: ['md'],
		},
		{
			title: 'Due',
			dataIndex: 'amount_due',
			key: 'amount_due',
			render: (amount) => <span className="font-medium">{formatCurrency(amount)}</span>,
			responsive: ['sm'],
		},
		{
			title: 'Paid',
			dataIndex: 'amount_paid',
			key: 'amount_paid',
			render: (amount) => <span className="text-green-600">{formatCurrency(amount)}</span>,
			responsive: ['md'],
		},
		{
			title: 'Outstanding',
			key: 'outstanding',
			render: (_, record) => (
				<span className={record.outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-medium'}>
					{formatCurrency(record.outstanding)}
				</span>
			),
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
			render: (date) => (date ? <span className="text-xs">{formatDate(date)}</span> : '—'),
			responsive: ['lg'],
		},
	];

	// Only non-resident roles see the Actions column on the Shares & Payments page
	const columns: ColumnsType<BillShare> =
		user?.role === 'resident'
			? baseColumns
			: [
					...baseColumns,
					{
						title: 'Actions',
						key: 'actions',
						fixed: 'right' as const,
						width: 130,
						render: (_, record) => (
							<Button
								type="primary"
								size="small"
								icon={<DollarOutlined />}
								disabled={record.outstanding <= 0}
								onClick={() => openPaymentModal(record)}
								block
							>
								<span className="hidden sm:inline">Record</span>
								<span className="sm:hidden">Pay</span>
							</Button>
						),
					},
			  ];

	return (
		<div className="space-y-4 sm:space-y-6">
			<Card
				className="overflow-hidden"
				title={<span className="text-lg font-semibold">Shares & Payments</span>}
				extra={
					<Button icon={<ReloadOutlined />} onClick={loadShares} loading={loading}>
						Refresh
					</Button>
				}
			>
				<div className="overflow-x-auto">
					<Table
						columns={columns}
						dataSource={shares}
						rowKey="id"
						loading={loading}
						pagination={{ 
							pageSize: 20, 
							showSizeChanger: true,
							showTotal: (total) => `Total ${total} shares`,
							responsive: true,
						}}
						size="small"
						scroll={{ x: 'max-content' }}
						className="table-compact"
					/>
				</div>
			</Card>

			{outstandingShares.length > 0 && (
				<Card className="bg-amber-50 border-amber-200">
					<div className="text-sm text-amber-800 font-medium">
						{outstandingShares.length} share(s) still have outstanding balances.
					</div>
				</Card>
			)}

			<Modal
				title="Record Payment"
				open={paymentModalVisible}
				onCancel={() => {
					setPaymentModalVisible(false);
					form.resetFields();
				}}
				footer={null}
				width="90%"
				style={{ maxWidth: 1200 }}
			>
				<Form
					form={form}
					layout="vertical"
					onFinish={handleRecordPayment}
					initialValues={{
						method: 'cash',
						paid_on: dayjs(),
					}}
				>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Amount" name="amount" rules={[{ required: true, message: 'Please enter amount' }]}>
								<InputNumber
									min={0.01}
									step={0.01}
									prefix="৳"
									style={{ width: '100%' }}
									precision={2}
								/>
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Paid On" name="paid_on" rules={[{ required: true, message: 'Please select date' }]}>
								<DatePicker style={{ width: '100%' }} />
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Payment Method" name="method" rules={[{ required: true }]}>
								<Select>
									<Select.Option value="cash">Cash</Select.Option>
									<Select.Option value="bank">Bank Transfer</Select.Option>
									<Select.Option value="check">Check</Select.Option>
									<Select.Option value="other">Other</Select.Option>
								</Select>
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Reference" name="reference">
								<Input placeholder="Transaction reference (optional)" />
							</Form.Item>
						</Col>
					</Row>

					<Row gutter={[16, 20]}>
						<Col xs={24} sm={24} md={24} lg={12}>
							<Form.Item label="Notes" name="notes">
								<Input.TextArea rows={3} placeholder="Additional notes (optional)" />
							</Form.Item>
						</Col>
					</Row>

					<div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
						<Button onClick={() => setPaymentModalVisible(false)} size="large">
							Cancel
						</Button>
						<Button type="primary" htmlType="submit" loading={paymentLoading} size="large">
							Record Payment
						</Button>
					</div>
				</Form>
			</Modal>
		</div>
	);
}

