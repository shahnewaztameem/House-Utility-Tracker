'use client';

import { Suspense } from 'react';
import SettingsClient from '@/components/pages/SettingsClient';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Spin } from 'antd';

export default function SettingsPage() {
	return (
		<ProtectedRoute requiredAbility="manage_settings">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<SettingsClient />
			</Suspense>
		</ProtectedRoute>
	);
}

