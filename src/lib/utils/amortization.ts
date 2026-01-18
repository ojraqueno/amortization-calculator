import type { PaymentSchedule } from '$lib/stores/amortization';

/**
 * Calculate the monthly payment for an amortized loan
 */
export function calculateMonthlyPayment(
	loanAmount: number,
	annualInterestRate: number,
	termInYears: number
): number {
	const totalMonths = termInYears * 12;
	const monthlyRate = annualInterestRate / 12 / 100;

	if (monthlyRate === 0) {
		// If interest rate is 0, simply divide principal by number of months
		return loanAmount / totalMonths;
	}

	// Calculate monthly payment using amortization formula
	// M = P * [r(1+r)^n] / [(1+r)^n - 1]
	const factor = Math.pow(1 + monthlyRate, totalMonths);
	return loanAmount * (monthlyRate * factor) / (factor - 1);
}

/**
 * Calculate the complete amortization schedule
 */
export function calculateAmortizationSchedule(
	loanAmount: number,
	annualInterestRate: number,
	termInYears: number,
	startDate: string
): PaymentSchedule[] {
	const totalMonths = termInYears * 12;
	const monthlyRate = annualInterestRate / 12 / 100;
	const payment = calculateMonthlyPayment(loanAmount, annualInterestRate, termInYears);

	const schedule: PaymentSchedule[] = [];
	let remainingBalance = loanAmount;
	const start = new Date(startDate);

	for (let month = 1; month <= totalMonths; month++) {
		const interest = remainingBalance * monthlyRate;
		const principal = payment - interest;
		remainingBalance = Math.max(0, remainingBalance - principal);

		// Calculate date for this month
		const paymentDate = new Date(start);
		paymentDate.setMonth(start.getMonth() + month - 1);

		schedule.push({
			month,
			date: paymentDate,
			payment: Math.round(payment * 100) / 100,
			interest: Math.round(interest * 100) / 100,
			principal: Math.round(principal * 100) / 100,
			remainingBalance: Math.round(remainingBalance * 100) / 100
		});
	}

	return schedule;
}
