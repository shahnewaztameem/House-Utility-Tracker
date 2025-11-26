'use client';

import { use } from 'react';
import { Suspense } from 'react';
import { Spin } from 'antd';
import ManageBillsClient from '@/components/pages/ManageBillsClient';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return (
		<ProtectedRoute requiredAbility="manage_bills">
			<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
				<ManageBillsClient billId={id} />
			</Suspense>
		</ProtectedRoute>
	);
}

