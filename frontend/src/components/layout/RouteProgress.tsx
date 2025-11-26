'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

NProgress.configure({
	showSpinner: false,
	trickleSpeed: 120,
	minimum: 0.15,
});

export default function RouteProgress() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		// Start progress on route change
		NProgress.start();

		// Complete after a short delay to cover data fetching / suspense
		const timeout = setTimeout(() => {
			NProgress.done();
		}, 400);

		return () => {
			clearTimeout(timeout);
			NProgress.done();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname, searchParams?.toString()]);

	return null;
}


