'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Row, Col, Space } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { BillingSetting, BillingSettingsPayload } from '@/types';

export default function SettingsClient() {
	const { token } = useAuth();
	const [form] = Form.useForm();
	const [settings, setSettings] = useState<BillingSetting[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const loadSettings = useCallback(async () => {
		if (!token) return;

		setLoading(true);
		try {
			const response = await apiFetch<{ data: BillingSetting[] }>('/billing-settings', { token });
			setSettings(response.data);
			const initialValues = response.data.reduce<Record<string, number>>((acc, setting) => {
				acc[setting.key] = setting.amount;
				return acc;
			}, {});
			form.setFieldsValue(initialValues);
		} catch (err) {
			console.error(err);
			message.error('Failed to load settings');
		} finally {
			setLoading(false);
		}
	}, [token, form]);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	const handleSubmit = async (values: Record<string, number>) => {
		if (!token) return;

		setSaving(true);
		try {
			const payload: BillingSettingsPayload = {
				settings: settings.map((setting) => ({
					key: setting.key,
					amount: Number(values[setting.key]) || 0,
					metadata: { label: setting.label },
				})),
			};

			await apiFetch('/billing-settings', {
				method: 'PUT',
				token,
				body: payload,
			});

			message.success('Settings saved successfully');
			await loadSettings();
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Failed to save settings');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			<Form form={form} layout="vertical" onFinish={handleSubmit}>
				<Card
					title={<span className="text-lg font-semibold">Billing Settings</span>}
					extra={
						<Button icon={<ReloadOutlined />} onClick={loadSettings} loading={loading}>
							Refresh
						</Button>
					}
				>
					<Row gutter={[16, 20]}>
						{settings.map((setting) => (
							<Col xs={24} sm={12} md={8} lg={4} key={setting.id ?? setting.key}>
								<Form.Item
									label={setting.label}
									name={setting.key}
									rules={[{ required: true, message: `Please enter ${setting.label}` }]}
								>
									<InputNumber
										min={0}
										step={0.01}
										prefix="৳"
										style={{ width: '100%' }}
										precision={2}
									/>
								</Form.Item>
							</Col>
						))}
					</Row>
				</Card>
				<Card className="mt-4 border-t-2 border-gray-200 bg-gray-50">
					<div className="flex flex-col sm:flex-row justify-end gap-3">
						<Button onClick={() => form.resetFields()} size="large">
							Reset
						</Button>
						<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
							Save Settings
						</Button>
					</div>
				</Card>
			</Form>
		</div>
	);
}

