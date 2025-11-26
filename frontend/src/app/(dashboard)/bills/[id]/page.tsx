'use client';

import { use } from 'react';
import { Suspense } from 'react';
import { Spin } from 'antd';
import BillDetailClient from '@/components/pages/BillDetailClient';

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return (
		<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
			<BillDetailClient billId={id} />
		</Suspense>
	);
}

