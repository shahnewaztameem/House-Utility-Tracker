'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Spin, Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';

interface ProtectedRouteProps {
	children: ReactNode;
	requiredAbility?: 'manage_bills' | 'manage_settings' | 'view_all_records';
	requiredRole?: 'super_admin' | 'admin' | 'resident';
}

export default function ProtectedRoute({
	children,
	requiredAbility,
	requiredRole,
}: ProtectedRouteProps) {
	const { user, loading, token } = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const [routeChecking, setRouteChecking] = useState(true);
	const [routeAccessible, setRouteAccessible] = useState<boolean | null>(null);
	const [routeMessage, setRouteMessage] = useState<string>('');

	useEffect(() => {
		if (!loading && !user) {
			router.push('/');
		}
	}, [user, loading, router]);

	// Check route access from backend menu items
	useEffect(() => {
		const checkRouteAccess = async () => {
			if (!user || !token || !pathname) {
				setRouteChecking(false);
				return;
			}

			try {
				const response = await apiFetch<{ accessible: boolean; message: string }>('/menu/check-route', {
					method: 'POST',
					token,
					body: { path: pathname },
				});

				setRouteAccessible(response.accessible);
				setRouteMessage(response.message);
			} catch (err) {
				console.error('Failed to check route access:', err);
				// If check fails, fall back to local permission checks
				setRouteAccessible(null);
			} finally {
				setRouteChecking(false);
			}
		};

		checkRouteAccess();
	}, [user, token, pathname]);

	if (loading || routeChecking) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spin size="large" />
			</div>
		);
	}

	if (!user) {
		return null;
	}

	// If backend check returned false, block access
	if (routeAccessible === false) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4">
				<Result
					icon={<LockOutlined style={{ color: '#ff4d4f' }} />}
					status="403"
					title="403"
					subTitle={routeMessage || "You don't have permission to access this page."}
					extra={
						<Button type="primary" onClick={() => router.push('/dashboard')}>
							Go to Dashboard
						</Button>
					}
				/>
			</div>
		);
	}

	// Fallback to local permission checks if backend check didn't return a result
	// (for routes not in menu items or if check failed)
	if (routeAccessible === null) {
		// Check role requirement
		if (requiredRole) {
			const roleHierarchy: Record<string, number> = {
				super_admin: 3,
				admin: 2,
				resident: 1,
			};

			const userRoleLevel = roleHierarchy[user.role] || 0;
			const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

			if (userRoleLevel < requiredRoleLevel) {
				return (
					<div className="flex min-h-screen items-center justify-center p-4">
						<Result
							icon={<LockOutlined style={{ color: '#ff4d4f' }} />}
							status="403"
							title="403"
							subTitle="You don't have permission to access this page."
							extra={
								<Button type="primary" onClick={() => router.push('/dashboard')}>
									Go to Dashboard
								</Button>
							}
						/>
					</div>
				);
			}
		}

		// Check ability requirement
		if (requiredAbility) {
			const hasAbility = Boolean(user.abilities?.[requiredAbility]);

			if (!hasAbility) {
				return (
					<div className="flex min-h-screen items-center justify-center p-4">
						<Result
							icon={<LockOutlined style={{ color: '#ff4d4f' }} />}
							status="403"
							title="403"
							subTitle="You don't have permission to access this page."
							extra={
								<Button type="primary" onClick={() => router.push('/dashboard')}>
									Go to Dashboard
								</Button>
							}
						/>
					</div>
				);
			}
		}
	}

	return <>{children}</>;
}

