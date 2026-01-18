<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	type PaymentSchedule = {
		month: number;
		date: Date;
		payment: number;
		interest: number;
		principal: number;
		remainingBalance: number;
	};

	type ResultsData = {
		loanAmount: number;
		loanAmountDisplay: string;
		interestRate: number;
		paymentTerm: number;
		termUnit: 'years' | 'months';
		currencySymbol: string;
		startDate: string;
		monthlyPayment: number;
		schedule: Array<{
			month: number;
			date: string;
			payment: number;
			interest: number;
			principal: number;
			remainingBalance: number;
		}>;
		hidePastMonths?: boolean;
	};

	let resultsData = $state<ResultsData | null>(null);
	let hidePastMonths = $state(false);

	onMount(() => {
		const stored = sessionStorage.getItem('amortizationResults');
		if (stored) {
			const data = JSON.parse(stored) as ResultsData;
			resultsData = data;
			// Restore hidePastMonths preference if it exists
			if (data.hidePastMonths !== undefined) {
				hidePastMonths = data.hidePastMonths;
			}
		} else {
			// No data found, redirect to home
			goto('/');
		}
	});

	function formatCurrency(amount: number): string {
		if (!resultsData) return '';
		const formatted = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
		return `${resultsData.currencySymbol}${formatted}`;
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	function formatLoanAmount(value: number): string {
		if (isNaN(value) || value === 0) return '';
		// Format with commas, allow decimals
		const parts = value.toString().split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

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

	function startNewSession() {
		sessionStorage.removeItem('amortizationResults');
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

		const jsonString = JSON.stringify(sessionData, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		
		const link = document.createElement('a');
		link.href = url;
		link.download = 'amortization-session.json';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
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
			<!-- Monthly Payment -->
			<div class="card preset-filled-neutral p-6 mb-8">
				<h2 class="h3 mb-4">Monthly Payment</h2>
				<p class="text-3xl font-semibold text-primary-500 mb-4">{formatCurrency(resultsData.monthlyPayment)}</p>
				<div class="flex flex-wrap gap-2">
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
							{#each filteredSchedule as payment}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap font-medium">
										{payment.month}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										{formatDate(payment.date)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrency(payment.payment)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrency(payment.principal)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right opacity-70">
										{formatCurrency(payment.interest)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										{formatCurrency(payment.remainingBalance)}
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
