import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ConfigProvider, App } from 'antd';
import './globals.css';
import { Providers } from '@/components/Providers';
import RouteProgress from '@/components/layout/RouteProgress';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'House Utility Tracker',
	description: 'Manage house utility bills and payments',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<ConfigProvider
					theme={{
						token: {
							colorPrimary: '#3b82f6',
							borderRadius: 8,
							fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
						},
						components: {
							Button: {
								borderRadius: 8,
							},
							Card: {
								borderRadius: 12,
							},
							Input: {
								borderRadius: 8,
							},
							Table: {
								borderRadius: 8,
							},
						},
					}}
				>
					<App>
						<RouteProgress />
						<Providers>{children}</Providers>
					</App>
				</ConfigProvider>
			</body>
		</html>
	);
}
