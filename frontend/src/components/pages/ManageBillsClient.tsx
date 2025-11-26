'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Card, Form, Input, InputNumber, DatePicker, Button, Space, Row, Col, Checkbox, App, Divider, Select, Spin } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { BillingSetting, CreateBillPayload, ElectricityReading, User, Bill } from '@/types';
import dayjs, { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';

const chargeKeys = [
	{ key: 'moyla', label: 'Moyla' },
	{ key: 'water', label: 'Water' },
	{ key: 'drinking_water', label: 'Drinking Water' },
	{ key: 'gas', label: 'Gas' },
	{ key: 'internet', label: 'Internet' },
	{ key: 'ac', label: 'AC' },
];

interface MonthYearOption {
	value: string | number;
	label: string;
}

const calculateElectricityMetrics = (values: Record<string, unknown>) => {
	// Calculate units from end_unit - start_unit
	let units = 0;
	if (
		values.electricity_start_unit !== undefined &&
		values.electricity_end_unit !== undefined &&
		values.electricity_start_unit !== null &&
		values.electricity_end_unit !== null
	) {
		units = Math.max(0, (values.electricity_end_unit as number) - (values.electricity_start_unit as number));
	}

	// Calculate bill as units * electricity_rate
	const rate = Number(values.electricity_rate) || 0;
	const bill = units * rate;

	return { units, bill, derived: true };
};

interface ManageBillsClientProps {
	billId?: string;
}

export default function ManageBillsClient({ billId }: ManageBillsClientProps = {}) {
	const { token } = useAuth();
	const { message } = App.useApp();
	const router = useRouter();
	const [form] = Form.useForm();
	const [, setSettings] = useState<BillingSetting[]>([]);
	const [users, setUsers] = useState<User[]>([]);
	const [months, setMonths] = useState<MonthYearOption[]>([]);
	const [years, setYears] = useState<MonthYearOption[]>([]);
	const [readings, setReadings] = useState<ElectricityReading[]>([]);
	const [loading, setLoading] = useState(true);
	const [billLoading, setBillLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [masterChargeItems, setMasterChargeItems] = useState<Record<string, number>>({});
	const [masterElectricityRate, setMasterElectricityRate] = useState<number>(0);
	const [editingBill, setEditingBill] = useState<Bill | null>(null);
	const formValues = Form.useWatch([], form);
	const selectedMonth = Form.useWatch('month', form);
	const selectedYear = Form.useWatch('year', form);
	const adjustTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isEditMode = !!billId;

	const readingMap = useMemo(() => {
		const map = new Map<string, ElectricityReading>();
		readings.forEach((reading) => {
			map.set(`${reading.month}-${reading.year}`, reading);
		});
		return map;
	}, [readings]);

	const electricityMetrics = useMemo(() => calculateElectricityMetrics(formValues ?? {}), [formValues]);

	useEffect(() => {
		if (!formValues) {
			return;
		}

		form.setFieldsValue({
			electricity_units_per_month: electricityMetrics.units,
			electricity_bill: Number(electricityMetrics.bill.toFixed(2)),
		});
	}, [electricityMetrics.units, electricityMetrics.bill, form, formValues]);

	useEffect(() => {
		if (!selectedMonth || !selectedYear) {
			// Clear fields when month/year is not selected
			form.setFieldsValue({
				electricity_start_unit: undefined,
				electricity_end_unit: undefined,
				electricity_units_per_month: undefined,
			});
			return;
		}

		const reading = readingMap.get(`${selectedMonth}-${selectedYear}`);

		if (reading) {
			form.setFieldsValue({
				electricity_start_unit: reading.start_unit,
				electricity_end_unit: reading.end_unit ?? undefined,
			});
		} else {
			// Clear if no reading found for selected month/year
			form.setFieldsValue({
				electricity_start_unit: undefined,
				electricity_end_unit: undefined,
				electricity_units_per_month: undefined,
			});
		}
	}, [selectedMonth, selectedYear, readingMap, form]);

	const loadBillData = useCallback(async () => {
		if (!token || !billId) return;

		setBillLoading(true);
		try {
			const response = await apiFetch<{ data: Bill }>(`/bills/${billId}`, { token });
			const bill = response.data;
			setEditingBill(bill);

			// Parse for_month to extract month and year
			const monthYearMatch = bill.for_month.match(/^(\w+)\s+(\d+)$/);
			const month = monthYearMatch ? monthYearMatch[1] : new Date().toLocaleString('en-US', { month: 'long' });
			const year = monthYearMatch ? parseInt(monthYearMatch[2]) : new Date().getFullYear();

			// Extract charge items from line_items
			const chargeItems: Record<string, number> = {};
			bill.line_items?.forEach((item) => {
				if (chargeKeys.some(({ key }) => key === item.key)) {
					chargeItems[item.key] = item.amount;
				}
			});

			// Prepare shares data - only include residents
			const filteredUsers = users.filter((u) => u.role === 'resident');
			const shares = filteredUsers.map((u) => {
				const existingShare = bill.shares?.find((s) => s.user.id === u.id);
				return {
					user_id: u.id,
					include: !!existingShare,
					percentage: existingShare
						? bill.final_total > 0
							? Number(((existingShare.amount_due / bill.final_total) * 100).toFixed(1))
							: 0
						: 0,
					amount_due: existingShare ? Math.round(existingShare.amount_due) : 0,
				};
			});

			form.setFieldsValue({
				month,
				year,
				due_date: bill.due_date ? dayjs(bill.due_date) : dayjs(),
				electricity_start_unit: bill.electricity_start_unit ?? undefined,
				electricity_end_unit: bill.electricity_end_unit ?? undefined,
				electricity_rate: bill.electricity_rate || 0,
				electricity_units_per_month: bill.electricity_units || 0,
				electricity_bill: bill.electricity_bill || 0,
				returned_amount: bill.returned_amount || 0,
				notes: bill.notes || '',
				...chargeItems,
				shares,
			});
		} catch (err) {
			console.error(err);
			message.error('Failed to load bill data');
			router.push('/bills');
		} finally {
			setBillLoading(false);
		}
	}, [token, billId, form, users, router]);

	const loadData = useCallback(async () => {
		if (!token) return;

		setLoading(true);
		try {
			const [settingsRes, usersRes, monthYearRes, readingsRes] = await Promise.all([
				apiFetch<{ data: BillingSetting[] }>('/billing-settings', { token }),
				apiFetch<{ data: User[] }>('/users', { token }),
				apiFetch<{ months: MonthYearOption[]; years: MonthYearOption[] }>('/bills/month-year-options', { token }),
				apiFetch<{ data: ElectricityReading[] }>('/electricity-readings', { token }),
			]);

			setSettings(settingsRes.data);
			// Only include residents in bill splits
			const filteredUsers = usersRes.data.filter((u) => u.role === 'resident');
			setUsers(filteredUsers);
			setMonths(monthYearRes.months);
			setYears(monthYearRes.years);
			setReadings(readingsRes.data);

			const settingLookup = settingsRes.data.reduce<Record<string, number>>((acc, s) => {
				acc[s.key] = s.amount;
				return acc;
			}, {});

			// Store master charge items and electricity rate for reset functionality
			const chargeItemsFromMaster = Object.fromEntries(
				chargeKeys.map(({ key }) => [key, settingLookup[key] || 0])
			);
			const electricityRateFromMaster = settingLookup['electricity_rate'] || 0;
			setMasterChargeItems(chargeItemsFromMaster);
			setMasterElectricityRate(electricityRateFromMaster);

			// Only set default values if not in edit mode
			if (!isEditMode) {
				const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
				const currentYear = new Date().getFullYear();

				// Initialize shares for all users (all included by default)
				const initialShares = filteredUsers.map((u) => ({
					user_id: u.id,
					include: true, // All users included by default
					percentage: 0,
					amount_due: 0,
				}));

				form.setFieldsValue({
					due_date: dayjs(),
					month: currentMonth,
					year: currentYear,
					electricity_rate: electricityRateFromMaster,
					...chargeItemsFromMaster,
					shares: initialShares,
				});
			}
		} catch (err) {
			console.error(err);
			message.error('Failed to load data');
		} finally {
			setLoading(false);
		}
	}, [token, form, isEditMode]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	useEffect(() => {
		if (isEditMode && users.length > 0) {
			loadBillData();
		}
	}, [isEditMode, users.length, loadBillData]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (adjustTimeoutRef.current) {
				clearTimeout(adjustTimeoutRef.current);
			}
		};
	}, []);

	const handleSubmit = async (values: {
		month: string;
		year: number;
		due_date: Dayjs;
		electricity_start_unit?: number;
		electricity_end_unit?: number;
		electricity_units_per_month?: number;
		electricity_rate?: number;
		returned_amount: number;
		notes?: string;
		shares: Array<{ user_id: number; include: boolean; amount_due: number; percentage?: number }>;
		[key: string]: unknown;
	}) => {
		if (!token) return;

		// Validate that shares are properly set before submission
		const activeShares = values.shares?.filter((s) => s.include && s.amount_due > 0) || [];
		if (activeShares.length === 0) {
			message.error('Please split the bill among users before saving. Click "Split Evenly" or set percentages manually.');
			return;
		}

		// Validate that total percentage is close to 100% (allow small rounding differences)
		const totalPercentage = activeShares.reduce((sum, share) => {
			return sum + (Number(share.percentage) || 0);
		}, 0);
		
		if (Math.abs(totalPercentage - 100) > 1) {
			message.warning(`Total percentage is ${totalPercentage.toFixed(1)}%. Please ensure it equals 100% before saving.`);
			return;
		}

		setSubmitting(true);
		try {
			const chargeLineItems = chargeKeys
				.map(({ key, label }) => {
					const amount = Number(values[key]) || 0;
					return { key, label, amount };
				})
				.filter((item) => item.amount > 0);

			const { units: electricityUnits, bill: electricityBill } = calculateElectricityMetrics(values);

			const totalDue = chargeLineItems.reduce((sum, item) => sum + item.amount, 0) + electricityBill;
			const finalTotal = Math.max(totalDue - (values.returned_amount || 0), 0);

			// Combine month and year into for_month string
			const forMonth = `${values.month} ${values.year}`;

			const payload: CreateBillPayload = {
				for_month: forMonth,
				due_date: values.due_date.format('YYYY-MM-DD'),
				electricity_start_unit: values.electricity_start_unit,
				electricity_end_unit: values.electricity_end_unit,
				electricity_units: electricityUnits,
				electricity_rate: values.electricity_rate || 0,
				electricity_bill: Number(electricityBill.toFixed(2)),
				line_items: chargeLineItems.map((item) => ({
					key: item.key,
					label: item.label,
					amount: Number(item.amount.toFixed(2)),
				})),
				total_due: Number(totalDue.toFixed(2)),
				returned_amount: Number((values.returned_amount || 0).toFixed(2)),
				final_total: Number(finalTotal.toFixed(2)),
				notes: values.notes || null,
				shares: activeShares.map((s) => ({
					user_id: s.user_id,
					amount_due: Math.round(Number(s.amount_due)),
				})),
			};

			if (isEditMode && billId) {
				// Update existing bill
				const response = await apiFetch<{ data: Bill }>(`/bills/${billId}`, {
					method: 'PUT',
					token,
					body: payload,
				});

				message.success('Bill updated successfully');
				
				// Redirect to the bill detail page
				if (response.data?.id) {
					router.push(`/bills/${response.data.id}`);
				} else {
					router.push('/bills');
				}
			} else {
				// Create new bill
				const response = await apiFetch<{ data: Bill }>('/bills', {
					method: 'POST',
					token,
					body: payload,
				});

				message.success({
					content: 'Bill created successfully! Notifications have been sent to all users via Telegram.',
					duration: 5,
				});
				
				// Redirect to the bill detail page
				if (response.data?.id) {
					router.push(`/bills/${response.data.id}`);
				} else {
					// Fallback to bills list if ID is not available
					router.push('/bills');
				}
			}
		} catch (err) {
			console.error(err);
			message.error(err instanceof Error ? err.message : 'Failed to create bill');
		} finally {
			setSubmitting(false);
		}
	};

	const handleReset = () => {
		const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
		const currentYear = new Date().getFullYear();
		
		// Reset form but preserve charge items from master data
		form.resetFields();
		
		// Restore charge items and electricity rate from master data
		form.setFieldsValue({
			due_date: dayjs(),
			month: currentMonth,
			year: currentYear,
			electricity_rate: masterElectricityRate,
			...masterChargeItems,
			shares: users.map((u) => ({
				user_id: u.id,
				include: true,
				percentage: 0,
				amount_due: 0,
			})),
		});
	};

	const splitEvenly = () => {
		const formValues = form.getFieldsValue();
		const currentShares = formValues.shares || [];
		
		// If shares array is empty or not initialized, initialize it with all users
		if (currentShares.length === 0 && users.length > 0) {
			const initialShares = users.map((u) => ({
				user_id: u.id,
				include: true,
				percentage: 0,
				amount_due: 0,
			}));
			form.setFieldsValue({ shares: initialShares });
			// Get updated values after setting
			const updatedValues = form.getFieldsValue();
			const activeShares = updatedValues.shares?.filter((s: { include: boolean }) => s.include) || [];
			if (activeShares.length === 0) {
				message.warning('Please select at least one user to include in the bill');
				return;
			}
		} else {
			const activeShares = currentShares.filter((s: { include: boolean }) => s.include) || [];
			if (activeShares.length === 0) {
				message.warning('Please select at least one user to include in the bill. Check the boxes next to user names.');
				return;
			}
		}
		
		// Re-get form values after potential initialization
		const finalFormValues = form.getFieldsValue();
		const activeShares = finalFormValues.shares?.filter((s: { include: boolean }) => s.include) || [];

		// Calculate finalTotal from current form values (works before saving)
		const chargeLineItems = chargeKeys
			.map(({ key }) => Number(finalFormValues[key]) || 0)
			.filter((amount) => amount > 0);
		const electricityBill = (finalFormValues.electricity_units_per_month || 0) * (finalFormValues.electricity_rate || 0);
		const totalDue = chargeLineItems.reduce((sum, amount) => sum + amount, 0) + electricityBill;
		const currentFinalTotal = Math.max(totalDue - (finalFormValues.returned_amount || 0), 0);
		
		if (currentFinalTotal <= 0) {
			message.warning('Please fill in bill details first (charges, electricity, etc.) to calculate the total');
			return;
		}
		
		// Divide equally by number of active shares
		const equalPercentage = 100 / activeShares.length;
		const perPerson = currentFinalTotal / activeShares.length;

		const updatedShares = formValues.shares.map((share: { user_id: number; include: boolean }) => ({
			...share,
			percentage: share.include ? Number(equalPercentage.toFixed(1)) : 0,
			amount_due: share.include ? Number(perPerson.toFixed(2)) : 0,
		}));

		form.setFieldsValue({ shares: updatedShares });
		message.success(`Bill split evenly: ${equalPercentage.toFixed(1)}% each, ${formatCurrency(perPerson)} per person (${activeShares.length} ${activeShares.length === 1 ? 'person' : 'people'})`);
	};

	const totalDue = useMemo(() => {
		const values = formValues ?? {};
		const chargeLineItems = chargeKeys
			.map(({ key }) => Number(values[key]) || 0)
			.filter((amount) => amount > 0);

		return chargeLineItems.reduce((sum, amount) => sum + amount, 0) + electricityMetrics.bill;
	}, [formValues, electricityMetrics.bill]);

	const finalTotal = useMemo(() => {
		const values = formValues ?? {};
		return Math.max(totalDue - (values.returned_amount || 0), 0);
	}, [totalDue, formValues]);

	// Calculate total percentage and update amounts based on percentages
	const sharesPercentage = useMemo(() => {
		const values = formValues ?? {};
		const shares = values.shares || [];
		const includedShares = shares.filter((s: { include: boolean }) => s.include) || [];
		const totalPercentage = includedShares.reduce((sum: number, share: { percentage?: number }) => {
			return sum + (Number(share.percentage) || 0);
		}, 0);
		return { totalPercentage, includedShares };
	}, [formValues]);

	// Auto-update amount_due when percentage changes (only when percentage is set, not when amount is manually entered)
	// This effect is disabled to prevent interference with manual amount input
	// Amount updates are now handled directly in the onChange handlers

	return (
		<Spin spinning={loading || billLoading} tip="Loading billing data...">
			<div className="space-y-6">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
						{isEditMode ? 'Edit Bill' : 'Manage Bills'}
					</h1>
					<p className="text-sm sm:text-base text-gray-600">{isEditMode ? 'Update bill details and shares' : 'Create and manage utility bills for your household'}</p>
				</div>
				<Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="large" className="w-full sm:w-auto">
					<span className="hidden sm:inline">Refresh Data</span>
					<span className="sm:hidden">Reload</span>
				</Button>
			</div>

			<Card className="shadow-lg border-0">
				<Form
					form={form}
					layout="vertical"
					onFinish={handleSubmit}
					initialValues={{
						shares: users.map((u) => ({
							user_id: u.id,
							include: true,
							percentage: 0,
							amount_due: 0,
						})),
					}}
				>
					<div className="mb-6">
						<h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
							<span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
							Basic Information
						</h2>
					</div>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Month"
								name="month"
								rules={[{ required: true, message: 'Please select month' }]}
							>
								<Select placeholder="Select month" options={months} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item
								label="Year"
								name="year"
								rules={[{ required: true, message: 'Please select year' }]}
							>
								<Select placeholder="Select year" options={years} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Due Date" name="due_date">
								<DatePicker style={{ width: '100%' }} />
							</Form.Item>
						</Col>
					</Row>

					<div className="mb-6 mt-8">
						<h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
							<span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
							Charge Items
						</h2>
					</div>
					<Row gutter={[16, 20]}>
						{chargeKeys.map(({ key, label }) => (
							<Col xs={24} sm={12} md={8} lg={4} key={key}>
								<Form.Item label={label} name={key}>
									<InputNumber
										min={0}
										step={0.01}
										prefix="৳"
										style={{ width: '100%' }}
										precision={2}
									/>
								</Form.Item>
							</Col>
						))}
					</Row>

					<div className="mb-6 mt-8">
						<h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
							<span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
							Electricity Details
						</h2>
					</div>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Start Unit" name="electricity_start_unit">
								<InputNumber 
									min={0} 
									step={1} 
									style={{ width: '100%' }} 
									placeholder="Auto-populated" 
									disabled
									readOnly
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="End Unit" name="electricity_end_unit">
								<InputNumber 
									min={0} 
									step={1} 
									style={{ width: '100%' }} 
									placeholder="Auto-populated" 
									disabled
									readOnly
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item 
								label="Units Per Month" 
								name="electricity_units_per_month"
							>
								<InputNumber 
									min={0} 
									step={1} 
									style={{ width: '100%' }} 
									placeholder="Auto-calculated"
									disabled
									readOnly
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Rate" name="electricity_rate">
								<InputNumber
									min={0}
									step={0.01}
									prefix="৳"
									style={{ width: '100%' }}
									precision={2}
									placeholder="Rate per unit"
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Electricity Bill" name="electricity_bill">
								<InputNumber
									min={0}
									step={0.01}
									style={{ width: '100%' }}
									precision={2}
									disabled
									readOnly
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={8} lg={4}>
							<Form.Item label="Returned Amount" name="returned_amount">
								<InputNumber
									min={0}
									step={0.01}
									prefix="৳"
									style={{ width: '100%' }}
									precision={2}
								/>
							</Form.Item>
						</Col>
					</Row>
					<Row gutter={[16, 20]}>
						<Col xs={24} sm={24} md={24} lg={12}>
							<Form.Item label="Notes" name="notes">
								<Input.TextArea rows={3} placeholder="Optional notes..." />
							</Form.Item>
						</Col>
					</Row>

					<div className="mb-6 mt-8">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
								<span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
								Bill Shares
								<span className="text-xs font-normal text-gray-500 ml-2">(Split before saving - no need to save first!)</span>
							</h2>
							<Space>
								{sharesPercentage.includedShares.length > 0 && (
									<div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
										<span className="text-gray-600">Total: </span>
										<span className={`font-semibold ${sharesPercentage.totalPercentage === 100 ? 'text-green-600' : sharesPercentage.totalPercentage > 100 ? 'text-red-600' : 'text-orange-600'}`}>
											{sharesPercentage.totalPercentage.toFixed(1)}%
										</span>
									</div>
								)}
								<Button 
									type="primary" 
									size="small" 
									onClick={splitEvenly} 
									className="bg-gradient-to-r from-indigo-500 to-purple-500 border-0"
									title="Split bill equally among selected users (works before saving)"
								>
									Split Evenly
								</Button>
							</Space>
						</div>
						{sharesPercentage.includedShares.length > 0 && finalTotal > 0 && (
							<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
								<div className="flex items-center justify-between text-sm">
									<span className="text-gray-700">Total Amount to Split:</span>
									<span className="font-bold text-blue-700">{formatCurrency(finalTotal)}</span>
								</div>
								{sharesPercentage.totalPercentage !== 100 && (
									<div className="mt-2 text-xs text-orange-600">
										⚠️ Total percentage is {sharesPercentage.totalPercentage.toFixed(1)}%. Should be 100% for accurate split.
									</div>
								)}
							</div>
						)}
						{finalTotal <= 0 && (
							<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
								<div className="text-sm text-yellow-800">
									💡 <strong>Tip:</strong> Fill in bill details (charges, electricity, etc.) above, then you can split the bill before saving. No need to save first!
								</div>
							</div>
						)}
					</div>

					<Form.List name="shares">
						{(fields) => (
							<div className="space-y-3">
								{fields.map((field, index) => {
									const user = users[index];
									if (!user) return null;
									const shareValue = formValues?.shares?.[index];
									const isIncluded = shareValue?.include;
									const percentage = Number(shareValue?.percentage) || 0;
									const amountDue = Number(shareValue?.amount_due) || 0;
									const calculatedAmount = isIncluded && percentage > 0 ? (finalTotal * percentage) / 100 : 0;
									
									return (
										<Card 
											key={field.key} 
											size="small" 
											className={`hover:shadow-md transition-shadow border ${isIncluded ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}
										>
											<Row gutter={16} align="middle">
												<Col span={2}>
													<Form.Item name={[field.name, 'include']} valuePropName="checked" className="mb-0">
														<Checkbox />
													</Form.Item>
												</Col>
												<Col span={8}>
													<div className="flex items-center gap-3">
														<div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold text-sm">
															{user.name.charAt(0).toUpperCase()}
														</div>
														<div>
															<div className="font-semibold text-gray-900">{user.name}</div>
															<div className="text-xs text-gray-500">{(user as any).role_label || user.role}</div>
														</div>
													</div>
												</Col>
												<Col span={5}>
													<div className="flex flex-col">
														<Form.Item
															name={[field.name, 'percentage']}
															rules={[
																{ required: isIncluded, message: 'Enter %' },
																{ type: 'number', min: 0, max: 100, message: '0-100%' },
															]}
															className="mb-0"
														>
														<InputNumber
															min={0}
															max={100}
															step={0.1}
															suffix="%"
															style={{ width: '100%' }}
															precision={1}
															disabled={!isIncluded}
															placeholder="0.0%"
															onChange={(value) => {
																// Immediately update amount for current field
																if (!isIncluded || value === null || value === undefined || finalTotal <= 0) return;
																const newPercentage = Number(value);
																const calculatedAmount = (finalTotal * newPercentage) / 100;
																form.setFieldValue(['shares', field.name, 'amount_due'], Math.round(calculatedAmount));
																
																// Debounce adjustment of other shares to avoid constant recalculation while typing
																if (adjustTimeoutRef.current) {
																	clearTimeout(adjustTimeoutRef.current);
																}
																
																adjustTimeoutRef.current = setTimeout(() => {
																	const currentShares = form.getFieldsValue().shares || [];
																	const currentPercentage = Number(currentShares[field.name]?.percentage) || 0;
																	
																	if (currentPercentage <= 0) return;
																	
																	const otherIncludedShares = currentShares
																		.map((s: any, idx: number) => ({ ...s, index: idx }))
																		.filter((s: any) => s.index !== field.name && s.include);
																	
																	if (otherIncludedShares.length > 0) {
																		const remainingPercentage = Math.max(0, 100 - currentPercentage);
																		const perOtherShare = remainingPercentage / otherIncludedShares.length;
																		
																		otherIncludedShares.forEach((share: any) => {
																			const otherAmount = (finalTotal * perOtherShare) / 100;
																			form.setFieldValue(['shares', share.index, 'percentage'], Number(perOtherShare.toFixed(1)));
																			form.setFieldValue(['shares', share.index, 'amount_due'], Math.round(otherAmount));
																		});
																	}
																}, 300); // 300ms debounce
															}}
														/>
														</Form.Item>
														<div className="h-4"></div>
													</div>
												</Col>
												<Col span={9}>
													<div className="flex flex-col">
														<Form.Item
															name={[field.name, 'amount_due']}
															rules={[{ required: isIncluded, message: 'Enter amount' }]}
															className="mb-0"
														>
															<InputNumber
																min={0}
																step={1}
																prefix="৳"
																style={{ width: '100%' }}
																precision={0}
																disabled={!isIncluded}
																placeholder="0"
																controls={false}
																onChange={(value) => {
																	// Only update percentage, don't modify the amount field itself to avoid interference
																	if (!isIncluded || value === null || value === undefined || finalTotal <= 0) return;
																	const newAmount = Number(value);
																	if (isNaN(newAmount) || newAmount < 0) return;
																	
																	// Update percentage only, don't touch amount_due to avoid interference
																	const calculatedPercentage = (newAmount / finalTotal) * 100;
																	form.setFieldValue(['shares', field.name, 'percentage'], Number(calculatedPercentage.toFixed(1)));
																	
																	// Debounce adjustment of other shares to avoid constant recalculation while typing
																	if (adjustTimeoutRef.current) {
																		clearTimeout(adjustTimeoutRef.current);
																	}
																	
																	adjustTimeoutRef.current = setTimeout(() => {
																		const currentShares = form.getFieldsValue().shares || [];
																		const currentAmount = Number(currentShares[field.name]?.amount_due) || 0;
																		
																		if (currentAmount <= 0) return;
																		
																		const calculatedPercentage = (currentAmount / finalTotal) * 100;
																		
																		const otherIncludedShares = currentShares
																			.map((s: any, idx: number) => ({ ...s, index: idx }))
																			.filter((s: any) => s.index !== field.name && s.include);
																		
																		if (otherIncludedShares.length > 0) {
																			const remainingPercentage = Math.max(0, 100 - calculatedPercentage);
																			const perOtherShare = remainingPercentage / otherIncludedShares.length;
																			
																			otherIncludedShares.forEach((share: any) => {
																				const otherAmount = (finalTotal * perOtherShare) / 100;
																				form.setFieldValue(['shares', share.index, 'percentage'], Number(perOtherShare.toFixed(1)));
																				form.setFieldValue(['shares', share.index, 'amount_due'], Math.round(otherAmount));
																			});
																		}
																	}, 500); // Increased to 500ms for better typing experience
																}}
															/>
														</Form.Item>
														<div className="h-4 flex items-start">
															{isIncluded && percentage > 0 && finalTotal > 0 && (
																<div className="text-xs text-gray-500">
																	{percentage.toFixed(1)}% of {formatCurrency(finalTotal)} = {formatCurrency(calculatedAmount)}
																</div>
															)}
														</div>
													</div>
												</Col>
											</Row>
											<Form.Item name={[field.name, 'user_id']} hidden>
												<Input />
											</Form.Item>
										</Card>
									);
								})}
							</div>
						)}
					</Form.List>

					<Card className="mt-6 border-0 shadow-xl bg-gradient-to-br from-slate-50 via-white to-slate-50">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Summary Section */}
							<div className="space-y-4">
								<div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
											<span className="text-blue-600 font-bold text-sm">TD</span>
										</div>
										<div>
											<div className="text-xs text-gray-500 uppercase tracking-wide">Total Due</div>
											<div className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(totalDue)}</div>
										</div>
									</div>
								</div>
								<div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
											<span className="text-white font-bold text-sm">FT</span>
										</div>
										<div>
											<div className="text-xs text-white/90 uppercase tracking-wide">Final Total</div>
											<div className="text-xl font-bold text-white mt-0.5">{formatCurrency(finalTotal)}</div>
										</div>
									</div>
								</div>
							</div>
							
							{/* Actions Section */}
							<div className="flex flex-col justify-end gap-3">
								{sharesPercentage.includedShares.length === 0 && (
									<div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-2">
										<div className="text-sm text-red-800">
											⚠️ <strong>Action Required:</strong> Please split the bill among users before saving. Use "Split Evenly" or set percentages manually.
										</div>
									</div>
								)}
								{sharesPercentage.includedShares.length > 0 && sharesPercentage.totalPercentage !== 100 && (
									<div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-2">
										<div className="text-sm text-orange-800">
											⚠️ Total percentage is {sharesPercentage.totalPercentage.toFixed(1)}%. Should be 100% before saving.
										</div>
									</div>
								)}
								<Button 
									type="primary" 
									htmlType="submit" 
									icon={<SaveOutlined />} 
									loading={submitting}
									block
									disabled={sharesPercentage.includedShares.length === 0 || Math.abs(sharesPercentage.totalPercentage - 100) > 1}
									className="h-10 bg-gradient-to-r from-indigo-500 to-purple-500 border-0 hover:from-indigo-600 hover:to-purple-600 shadow-md font-semibold"
									title={sharesPercentage.includedShares.length === 0 ? 'Please split the bill first' : Math.abs(sharesPercentage.totalPercentage - 100) > 1 ? 'Total percentage must be 100%' : 'Save bill with split shares'}
								>
									{isEditMode ? 'Update Bill' : 'Save Bill'}
								</Button>
								<Button 
									onClick={handleReset} 
									block
									className="h-10 border-gray-300 hover:border-gray-400"
								>
									Reset Form
								</Button>
							</div>
						</div>
					</Card>
				</Form>
			</Card>
			</div>
		</Spin>
	);
}

