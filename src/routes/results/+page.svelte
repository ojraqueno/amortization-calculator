<script lang="ts">
	import { goto } from '$app/navigation';
	import { amortizationResults, type ResultsData } from '$lib/stores/amortization';
	import { formatCurrency, formatDate, formatLoanAmount } from '$lib/utils/formatting';
	import { downloadSessionFile } from '$lib/utils/file-handling';
	import MonthsProgressBar from '$lib/components/MonthsProgressBar.svelte';
	import PrincipalProgressBar from '$lib/components/PrincipalProgressBar.svelte';
	import { onMount } from 'svelte';

	let resultsData = $state<ResultsData | null>(null);
	let hidePastMonths = $state(false);

	let isInitializing = $state(true);

	onMount(() => {
		// Subscribe to the store
		const unsubscribe = amortizationResults.subscribe((data) => {
			if (data) {
				resultsData = data;
				// Restore hidePastMonths preference if it exists
				if (data.hidePastMonths !== undefined) {
					hidePastMonths = data.hidePastMonths;
				}
				isInitializing = false;
			} else {
				// No data found, redirect to home
				goto('/');
			}
		});

		// Cleanup subscription on unmount
		return () => unsubscribe();
	});

	// Format currency with the store's currency symbol
	function formatCurrencyWithSymbol(amount: number): string {
		if (!resultsData) return '';
		return formatCurrency(amount, resultsData.currencySymbol);
	}

	// Persist hidePastMonths changes back to the store (only after initialization)
	$effect(() => {
		if (!isInitializing && resultsData && hidePastMonths !== resultsData.hidePastMonths) {
			amortizationResults.update((data) => {
				if (data) {
					return { ...data, hidePastMonths };
				}
				return data;
			});
		}
	});

	let schedule = $derived.by(() => {
		if (!resultsData) return [];
		return resultsData.schedule.map(item => ({
			...item,
			date: new Date(item.date)
		}));
	});

	let filteredSchedule = $derived.by(() => {
		if (!hidePastMonths) {
			return schedule;
		}
		
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayTime = today.getTime();
		
		return schedule.filter(payment => {
			const paymentDate = new Date(payment.date);
			paymentDate.setHours(0, 0, 0, 0);
			const paymentTime = paymentDate.getTime();
			
			// Keep payments that are today or in the future (hide past months)
			return paymentTime >= todayTime;
		});
	});

	// Calculate progress values for progress bars as of today
	// Helper function to calculate months between two dates
	function monthsBetweenDates(startDate: Date, endDate: Date): number {
		const startYear = startDate.getFullYear();
		const startMonth = startDate.getMonth();
		const endYear = endDate.getFullYear();
		const endMonth = endDate.getMonth();
		return (endYear - startYear) * 12 + (endMonth - startMonth);
	}

	// Find the current payment based on today's date
	let currentPayment = $derived.by(() => {
		if (!resultsData || schedule.length === 0) return null;
		
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// Find the most recent payment that has occurred (payment date <= today)
		for (let i = schedule.length - 1; i >= 0; i--) {
			const paymentDate = new Date(schedule[i].date);
			paymentDate.setHours(0, 0, 0, 0);
			if (paymentDate <= today) {
				return schedule[i];
			}
		}
		
		// If no payment has occurred yet, return the first payment
		return schedule.length > 0 ? schedule[0] : null;
	});

	// Calculate months elapsed as of today
	let monthsElapsed = $derived.by(() => {
		if (!resultsData) return 0;
		const startDate = new Date(resultsData.startDate);
		const today = new Date();
		const totalMonths = resultsData.paymentTerm * 12;
		return Math.max(0, Math.min(monthsBetweenDates(startDate, today), totalMonths));
	});

	// Months Progress: Percentage of months completed as of today
	let monthsProgress = $derived.by(() => {
		if (!resultsData || schedule.length === 0) return 0;
		const totalMonths = resultsData.paymentTerm * 12;
		return totalMonths > 0 ? Math.min(100, (monthsElapsed / totalMonths) * 100) : 0;
	});

	// Principal Progress: Percentage of principal paid off as of today
	let principalProgress = $derived.by(() => {
		if (!resultsData || !currentPayment) return 0;
		
		const originalLoan = resultsData.loanAmount;
		const remainingBalanceAsOfToday = currentPayment.remainingBalance;
		const principalPaid = originalLoan - remainingBalanceAsOfToday;
		
		return originalLoan > 0 ? Math.min(100, Math.max(0, (principalPaid / originalLoan) * 100)) : 0;
	});

	function startNewSession() {
		amortizationResults.set(null);
		goto('/');
	}

	function saveSession() {
		if (!resultsData) return;

		const sessionData = {
			version: 1,
			loanAmount: resultsData.loanAmount,
			interestRate: resultsData.interestRate,
			paymentTerm: resultsData.paymentTerm,
			startDate: resultsData.startDate,
			currencySymbol: resultsData.currencySymbol,
			hidePastMonths: hidePastMonths
		};

		downloadSessionFile(sessionData);
	}
