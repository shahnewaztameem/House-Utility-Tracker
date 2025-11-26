'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import ElectricityReadingsClient from '@/components/pages/ElectricityReadingsClient';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ElectricityPage() {
	return (
		<ProtectedRoute requiredAbility="manage_settings">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<ElectricityReadingsClient />
			</Suspense>
		</ProtectedRoute>
	);
}

