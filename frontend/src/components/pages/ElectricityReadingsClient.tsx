'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, InputNumber, Select, Row, Col, message, Space, Popconfirm, Modal } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, DeleteOutlined, SaveOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { ElectricityReading } from '@/types';
import type { ColumnsType } from 'antd/es/table';

interface MonthYearOption {
	value: string | number;
	label: string;
}

interface MonthYearResponse {
	months: MonthYearOption[];
	years: MonthYearOption[];
}

const unitsConsumed = (reading: ElectricityReading) => {
	if (reading.end_unit === null || reading.end_unit === undefined) {
		return null;
	}

	return Math.max(0, reading.end_unit - reading.start_unit);
};

export default function ElectricityReadingsClient() {
	const { token } = useAuth();
	const [form] = Form.useForm();
	const [readings, setReadings] = useState<ElectricityReading[]>([]);
	const [monthOptions, setMonthOptions] = useState<MonthYearOption[]>([]);
	const [yearOptions, setYearOptions] = useState<MonthYearOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

	const loadData = useCallback(async (page = 1, pageSize = 15) => {
		if (!token) return;

		setLoading(true);
		try {
			const [readingsRes, monthYearRes] = await Promise.all([
				apiFetch<{ data: ElectricityReading[]; meta?: { total: number; per_page: number; current_page: number } }>(
					`/electricity-readings?paginate=true&per_page=${pageSize}&page=${page}`,
					{ token }
				),
				apiFetch<MonthYearResponse>('/bills/month-year-options', { token }),
			]);

			setReadings(readingsRes.data);
			if (readingsRes.meta) {
				setPagination({
					current: readingsRes.meta.current_page,
					pageSize: readingsRes.meta.per_page,
					total: readingsRes.meta.total,
				});
			}
			setMonthOptions(monthYearRes.months);
			setYearOptions(monthYearRes.years);
		} catch (err) {
			console.error(err);
			message.error('Failed to load electricity readings');
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleSubmit = async (values: {
		month: string;
		year: number;
		start_unit: number;
		end_unit?: number;
	}) => {
		if (!token) return;

		setSubmitting(true);
		try {
			await apiFetch('/electricity-readings', {
				method: 'POST',
				token,
				body: values,
			});
			message.success('Electricity reading saved');
			form.resetFields();
			setModalOpen(false);
			await loadData(pagination.current, pagination.pageSize);
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Unable to save reading');
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = useCallback(
		async (id: number) => {
			if (!token) return;

			try {
				await apiFetch(`/electricity-readings/${id}`, {
					method: 'DELETE',
					token,
				});
				message.success('Reading removed');
				await loadData(pagination.current, pagination.pageSize);
			} catch (err) {
				console.error(err);
				message.error('Failed to delete reading');
			}
		},
		[token, loadData]
	);

	const columns: ColumnsType<ElectricityReading> = useMemo(
		() => [
			{
				title: 'Month',
				dataIndex: 'month',
				key: 'month',
			},
			{
				title: 'Year',
				dataIndex: 'year',
				key: 'year',
			},
			{
				title: 'Start Unit',
				dataIndex: 'start_unit',
				key: 'start_unit',
			},
			{
				title: 'End Unit',
				dataIndex: 'end_unit',
				key: 'end_unit',
				render: (value: number | null | undefined) => (value ?? '—'),
			},
			{
				title: 'Units Used',
				key: 'units',
				render: (_, record) => {
					const units = unitsConsumed(record);
					return units !== null ? units : '—';
				},
			},
			{
				title: 'Recorded By',
				key: 'recorded_by',
				render: (_, record) => record.recorded_by?.name ?? '—',
			},
			{
				title: 'Actions',
				key: 'actions',
				render: (_, record) => (
					<Popconfirm
						title="Delete reading?"
						description="Are you sure you want to delete this reading?"
						onConfirm={() => handleDelete(record.id)}
						okText="Delete"
						okButtonProps={{ danger: true }}
					>
						<Button danger type="link" icon={<DeleteOutlined />} size="small">
							Delete
						</Button>
					</Popconfirm>
				),
			},
		],
		[handleDelete],
	);

	return (
		<div className="space-y-6">

			<Modal
				title="Record Electricity Reading"
				open={modalOpen}
				onCancel={() => {
					setModalOpen(false);
					form.resetFields();
				}}
				footer={null}
				width="90%"
				style={{ maxWidth: 1200 }}
			>
				<Form
					form={form}
					layout="vertical"
					onFinish={handleSubmit}
					initialValues={{
						month: new Date().toLocaleString('en-US', { month: 'long' }),
						year: new Date().getFullYear(),
					}}
				>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Month"
								name="month"
								rules={[{ required: true, message: 'Please select month' }]}
							>
								<Select placeholder="Select month" options={monthOptions} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Year"
								name="year"
								rules={[{ required: true, message: 'Please select year' }]}
							>
								<Select placeholder="Select year" options={yearOptions} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Start Unit"
								name="start_unit"
								rules={[{ required: true, message: 'Enter start unit' }]}
							>
								<InputNumber min={0} step={1} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="End Unit"
								name="end_unit"
								rules={[{ required: false, type: 'number', min: 0 }]}
							>
								<InputNumber min={0} step={1} style={{ width: '100%' }} />
							</Form.Item>
						</Col>
					</Row>
					<div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
						<Button onClick={() => form.resetFields()} size="large">
							Clear
						</Button>
						<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting} size="large">
							Save Reading
						</Button>
					</div>
				</Form>
			</Modal>

			<Card
				title={
					<span className="text-lg font-semibold flex items-center gap-2">
						<ThunderboltOutlined />
						Electricity Units
					</span>
				}
				extra={
					<Space>
						<Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)} loading={loading}>
							Refresh
						</Button>
						<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
							Record Reading
						</Button>
					</Space>
				}
			>
				<Table
					rowKey="id"
					columns={columns}
					dataSource={readings}
					loading={loading}
					pagination={{
						current: pagination.current,
						pageSize: pagination.pageSize,
						total: pagination.total,
						showSizeChanger: true,
						showTotal: (total) => `Total ${total} readings`,
						onChange: (page, pageSize) => {
							loadData(page, pageSize);
						},
						onShowSizeChange: (current, size) => {
							loadData(1, size);
						},
					}}
					size="small"
					className="table-compact"
				/>
			</Card>
		</div>
	);
}

