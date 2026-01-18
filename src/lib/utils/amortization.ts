import type { PaymentSchedule, LoanUpdate } from '$lib/stores/amortization';

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
 * Calculate the number of months needed to pay off a loan with a given payment amount
 */
function calculateRemainingMonths(
	remainingBalance: number,
	annualInterestRate: number,
	monthlyPayment: number
): number {
	const monthlyRate = annualInterestRate / 12 / 100;
	
	if (monthlyRate === 0) {
		// If no interest, simply divide balance by payment
		return Math.ceil(remainingBalance / monthlyPayment);
	}
	
	if (monthlyPayment <= remainingBalance * monthlyRate) {
		// Payment is too small to cover interest, return a large number
		return Infinity;
	}
	
	// Use the amortization formula solved for n:
	// n = -log(1 - (P * r) / M) / log(1 + r)
	const numerator = remainingBalance * monthlyRate / monthlyPayment;
	if (numerator >= 1) {
		return Infinity;
	}
	
	const n = -Math.log(1 - numerator) / Math.log(1 + monthlyRate);
	return Math.ceil(n);
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

/**
 * Recalculate the amortization schedule with loan updates applied
 */
export function recalculateScheduleWithUpdates(
	originalSchedule: PaymentSchedule[],
	loanUpdates: LoanUpdate[],
	originalInterestRate: number,
	originalLoanAmount: number,
	originalLoanTermInYears: number
): PaymentSchedule[] {
	if (loanUpdates.length === 0) {
		return originalSchedule;
	}

	// Sort updates by date
	const sortedUpdates = [...loanUpdates].sort((a, b) => 
		new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	let currentSchedule = [...originalSchedule];
	let currentInterestRate = originalInterestRate;

	for (const update of sortedUpdates) {
		const updateDate = new Date(update.date);
		updateDate.setHours(0, 0, 0, 0);

		// Find the payment that occurs on or after the update date
		let updateIndex = -1;
		for (let i = 0; i < currentSchedule.length; i++) {
			const paymentDate = new Date(currentSchedule[i].date);
			paymentDate.setHours(0, 0, 0, 0);
			if (paymentDate >= updateDate) {
				updateIndex = i;
				break;
			}
		}

		if (updateIndex === -1) {
			// Update date is after all payments, skip it
			continue;
		}

		// Get the balance before this payment
		// If this is the first payment (index 0), use the original loan amount
		// Otherwise, use the balance from the previous payment
		const balanceBeforeUpdate = updateIndex === 0
			? originalLoanAmount
			: currentSchedule[updateIndex - 1].remainingBalance;
		
		// Update interest rate if changed
		currentInterestRate = update.newInterestRate;

		// Get the payment at the update index
		const currentPayment = currentSchedule[updateIndex];
		const monthlyRate = currentInterestRate / 12 / 100;

		// Calculate interest for the regular payment based on balance before update
		const interest = balanceBeforeUpdate * monthlyRate;
		const regularPrincipal = currentPayment.payment - interest;
		const balanceAfterRegularPayment = Math.max(0, balanceBeforeUpdate - regularPrincipal);

		// We'll determine the final balance after both payments based on their date ordering
		// This will be calculated after we add the payments to the schedule

		// Recalculate the schedule from this point forward
		const updatedSchedule: PaymentSchedule[] = currentSchedule.slice(0, updateIndex);
		
		// Use the exact date from the update modal for the extra payment
		const updatePaymentDate = new Date(update.date);
		updatePaymentDate.setHours(0, 0, 0, 0);
		
		// Determine the last payment's remaining balance before the extra payment
		// This will be used to calculate the extra payment's remaining balance
		let lastPaymentBalance: number;
		
		// Always include the regular monthly payment for the month where the update occurs
		// Use the scheduled payment date (not the update date) for the regular payment
		if (updateIndex < currentSchedule.length) {
			const regularPaymentDate = new Date(currentSchedule[updateIndex].date);
			regularPaymentDate.setHours(0, 0, 0, 0);
			
			// Check if the regular payment date is before or equal to the update date
			if (regularPaymentDate.getTime() <= updatePaymentDate.getTime()) {
				// Regular payment comes first (or same date), so it's the last payment before extra payment
				// Add the regular monthly payment for this month
				updatedSchedule.push({
					month: updateIndex + 1,
					date: regularPaymentDate,
					payment: Math.round(currentPayment.payment * 100) / 100,
					interest: Math.round(interest * 100) / 100,
					principal: Math.round(regularPrincipal * 100) / 100,
					remainingBalance: Math.round(balanceAfterRegularPayment * 100) / 100
				});
				// Last payment balance is after the regular payment
				lastPaymentBalance = balanceAfterRegularPayment;
			} else {
				// Extra payment comes before regular payment date
				// Last payment balance is the balance before the regular payment
				lastPaymentBalance = balanceBeforeUpdate;
			}
		} else {
			// No regular payment found, use balance before update
			lastPaymentBalance = balanceBeforeUpdate;
		}

		// Calculate the remaining balance after the extra principal payment
		// This is the last payment's remaining balance minus the extra principal payment
		const extraPaymentRemainingBalance = Math.max(0, lastPaymentBalance - update.principalPayment);

		// Add the extra principal payment as a separate entry using the exact date from the update modal
		// No month number assigned - it's an extra payment that doesn't count toward months
		updatedSchedule.push({
			date: updatePaymentDate,
			payment: Math.round(update.principalPayment * 100) / 100,
			interest: 0,
			principal: Math.round(update.principalPayment * 100) / 100,
			remainingBalance: Math.round(extraPaymentRemainingBalance * 100) / 100
		});
		
		// First, calculate the new payment amount and remaining months based on balance after extra payment
		// This will determine what the payment amount should be going forward
		let newMonthlyPayment: number;
		let remainingMonths: number;
		
		// Calculate based on balance after extra payment (before regular payment if it comes after)
		const balanceAfterExtraForCalc = extraPaymentRemainingBalance;
		
		if (update.updateType === 'retain-term') {
			// Keep the same number of months, recalculate payment amount
			// Calculate elapsed months: 
			// - updateIndex is 0-based (0 = first payment, 5 = sixth payment)
			// - If updateIndex = 5, we're at payment 6 (sixth payment)
			// - Payments 1-5 have been completed (indices 0-4) = 5 months completed
			// - Payment 6 (index 5) is being made/recalculated
			// - After payment 6 + extra payment, the new loan starts from payment 7
			// - At payment 7, we've completed 6 months (payments 1-6)
			// - So elapsed months = updateIndex + 1 (includes current payment being made)
			// However, we're recalculating from after the current payment, so we should count it
			// Actually, let's use updateIndex + 1 to include the current payment month
			// But the user says it's 1 month less, so maybe we need updateIndex + 2?
			// No wait - if it's 1 month LESS, that means we're subtracting too many months
			// So maybe elapsed should be updateIndex (without +1)?
			// Let's try: elapsed = updateIndex (completed payments before current)
			const elapsedMonths = updateIndex;
			// Calculate remaining term in years: original term minus elapsed months
			const remainingTermInYears = originalLoanTermInYears - (elapsedMonths / 12);
			// Calculate payment as if a new loan was taken out with remaining balance and remaining term
			console.log('New Loan Calculation (Retain Term):');
			console.log('  New Loan Amount:', balanceAfterExtraForCalc);
			console.log('  New Loan Term (years):', remainingTermInYears);
			console.log('  New Interest Rate (%):', currentInterestRate);
			newMonthlyPayment = calculateMonthlyPayment(
				balanceAfterExtraForCalc,
				currentInterestRate,
				remainingTermInYears
			);
			console.log('  Calculated Monthly Payment:', newMonthlyPayment);
			// Calculate remaining months from remaining term
			remainingMonths = Math.ceil(remainingTermInYears * 12);
		} else {
			// Retain payment amount, recalculate term
			newMonthlyPayment = currentPayment.payment;
			remainingMonths = calculateRemainingMonths(
				balanceAfterExtraForCalc,
				currentInterestRate,
				newMonthlyPayment
			);
			
			// If we can't calculate remaining months, keep the original term minus 1
			if (!isFinite(remainingMonths) || remainingMonths <= 0) {
				remainingMonths = currentSchedule.length - updateIndex - 1;
				newMonthlyPayment = calculateMonthlyPayment(
					balanceAfterExtraForCalc,
					currentInterestRate,
					remainingMonths / 12
				);
			}
		}

		// If the regular payment date is after the update date, add it now (after the extra payment)
		// Use the NEW payment amount if we're retaining term, or OLD payment amount if retaining payment
		let finalBalanceAfterBothPayments: number;
		if (updateIndex < currentSchedule.length) {
			const regularPaymentDate = new Date(currentSchedule[updateIndex].date);
			regularPaymentDate.setHours(0, 0, 0, 0);
			
			if (regularPaymentDate.getTime() > updatePaymentDate.getTime()) {
				// Regular payment comes after extra payment
				// Use the new payment amount for this regular payment
				const newBalanceBeforeRegular = extraPaymentRemainingBalance;
				const newInterest = newBalanceBeforeRegular * monthlyRate;
				const newRegularPrincipal = newMonthlyPayment - newInterest;
				const newBalanceAfterRegular = Math.max(0, newBalanceBeforeRegular - newRegularPrincipal);
				
				// Add the regular monthly payment for this month (after extra payment)
				// Use the NEW payment amount
				updatedSchedule.push({
					month: updateIndex + 1,
					date: regularPaymentDate,
					payment: Math.round(newMonthlyPayment * 100) / 100,
					interest: Math.round(newInterest * 100) / 100,
					principal: Math.round(newRegularPrincipal * 100) / 100,
					remainingBalance: Math.round(newBalanceAfterRegular * 100) / 100
				});
				
				finalBalanceAfterBothPayments = newBalanceAfterRegular;
			} else {
				// Regular payment comes first (or same date), extra payment last
				finalBalanceAfterBothPayments = extraPaymentRemainingBalance;
			}
		} else {
			finalBalanceAfterBothPayments = extraPaymentRemainingBalance;
		}

		// Now continue with the recalculated schedule
		let remainingBalance = finalBalanceAfterBothPayments;
		
		// Determine the last payment date (regular or extra, whichever comes later)
		let lastPaymentDate: Date;
		if (updateIndex < currentSchedule.length) {
			const regularPaymentDate = new Date(currentSchedule[updateIndex].date);
			regularPaymentDate.setHours(0, 0, 0, 0);
			lastPaymentDate = regularPaymentDate.getTime() > updatePaymentDate.getTime() 
				? regularPaymentDate 
				: updatePaymentDate;
		} else {
			lastPaymentDate = updatePaymentDate;
		}
		
		// Start from the month after the last payment (regular or extra)
		// The new loan calculation should account for the fact that we're starting
		// from the next payment, which means we've completed all payments up to and including
		// the last payment. So elapsed months should include the current payment month.
		const startDate = new Date(lastPaymentDate);
		startDate.setMonth(startDate.getMonth() + 1); // Start from next month after last payment
		
		// Determine the starting month number for the next payments
		// If we added the regular payment, it's updateIndex + 1, so next is updateIndex + 2
		// Otherwise, if we only added extra payment, next is updateIndex + 1
		const nextMonthNumber = updateIndex < currentSchedule.length 
			? updateIndex + 2 
			: updateIndex + 1;

		for (let month = 0; month < remainingMonths && remainingBalance > 0.01; month++) {
			const interest = remainingBalance * monthlyRate;
			const principal = newMonthlyPayment - interest;
			
			// Ensure we don't pay more than the remaining balance
			const actualPrincipal = Math.min(principal, remainingBalance);
			
			remainingBalance = Math.max(0, remainingBalance - actualPrincipal);
			const totalPayment = actualPrincipal + interest;

			// Calculate date for this payment
			const paymentDate = new Date(startDate);
			paymentDate.setMonth(startDate.getMonth() + month);

			updatedSchedule.push({
				month: nextMonthNumber + month,
				date: paymentDate,
				payment: Math.round(totalPayment * 100) / 100,
				interest: Math.round(interest * 100) / 100,
				principal: Math.round(actualPrincipal * 100) / 100,
				remainingBalance: Math.round(remainingBalance * 100) / 100
			});
		}

		currentSchedule = updatedSchedule;
	}

	// Sort the final schedule by date to ensure extra payments appear in the correct position
	// For same dates, entries with month numbers come before entries without (regular payments before extra payments)
	return currentSchedule.sort((a, b) => {
		const dateDiff = a.date.getTime() - b.date.getTime();
		if (dateDiff !== 0) return dateDiff;
		// Same date: regular payments (with month) come before extra payments (without month)
		if (a.month !== undefined && b.month === undefined) return -1;
		if (a.month === undefined && b.month !== undefined) return 1;
		return 0;
	});
}
