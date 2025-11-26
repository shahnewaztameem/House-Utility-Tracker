'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';

export default function LoginCard() {
	const { login } = useAuth();
	const router = useRouter();
	const [form] = Form.useForm();
	const [serverError, setServerError] = useState<string | null>(null);

	const handleSubmit = async (values: { email: string; password: string }) => {
		try {
			setServerError(null);
			await login(values.email, values.password);
			message.success('Login successful');
			router.push('/dashboard');
		} catch (err) {
			console.error(err);
			const errorMessage =
				err instanceof Error && err.message
					? err.message
					: 'Unable to sign in with those credentials. Please double-check and try again.';
			setServerError(errorMessage);
			message.error(errorMessage);
		}
	};

	return (
		<div className="w-full max-w-md mx-4 sm:mx-auto rounded-3xl border border-white/30 bg-white/10 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.6)]">
			<div className="px-8 pt-8 pb-2 text-center">
				<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-50 drop-shadow">
					House Utility Tracker
				</h1>
				<p className="mt-2 text-sm text-slate-200/80">
					Sign in to manage your house bills and usage in one place.
				</p>
				{serverError && (
					<p className="mt-3 text-sm font-medium text-red-300 drop-shadow">
						{serverError}
					</p>
				)}
			</div>
			<div className="px-8 pb-8 pt-2">
				<Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
					<Form.Item
						name="email"
						rules={[
							{ required: true, message: 'Please enter your email' },
							{ type: 'email', message: 'Please enter a valid email' },
						]}
					>
						<Input prefix={<UserOutlined />} placeholder="you@example.com" size="large" />
					</Form.Item>
					<Form.Item
						name="password"
						rules={[{ required: true, message: 'Please enter your password' }]}
					>
						<Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
					</Form.Item>
					<Form.Item>
						<Button
							type="primary"
							htmlType="submit"
							block
							size="large"
							className="h-11 font-medium tracking-wide"
						>
							Sign In
						</Button>
					</Form.Item>
				</Form>
			</div>
		</div>
	);
}