</script>

<div class="min-h-screen py-8 px-4">
	<div class="max-w-6xl mx-auto">
		<div class="relative mb-8">
			<h1 class="h1 text-center">Amortization Results</h1>
			<div class="absolute top-0 right-0 flex gap-2">
				<button
					onclick={saveSession}
					class="btn preset-filled-primary-500"
				>
					Save Session
				</button>
				<button
					onclick={startNewSession}
					class="btn preset-filled-primary-500"
				>
					New Session
				</button>
			</div>
		</div>

		{#if resultsData}
			<!-- Monthly Payment with Progress Bars -->
			<div class="card preset-filled-neutral p-6 mb-8">
				<h2 class="h3 mb-4">Monthly Payment</h2>
				<p class="text-3xl font-semibold text-primary-500 mb-4">{formatCurrencyWithSymbol(resultsData.monthlyPayment)}</p>
				<div class="flex flex-wrap gap-2 mb-6">
					<span class="badge preset-filled-surface-200-800 rounded-full">
						Loan: {resultsData.currencySymbol}{resultsData.loanAmountDisplay || formatLoanAmount(resultsData.loanAmount)}
					</span>
					<span class="badge preset-filled-surface-200-800 rounded-full">
						Rate: {resultsData.interestRate}%
					</span>
					<span class="badge preset-filled-surface-200-800 rounded-full">
						Term: {resultsData.paymentTerm} years
					</span>
					<span class="badge preset-filled-surface-200-800 rounded-full">
						Start Date: {formatDate(new Date(resultsData.startDate))}
					</span>
				</div>
				
				<!-- Progress Bars -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<MonthsProgressBar
						monthsElapsed={monthsElapsed}
						totalMonths={resultsData.paymentTerm * 12}
						progress={monthsProgress}
						noCard={true}
					/>
					<PrincipalProgressBar
						principalPaid={currentPayment ? resultsData.loanAmount - currentPayment.remainingBalance : 0}
						originalLoan={resultsData.loanAmount}
						progress={principalProgress}
						currencySymbol={resultsData.currencySymbol}
						noCard={true}
					/>
				</div>
			</div>

			<!-- Amortization Schedule Table -->
			<div class="card preset-filled-neutral p-6 overflow-x-auto">
				<div class="flex justify-between items-center mb-4">
					<h2 class="h3">Amortization Schedule</h2>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={hidePastMonths}
							class="checkbox"
						/>
						<span class="text-sm">Hide past months</span>
					</label>
				</div>
				<div class="overflow-x-auto">
					<table class="table min-w-full">
						<thead>
							<tr>
								<th class="px-6 py-3 text-left uppercase tracking-wider">
									Month
								</th>
								<th class="px-6 py-3 text-left uppercase tracking-wider">
									Date
								</th>
							<th class="px-6 py-3 text-right uppercase tracking-wider" style="text-align: right;">
								Payment
							</th>
							<th class="px-6 py-3 text-right uppercase tracking-wider" style="text-align: right;">
								Principal
							</th>
							<th class="px-6 py-3 text-right uppercase tracking-wider" style="text-align: right;">
								Interest
							</th>
							<th class="px-6 py-3 text-right uppercase tracking-wider" style="text-align: right;">
								Remaining Balance
							</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredSchedule as payment (payment.month)}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap font-medium">
										{payment.month}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										{formatDate(payment.date)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrencyWithSymbol(payment.payment)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrencyWithSymbol(payment.principal)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right opacity-70">
										{formatCurrencyWithSymbol(payment.interest)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrencyWithSymbol(payment.remainingBalance)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="card preset-filled-neutral p-6 text-center">
				<p>Loading results...</p>
			</div>
		{/if}
	</div>
</div>
