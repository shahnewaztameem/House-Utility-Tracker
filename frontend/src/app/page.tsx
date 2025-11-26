'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginCard from '@/components/LoginCard';
import { useAuth } from '@/context/AuthContext';
import { Spin } from 'antd';

export default function Home() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && user) {
			router.push('/dashboard');
		}
	}, [user, loading, router]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50">
				<Spin size="large" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-900 via-slate-900 to-emerald-900 px-4 overflow-hidden">
				<div className="pointer-events-none absolute inset-0 opacity-60">
					<div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-sky-500 blur-3xl" />
					<div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-emerald-500 blur-3xl" />
				</div>
				<div className="relative">
					<LoginCard />
				</div>
			</div>
		);
	}

	return null;
}
