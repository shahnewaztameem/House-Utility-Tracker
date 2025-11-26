'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import UserManagementClient from '@/components/pages/UserManagementClient';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function UserManagementPage() {
	return (
		<ProtectedRoute requiredAbility="manage_settings">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<UserManagementClient />
			</Suspense>
		</ProtectedRoute>
	);
}

