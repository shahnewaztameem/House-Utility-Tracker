'use client';

import { ReactNode } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoginCard from '@/components/LoginCard';
import { Spin } from 'antd';

export default function DashboardLayoutWrapper({
	children,
}: {
	children: ReactNode;
}) {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			router.push('/');
		}
	}, [user, loading, router]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spin size="large" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
				<LoginCard />
			</div>
		);
	}

	return <DashboardLayout>{children}</DashboardLayout>;
}

