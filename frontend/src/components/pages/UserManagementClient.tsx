'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Checkbox, Row, Col } from 'antd';
import { ReloadOutlined, UserAddOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { User } from '@/types';
import type { ColumnsType } from 'antd/es/table';

export default function UserManagementClient() {
	const { token } = useAuth();
	const [form] = Form.useForm();
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

	const loadUsers = useCallback(async (page = 1, pageSize = 15) => {
		if (!token) return;

		setLoading(true);
		try {
			const response = await apiFetch<{ data: User[]; meta?: { total: number; per_page: number; current_page: number } }>(
				`/users?paginate=true&per_page=${pageSize}&page=${page}`,
				{ token }
			);
			setUsers(response.data);
			if (response.meta) {
				setPagination({
					current: response.meta.current_page,
					pageSize: response.meta.per_page,
					total: response.meta.total,
				});
			}
		} catch (err) {
			console.error(err);
			message.error('Failed to load users');
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleSubmit = async (values: {
		name: string;
		email: string;
		password?: string;
		role: string;
		abilities?: { manage_bills?: boolean; manage_settings?: boolean; view_all_records?: boolean };
	}) => {
		if (!token) return;

		setSubmitting(true);
		try {
			if (editingUser) {
				await apiFetch(`/users/${editingUser.id}`, {
					method: 'PATCH',
					token,
					body: values,
				});
				message.success('User updated successfully');
			} else {
				await apiFetch('/users', {
					method: 'POST',
					token,
					body: values,
				});
				message.success('User created successfully');
			}
			setModalOpen(false);
			form.resetFields();
			setEditingUser(null);
			await loadUsers(pagination.current, pagination.pageSize);
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Failed to save user');
		} finally {
			setSubmitting(false);
		}
	};

	const handleEdit = (user: User) => {
		setEditingUser(user);
		form.setFieldsValue({
			name: user.name,
			email: user.email,
			role: user.role,
			abilities: user.abilities,
		});
		setModalOpen(true);
	};

	const handleCancel = () => {
		setModalOpen(false);
		setEditingUser(null);
		form.resetFields();
	};

	const columns: ColumnsType<User> = [
		{
			title: 'Name',
			dataIndex: 'name',
			key: 'name',
			render: (text) => <span className="font-medium">{text}</span>,
		},
		{
			title: 'Email',
			dataIndex: 'email',
			key: 'email',
		},
		{
			title: 'Role',
			dataIndex: 'role',
			key: 'role',
			render: (role, record) => {
				const colorMap: Record<string, string> = {
					super_admin: 'red',
					admin: 'blue',
					resident: 'default',
				};
				return <Tag color={colorMap[role] || 'default'}>{record.role_label || role}</Tag>;
			},
		},
		{
			title: 'Permissions',
			key: 'abilities',
			render: (_, record) => (
				<Space size="small">
					{record.abilities.manage_bills && <Tag color="green">Manage Bills</Tag>}
					{record.abilities.manage_settings && <Tag color="purple">Manage Settings</Tag>}
					{record.abilities.view_all_records && <Tag color="blue">View All</Tag>}
				</Space>
			),
		},
		{
			title: 'Actions',
			key: 'actions',
			render: (_, record) => (
				<Space>
					<Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">
						Edit
					</Button>
				</Space>
			),
		},
	];

	return (
		<div className="space-y-4 sm:space-y-6">
			<Card
				title={<span className="text-lg font-semibold">User Management</span>}
				extra={
					<Space>
						<Button icon={<ReloadOutlined />} onClick={() => loadUsers(pagination.current, pagination.pageSize)} loading={loading}>
							Refresh
						</Button>
						<Button type="primary" icon={<UserAddOutlined />} onClick={() => setModalOpen(true)}>
							Create User
						</Button>
					</Space>
				}
			>
				<Table
					columns={columns}
					dataSource={users}
					rowKey="id"
					loading={loading}
					pagination={{
						current: pagination.current,
						pageSize: pagination.pageSize,
						total: pagination.total,
						showSizeChanger: true,
						showTotal: (total) => `Total ${total} users`,
						onChange: (page, pageSize) => {
							loadUsers(page, pageSize);
						},
						onShowSizeChange: (current, size) => {
							loadUsers(1, size);
						},
					}}
					size="small"
					className="table-compact"
					scroll={{x: true}}
				/>
			</Card>

			<Modal
				title={editingUser ? 'Edit User' : 'Create User'}
				open={modalOpen}
				onCancel={handleCancel}
				footer={null}
				width="90%"
				style={{ maxWidth: 1200 }}
			>
				<Form
					form={form}
					layout="vertical"
					onFinish={handleSubmit}
					initialValues={{
						role: 'resident',
						abilities: {
							manage_bills: false,
							manage_settings: false,
							view_all_records: false,
						},
					}}
				>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
								<Input placeholder="Enter user name" />
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Email"
								name="email"
								rules={[
									{ required: true, message: 'Please enter email' },
									{ type: 'email', message: 'Please enter a valid email' },
								]}
							>
								<Input placeholder="Enter email address" disabled={!!editingUser} />
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Password"
								name="password"
								rules={[{ required: !editingUser, message: 'Please enter password' }, { min: 8, message: 'Password must be at least 8 characters' }]}
							>
								<Input.Password placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter password'} />
							</Form.Item>
						</Col>

						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Role" name="role" rules={[{ required: true, message: 'Please select role' }]}>
								<Select>
									<Select.Option value="resident">Resident</Select.Option>
									<Select.Option value="admin">Admin</Select.Option>
									<Select.Option value="super_admin">Super Admin</Select.Option>
								</Select>
							</Form.Item>
						</Col>
					</Row>

					<Row gutter={[16, 20]}>
						<Col xs={24} sm={24} md={24} lg={12}>
							<div>
								<div className="mb-2 text-sm font-medium text-gray-700">Permissions</div>
								<div className="flex flex-col gap-0">
									<Form.Item name={['abilities', 'manage_bills']} valuePropName="checked" className="!mb-0">
										<Checkbox>Manage Bills</Checkbox>
									</Form.Item>
									<Form.Item name={['abilities', 'manage_settings']} valuePropName="checked" className="!mb-0">
										<Checkbox>Manage Settings</Checkbox>
									</Form.Item>
									<Form.Item name={['abilities', 'view_all_records']} valuePropName="checked" className="!mb-0">
										<Checkbox>View All Records</Checkbox>
									</Form.Item>
								</div>
							</div>
						</Col>
					</Row>

					<div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
						<Button onClick={handleCancel} size="large">
							Cancel
						</Button>
						<Button type="primary" htmlType="submit" loading={submitting} size="large">
							{editingUser ? 'Update' : 'Create'}
						</Button>
					</div>
				</Form>
			</Modal>
		</div>
	);
}

