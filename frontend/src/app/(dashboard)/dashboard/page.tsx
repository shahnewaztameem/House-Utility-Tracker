import { Suspense } from 'react';
import DashboardClient from '@/components/pages/DashboardClient';
import { Spin } from 'antd';

export const metadata = {
	title: 'Dashboard - House Utility Tracker',
	description: 'Overview of bills, payments, and outstanding balances',
};

export default function DashboardPage() {
	return (
		<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
			<DashboardClient />
		</Suspense>
	);
}

