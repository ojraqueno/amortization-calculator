import { writable } from 'svelte/store';

export type PaymentSchedule = {
	month?: number;
	date: Date;
	payment: number;
	interest: number;
	principal: number;
	remainingBalance: number;
};

export type LoanUpdate = {
	id: string;
	principalPayment: number;
	newInterestRate: number;
	date: string;
	updateType: 'retain-term' | 'retain-payment';
};

export type ResultsData = {
	loanAmount: number;
	loanAmountDisplay: string;
	interestRate: number;
	paymentTerm: number;
	termUnit: 'years' | 'months';
	currencySymbol: string;
	startDate: string;
	monthlyPayment: number;
	schedule: Array<{
		month?: number;
		date: string;
		payment: number;
		interest: number;
		principal: number;
		remainingBalance: number;
	}>;
	hidePastMonths?: boolean;
	loanUpdates?: LoanUpdate[];
	propertyName: string;
};

export const amortizationResults = writable<ResultsData | null>(null);
