const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
	body?: unknown;
	token?: string | null;
};

const extractMessage = (payload: unknown): string => {
	if (
		payload &&
		typeof payload === 'object' &&
		'message' in payload &&
		typeof (payload as { message?: unknown }).message === 'string'
	) {
		return (payload as { message: string }).message;
	}

	if (payload && typeof payload === 'object' && 'errors' in payload) {
		const errorBag = (payload as { errors?: unknown }).errors;
		if (errorBag && typeof errorBag === 'object') {
			const messages = Object.values(errorBag as Record<string, unknown>)
				.flatMap(entry => (Array.isArray(entry) ? entry : typeof entry === 'string' ? [entry] : []))
				.filter((entry): entry is string => typeof entry === 'string');

			if (messages.length > 0) {
				return messages[0];
			}
		}
	}

	return 'Unexpected error. Please try again.';
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
	const { body, token, headers, ...rest } = options;

	const normalizedHeaders: Record<string, string> = {
		Accept: 'application/json',
		...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
	};

	if (headers) {
		if (headers instanceof Headers) {
			headers.forEach((value, key) => {
				normalizedHeaders[key] = value;
			});
		} else if (Array.isArray(headers)) {
			for (const [key, value] of headers) {
				normalizedHeaders[key] = value;
			}
		} else {
			Object.assign(normalizedHeaders, headers);
		}
	}

	if (token) {
		normalizedHeaders.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method: rest.method ?? 'GET',
		headers: normalizedHeaders,
		body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
		...rest
	});

	if (response.status === 204) {
		return {} as T;
	}

	const payload = (await response.json().catch(() => ({}))) as unknown;

	if (!response.ok) {
		throw new Error(extractMessage(payload));
	}

	return payload as T;
}

export { API_BASE_URL };
