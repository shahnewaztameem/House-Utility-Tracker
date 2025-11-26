'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import SettingsClient from '@/components/pages/SettingsClient';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SettingsPage() {
	return (
		<ProtectedRoute requiredAbility="manage_settings">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<SettingsClient />
			</Suspense>
		</ProtectedRoute>
	);
}

