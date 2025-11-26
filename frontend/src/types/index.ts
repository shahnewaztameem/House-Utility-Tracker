export type Role = 'super_admin' | 'admin' | 'resident';

export interface UserAbilities {
	manage_bills: boolean;
	manage_settings: boolean;
	view_all_records: boolean;
}

export interface User {
	id: number;
	name: string;
	email: string;
	role: Role;
	role_label?: string;
	abilities: UserAbilities;
}

export interface ChargeLineItem {
	key: string;
	label?: string;
	amount: number;
}

export interface BillShare {
	id: number;
	bill_id: number;
	bill?: {
		id: number;
		reference: string;
		for_month: string;
		due_date: string | null;
		status: string;
	} | null;
	user: {
		id: number;
		name: string;
		role: Role;
	};
	status: string;
	amount_due: number;
	amount_paid: number;
	outstanding: number;
	last_paid_at: string | null;
	notes?: string | null;
	payments?: Payment[];
}

export interface Bill {
	id: number;
	reference: string;
	for_month: string;
	status: string;
	due_date: string | null;
	period_start?: string | null;
	period_end?: string | null;
	electricity_units?: number;
	electricity_start_unit?: number | null;
	electricity_end_unit?: number | null;
	electricity_rate?: number;
	electricity_bill?: number;
	total_due: number;
	returned_amount: number;
	final_total: number;
	notes?: string | null;
	line_items: ChargeLineItem[];
	shares?: BillShare[];
	created_at?: string;
	created_by?: {
		id: number;
		name: string;
	};
}

export interface BillingSetting {
	id: number;
	key: string;
	label: string;
	amount: number;
	metadata?: Record<string, unknown>;
}

export interface ElectricityReading {
  id: number;
  month: string;
  year: number;
  start_unit: number;
  end_unit?: number | null;
  recorded_by?: {
    id: number;
    name: string;
  } | null;
  created_at?: string;
}

export interface CurrencyConfig {
	name: string;
	symbol: string;
	code: string;
	locale: string;
	decimal_places: number;
}

export interface DashboardSummary {
	totals: {
		total_due: number;
		total_paid: number;
		total_outstanding: number;
	};
	latest_bills: Bill[];
	settings: Record<string, { label: string; amount: number }>;
	currency?: CurrencyConfig;
}

export interface LoginResponse {
	token: string;
	token_type: string;
	user: User;
}

export interface MeResponse {
	user: User;
}

export interface BillingSettingsPayload {
	settings: Array<{
		key: string;
		amount: number;
		metadata?: Record<string, unknown>;
	}>;
}

export interface BillShareInput {
	user_id: number;
	amount_due: number;
}

export interface CreateBillPayload {
	for_month: string;
	due_date?: string | null;
	electricity_units?: number;
	electricity_start_unit?: number | null;
	electricity_end_unit?: number | null;
	electricity_rate?: number;
	electricity_bill?: number;
	line_items?: ChargeLineItem[];
	total_due?: number;
	returned_amount?: number;
	final_total?: number;
	notes?: string | null;
	shares?: BillShareInput[];
}

export interface PaymentPayload {
	bill_share_id: number;
	amount: number;
	paid_on: string;
	method?: string;
	reference?: string;
	notes?: string;
}

export interface Payment {
	id: number;
	bill_share_id: number;
	amount: number;
	paid_on: string;
	method: string;
	reference?: string | null;
	notes?: string | null;
	recorded_by?: {
		id: number;
		name: string;
	};
	bill_share?: {
		id: number;
		user_id: number;
		bill_id: number;
		bill?: {
			id: number;
			reference: string;
			for_month: string;
		} | null;
	};
}

export interface MenuItem {
	key: string;
	label: string;
	icon: string;
	path: string | null;
	active: boolean;
	required_ability?: 'manage_bills' | 'manage_settings' | 'view_all_records' | null;
	required_role?: 'super_admin' | 'admin' | 'resident' | null;
	children?: MenuItem[];
}
