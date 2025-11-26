'use client';

import { ReactNode, useMemo, useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Drawer } from 'antd';
import type { MenuProps } from 'antd';
import {
	DashboardOutlined,
	DollarOutlined,
	FileTextOutlined,
	SettingOutlined,
	UserOutlined,
	LogoutOutlined,
	TeamOutlined,
	ThunderboltOutlined,
	MenuOutlined,
	MenuFoldOutlined,
	MenuUnfoldOutlined,
	UsergroupAddOutlined,
	ControlOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { MenuItem } from '@/types';
import Link from 'next/link';
import HouseUtilityLogo from './HouseUtilityLogo';

const { Header, Sider, Content, Footer } = Layout;

interface DashboardLayoutProps {
	children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
	const { user, logout, token } = useAuth();
	const pathname = usePathname();
	const router = useRouter();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [openKeys, setOpenKeys] = useState<string[]>([]);
	const [currentYear, setCurrentYear] = useState<number | null>(null);
	const [menuItemsData, setMenuItemsData] = useState<MenuItem[]>([]);
	const [menuLoading, setMenuLoading] = useState(true);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024);
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	// Persist sidebar collapsed state in localStorage
	useEffect(() => {
		const saved = localStorage.getItem('sidebarCollapsed');
		if (saved !== null) {
			setSidebarCollapsed(JSON.parse(saved));
		}
	}, []);

	useEffect(() => {
		localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
	}, [sidebarCollapsed]);

	// Auto-open config menu if on config page
	useEffect(() => {
		if (pathname?.startsWith('/config')) {
			setOpenKeys(['/config']);
		}
	}, [pathname]);

	// Set current year on client side only to avoid hydration mismatch
	useEffect(() => {
		setCurrentYear(new Date().getFullYear());
	}, []);

	// Fetch menu items from backend
	useEffect(() => {
		const loadMenuItems = async () => {
			if (!user || !token) {
				setMenuLoading(false);
				return;
			}

			try {
				const response = await apiFetch<{ data: MenuItem[] }>('/menu', {
					token,
				});
				setMenuItemsData(response.data);
			} catch (err) {
				console.error('Failed to load menu items:', err);
			} finally {
				setMenuLoading(false);
			}
		};

		loadMenuItems();
	}, [user, token]);

	// Icon mapping
	const iconMap: Record<string, React.ReactNode> = {
		DashboardOutlined: <DashboardOutlined />,
		DollarOutlined: <DollarOutlined />,
		FileTextOutlined: <FileTextOutlined />,
		SettingOutlined: <SettingOutlined />,
		TeamOutlined: <TeamOutlined />,
		ThunderboltOutlined: <ThunderboltOutlined />,
		UsergroupAddOutlined: <UsergroupAddOutlined />,
		ControlOutlined: <ControlOutlined />,
	};

	// Transform backend menu items to Ant Design format
	const menuItems: MenuProps['items'] = useMemo(() => {
		const transformMenuItem = (item: MenuItem): NonNullable<MenuProps['items']>[0] => {
			const baseItem: any = {
				key: item.key,
				icon: iconMap[item.icon] || null,
				label: item.path ? <Link href={item.path}>{item.label}</Link> : item.label,
			};

			if (item.children && item.children.length > 0) {
				baseItem.children = item.children.map(transformMenuItem);
			}

			return baseItem;
		};

		return menuItemsData.map(transformMenuItem);
	}, [menuItemsData]);

	const userMenuItems: MenuProps['items'] = [
		{
			key: 'profile',
			icon: <UserOutlined />,
			label: (
				<div>
					<div className="font-medium">{user?.name}</div>
					<div className="text-xs text-gray-500">{user?.role_label}</div>
				</div>
			),
		},
		{
			type: 'divider',
		},
		{
			key: 'logout',
			icon: <LogoutOutlined />,
			label: 'Sign Out',
			danger: true,
			onClick: async () => {
				await logout();
				router.push('/');
			},
		},
	];

	const menuContent = (
		<>
			<div
				className={`p-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white transition-all ${
					sidebarCollapsed ? 'px-2' : ''
				}`}
			>
				{!sidebarCollapsed ? (
					<HouseUtilityLogo size="md" />
				) : (
					<div className="flex justify-center">
						<HouseUtilityLogo size="sm" showText={false} />
					</div>
				)}
			</div>
			{menuLoading ? (
				<div className="flex items-center justify-center p-4">
					<div className="text-sm text-gray-500">Loading menu...</div>
				</div>
			) : (
				<Menu
					mode="inline"
					selectedKeys={[pathname]}
					openKeys={openKeys}
					onOpenChange={setOpenKeys}
					items={menuItems}
					className="border-r-0 bg-white"
					onClick={() => setMobileMenuOpen(false)}
					inlineCollapsed={sidebarCollapsed}
				/>
			)}
		</>
	);

	const sidebarWidth = sidebarCollapsed ? 80 : 240;

	return (
		<Layout className="h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col overflow-hidden">
			{/* Desktop Sidebar - Always Fixed and Visible */}
			<Sider
				width={sidebarWidth}
				collapsed={sidebarCollapsed}
				className="!fixed left-0 top-0 bottom-0 overflow-auto hidden lg:block transition-all duration-300 z-10"
				theme="light"
				style={{ 
					borderRight: '1px solid #e2e8f0',
					height: '100vh',
					boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
					background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
				}}
			>
				{menuContent}
			</Sider>

			{/* Mobile Drawer */}
			<Drawer
				title={
					<div className="bg-gradient-to-br from-slate-50 to-white py-1">
						<HouseUtilityLogo size="sm" />
					</div>
				}
				placement="left"
				onClose={() => setMobileMenuOpen(false)}
				open={mobileMenuOpen}
				styles={{ body: { padding: 0, background: '#ffffff' } }}
				width={280}
				style={{ background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}
			>
				{menuLoading ? (
					<div className="flex items-center justify-center p-4">
						<div className="text-sm text-gray-500">Loading menu...</div>
					</div>
				) : (
					<Menu
						mode="inline"
						selectedKeys={[pathname]}
						openKeys={openKeys}
						onOpenChange={setOpenKeys}
						items={menuItems}
						className="border-r-0"
						onClick={() => setMobileMenuOpen(false)}
					/>
				)}
			</Drawer>

			<Layout 
				className="flex-1 flex flex-col transition-all duration-300"
				style={{ marginLeft: isMobile ? 0 : `${sidebarWidth}px` }}
			>
				<Header 
					className="bg-gray-900 backdrop-blur-sm px-4 lg:px-6 flex items-center justify-between border-b border-gray-800 shadow-sm h-16 flex-shrink-0"
					style={{ height: '64px' }}
				>
					<div className="flex items-center gap-2">
						<Button
							type="text"
							icon={
								isMobile ? (
									<MenuOutlined style={{ color: '#ffffff' }} />
								) : (
									sidebarCollapsed ? <MenuUnfoldOutlined style={{ color: '#ffffff' }} /> : <MenuFoldOutlined style={{ color: '#ffffff' }} />
								)
							}
							onClick={() => {
								if (isMobile) {
									setMobileMenuOpen(true);
								} else {
									setSidebarCollapsed(!sidebarCollapsed);
								}
							}}
							className="hover:bg-gray-800"
							size="large"
							title={
								isMobile
									? 'Open menu'
									: sidebarCollapsed
										? 'Expand sidebar'
										: 'Collapse sidebar'
							}
							style={{ color: '#ffffff' }}
						/>
					</div>
					<Space>
						<Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
							<Button type="text" className="flex items-center gap-2 hover:bg-gray-800 text-white">
								<Avatar size="small" icon={<UserOutlined />} className="bg-gradient-to-br from-indigo-500 to-purple-500" />
								<span className="hidden sm:inline font-medium text-white">{user?.name}</span>
							</Button>
						</Dropdown>
					</Space>
				</Header>
				<Content 
					className="flex-1 overflow-y-auto p-4 sm:p-6"
					style={{ 
						minHeight: 0,
						height: 'calc(100vh - 64px)', // Full height minus header (footer hidden on mobile)
						background: 'transparent'
					}}
				>
					{children}
				</Content>
				<Footer 
					className="hidden sm:block bg-gradient-to-r from-slate-50 via-white to-slate-50 border-t border-slate-200 flex-shrink-0 py-4"
					style={{ minHeight: '60px' }}
				>
					<div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4">
						<div className="flex items-center gap-3 text-sm text-slate-600">
							<HouseUtilityLogo size="sm" />
							<div>
								<div className="font-semibold text-slate-700">© {currentYear || new Date().getFullYear()} House Utility Tracker</div>
								<div className="text-xs text-slate-500">All rights reserved</div>
							</div>
						</div>
						<div className="flex flex-col sm:flex-row items-center gap-3 text-xs sm:text-sm">
							<div className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-600 font-medium">
								Version 1.0.0
							</div>
							{user && (
								<div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full">
									<div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
										{user.name.charAt(0).toUpperCase()}
									</div>
									<span className="text-slate-700 font-medium">
										{user.name}
									</span>
								</div>
							)}
						</div>
					</div>
				</Footer>
			</Layout>
		</Layout>
	);
}

