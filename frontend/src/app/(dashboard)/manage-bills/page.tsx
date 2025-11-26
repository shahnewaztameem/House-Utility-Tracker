'use client';

import { Suspense } from 'react';
import ManageBillsClient from '@/components/pages/ManageBillsClient';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Spin } from 'antd';

export default function ManageBillsPage() {
	return (
		<ProtectedRoute requiredAbility="manage_bills">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<ManageBillsClient />
			</Suspense>
		</ProtectedRoute>
	);
}

