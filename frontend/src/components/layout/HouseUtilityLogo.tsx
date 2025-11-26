'use client';

import { HTMLAttributes } from 'react';

interface HouseUtilityLogoProps extends HTMLAttributes<HTMLDivElement> {
	showText?: boolean;
	size?: 'sm' | 'md' | 'lg';
}

export default function HouseUtilityLogo({
	showText = true,
	size = 'md',
	className = '',
	...rest
}: HouseUtilityLogoProps) {
	const iconSize =
		size === 'lg' ? 40 : size === 'sm' ? 28 : 32;

	return (
		<div
			className={`flex items-center gap-2 ${className}`}
			{...rest}
		>
			<div
				className="flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-purple-600 shadow-md"
				style={{ width: iconSize, height: iconSize }}
			>
				<svg
					viewBox="0 0 32 32"
					aria-hidden="true"
					className="text-white"
					style={{ width: iconSize - 10, height: iconSize - 10 }}
				>
					<defs>
						<linearGradient id="house-utility-bolt" x1="0" x2="1" y1="0" y2="1">
							<stop offset="0%" stopColor="#e0f2fe" />
							<stop offset="100%" stopColor="#f9fafb" />
						</linearGradient>
					</defs>
					{/* House */}
					<path
						d="M4 15.5L16 5l12 10.5v10.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 26V15.5Z"
						fill="rgba(15,23,42,0.18)"
						stroke="rgba(248,250,252,0.85)"
						strokeWidth="1.4"
						strokeLinejoin="round"
					/>
					{/* Roof highlight */}
					<path
						d="M7 14L16 7l9 7"
						fill="none"
						stroke="rgba(248,250,252,0.85)"
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
					{/* Utility bolt */}
					<path
						d="M17.8 11.5 14 17.2h3.1L14.4 22"
						fill="none"
						stroke="url(#house-utility-bolt)"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					{/* Door */}
					<rect
						x="9.5"
						y="17"
						width="4.5"
						height="6.5"
						rx="1"
						fill="rgba(15,23,42,0.55)"
					/>
				</svg>
			</div>
			{showText && (
				<div className="leading-tight">
					<p className="text-xs font-medium text-slate-400 uppercase tracking-[0.16em]">
						House Utility
					</p>
					<p className="text-sm font-semibold text-slate-900">
						Shared Billing
					</p>
				</div>
			)}
		</div>
	);
}


