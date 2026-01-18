/**
 * Formatting utility functions
 */

/**
 * Format a number as currency with the given symbol
 */
export function formatCurrency(amount: number, currencySymbol: string): string {
	const formatted = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	return `${currencySymbol}${formatted}`;
}

/**
 * Format a date as a readable string
 */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(date);
}

/**
 * Format a loan amount with commas and allow decimals
 */
export function formatLoanAmount(value: number): string {
	if (isNaN(value) || value === 0) return '0';
	// Format with commas, allow decimals
	const parts = value.toString().split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return parts.join('.');
}

/**
 * Parse a loan amount string (with commas) to a number
 */
export function parseLoanAmount(value: string): number {
	// Remove commas and parse as number
	const cleaned = value.replace(/,/g, '');
	const parsed = parseFloat(cleaned);
	return isNaN(parsed) ? 0 : parsed;
}
