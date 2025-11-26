import { Suspense } from 'react';
import BillsClient from '@/components/pages/BillsClient';
import { Spin } from 'antd';

export const metadata = {
	title: 'Bills - House Utility Tracker',
	description: 'View and manage utility bills',
};

export default function BillsPage() {
	return (
		<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
			<BillsClient />
		</Suspense>
	);
}

