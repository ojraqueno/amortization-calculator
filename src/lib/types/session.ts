/**
 * Session data types for saving/loading amortization sessions
 */

export type SessionData = {
	version: number;
	loanAmount: number;
	interestRate: number;
	paymentTerm: number;
	startDate: string;
	currencySymbol: string;
	hidePastMonths: boolean;
	propertyName: string;
};

/**
 * Type guard to validate session data structure
 */
export function validateSessionData(data: unknown): data is SessionData {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const obj = data as Record<string, unknown>;

	// Check all required fields exist
	if (
		!('version' in obj) ||
		!('loanAmount' in obj) ||
		!('interestRate' in obj) ||
		!('paymentTerm' in obj) ||
		!('startDate' in obj) ||
		!('currencySymbol' in obj) ||
		!('hidePastMonths' in obj) ||
		!('propertyName' in obj)
	) {
		return false;
	}

	// Validate version is an integer
	if (typeof obj.version !== 'number' || !Number.isInteger(obj.version)) {
		return false;
	}

	// Validate loanAmount is a number (float)
	if (typeof obj.loanAmount !== 'number' || isNaN(obj.loanAmount)) {
		return false;
	}

	// Validate interestRate is a number (float)
	if (typeof obj.interestRate !== 'number' || isNaN(obj.interestRate)) {
		return false;
	}

	// Validate paymentTerm is a number (float)
	if (typeof obj.paymentTerm !== 'number' || isNaN(obj.paymentTerm)) {
		return false;
	}

	// Validate startDate is a string
	if (typeof obj.startDate !== 'string') {
		return false;
	}

	// Validate currencySymbol is a string
	if (typeof obj.currencySymbol !== 'string') {
		return false;
	}

	// Validate hidePastMonths is a boolean
	if (typeof obj.hidePastMonths !== 'boolean') {
		return false;
	}

	// Validate propertyName is a string if present
	if ('propertyName' in obj && typeof obj.propertyName !== 'string') {
		return false;
	}

	return true;
}

/**
 * Validate session data values are within reasonable ranges
 */
export function validateSessionValues(data: SessionData): string | null {
	// Security: Validate reasonable ranges
	if (data.loanAmount <= 0 || data.loanAmount > 1e15) {
		return 'Loan amount must be greater than 0 and less than 1,000,000,000,000,000';
	}

	if (data.interestRate < 0 || data.interestRate > 1000) {
		return 'Interest rate must be between 0 and 1000%';
	}

	if (data.paymentTerm <= 0 || data.paymentTerm > 1000) {
		return 'Payment term must be greater than 0 and less than 1000 years';
	}

	// Validate startDate format (YYYY-MM-DD)
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(data.startDate)) {
		return 'Start date must be in YYYY-MM-DD format';
	}

	// Validate startDate is a valid date
	const date = new Date(data.startDate);
	if (isNaN(date.getTime())) {
		return 'Start date must be a valid date';
	}

	// Validate propertyName length (max 100 characters)
	if (data.propertyName && data.propertyName.length > 100) {
		return 'Property name must be 100 characters or less';
	}

	// Validate currencySymbol length (max 5 characters)
	if (data.currencySymbol.length > 5) {
		return 'Currency symbol must be 5 characters or less';
	}

	return null;
}
