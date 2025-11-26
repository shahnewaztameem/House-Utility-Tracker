import { Suspense } from 'react';
import SharesClient from '@/components/pages/SharesClient';
import { Spin } from 'antd';

export const metadata = {
	title: 'Shares & Payments - House Utility Tracker',
	description: 'Manage bill shares and record payments',
};

export default function SharesPage() {
	return (
		<Suspense fallback={<Spin size="large" className="flex justify-center p-8" />}>
			<SharesClient />
		</Suspense>
	);
}

