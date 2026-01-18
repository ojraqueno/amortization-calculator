<script lang="ts">
	type PaymentSchedule = {
		month: number;
		date: Date;
		payment: number;
		interest: number;
		principal: number;
		remainingBalance: number;
	};

	let loanAmount = $state(100000);
	let loanAmountDisplay = $state('100,000');
	let interestRate = $state(5.0);
	let paymentTerm = $state(30);
	let termUnit = $state<'years' | 'months'>('years');
	let currencySymbol = $state('$');
	let startDate = $state(new Date().toISOString().split('T')[0]);
	let schedule = $state<PaymentSchedule[]>([]);
	let monthlyPayment = $state<number | null>(null);
	let formSubmitted = $state(false);
	let hidePastMonths = $state(false);

	function parseLoanAmount(value: string): number {
		// Remove commas and parse as number
		const cleaned = value.replace(/,/g, '');
		const parsed = parseFloat(cleaned);
		return isNaN(parsed) ? 0 : parsed;
	}

	function formatLoanAmount(value: number): string {
		if (isNaN(value) || value === 0) return '';
		// Format with commas, allow decimals
		const parts = value.toString().split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

	function handleLoanAmountInput(event: Event) {
		const target = event.target as HTMLInputElement;
		let value = target.value;
		
		// Allow only digits, commas, and one decimal point
		value = value.replace(/[^\d,.]/g, '');
		
		// Ensure only one decimal point
		const decimalIndex = value.indexOf('.');
		if (decimalIndex !== -1) {
			const beforeDecimal = value.substring(0, decimalIndex);
			const afterDecimal = value.substring(decimalIndex + 1);
			value = beforeDecimal.replace(/[^\d,]/g, '') + '.' + afterDecimal.replace(/[^\d]/g, '');
		} else {
			value = value.replace(/[^\d,]/g, '');
		}
		
		loanAmountDisplay = value;
		loanAmount = parseLoanAmount(value);
	}

	function calculateAmortization() {
		if (loanAmount <= 0 || interestRate < 0 || paymentTerm <= 0) {
			schedule = [];
			monthlyPayment = null;
			formSubmitted = false;
			return;
		}
		
		formSubmitted = true;

		// Convert term to months
		const totalMonths = termUnit === 'years' ? paymentTerm * 12 : paymentTerm;
		
		// Monthly interest rate (annual rate / 12 / 100)
		const monthlyRate = interestRate / 12 / 100;
		
		// Calculate monthly payment using amortization formula
		// M = P * [r(1+r)^n] / [(1+r)^n - 1]
		let payment: number;
		if (monthlyRate === 0) {
			// If interest rate is 0, simply divide principal by number of months
			payment = loanAmount / totalMonths;
		} else {
			const factor = Math.pow(1 + monthlyRate, totalMonths);
			payment = loanAmount * (monthlyRate * factor) / (factor - 1);
		}
		
		monthlyPayment = payment;
		
		// Calculate schedule
		let remainingBalance = loanAmount;
		const newSchedule: PaymentSchedule[] = [];
		const start = new Date(startDate);
		
		for (let month = 1; month <= totalMonths; month++) {
			const interest = remainingBalance * monthlyRate;
			const principal = payment - interest;
			remainingBalance = Math.max(0, remainingBalance - principal);
			
			// Calculate date for this month
			const paymentDate = new Date(start);
			paymentDate.setMonth(start.getMonth() + month - 1);
			
			newSchedule.push({
				month,
				date: paymentDate,
				payment: Math.round(payment * 100) / 100,
				interest: Math.round(interest * 100) / 100,
				principal: Math.round(principal * 100) / 100,
				remainingBalance: Math.round(remainingBalance * 100) / 100
			});
		}
		
		schedule = newSchedule;
	}

	function formatCurrency(amount: number): string {
		const formatted = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
		return `${currencySymbol}${formatted}`;
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}


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
		formSubmitted = false;
		schedule = [];
		monthlyPayment = null;
	}
</script>

<div class="min-h-screen bg-gray-100 py-8 px-4">
	<div class="max-w-6xl mx-auto">
		<div class="relative mb-8">
			<h1 class="text-4xl font-bold text-gray-900 text-center">Amortization Calculator</h1>
			{#if formSubmitted}
				<button
					onclick={startNewSession}
					class="absolute top-0 right-0 px-4 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors cursor-pointer"
				>
					New Session
				</button>
			{/if}
		</div>
		
		<!-- Input Form -->
		{#if !formSubmitted}
		<div class="bg-white rounded-lg shadow-lg p-6 mb-8 max-w-md mx-auto">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					calculateAmortization();
				}}
				class="space-y-6"
			>
				<div class="flex flex-col gap-6 items-center">
					<div class="w-full max-w-md">
						<label for="loanAmount" class="block text-sm font-medium text-gray-700 mb-2">
							Loan Amount
						</label>
						<div class="flex gap-2">
							<input
								type="text"
								id="currencySymbol"
								bind:value={currencySymbol}
								maxlength="5"
								class="w-24 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
							<input
								type="text"
								id="loanAmount"
								value={loanAmountDisplay}
								oninput={handleLoanAmountInput}
								class="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
					</div>
					
					<div class="w-full max-w-md">
						<label for="interestRate" class="block text-sm font-medium text-gray-700 mb-2">
							Annual Interest Rate (%)
						</label>
						<input
							type="number"
							id="interestRate"
							bind:value={interestRate}
							min="0"
							step="0.01"
							class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							required
						/>
					</div>
					
					<div class="w-full max-w-md">
						<label for="paymentTerm" class="block text-sm font-medium text-gray-700 mb-2">
							Payment Term
						</label>
						<div class="flex gap-2">
							<input
								type="number"
								id="paymentTerm"
								bind:value={paymentTerm}
								min="1"
								step="1"
								class="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
							<select
								bind:value={termUnit}
								class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 whitespace-nowrap"
							>
								<option value="years">Years</option>
								<option value="months">Months</option>
							</select>
						</div>
					</div>
					
					<div class="w-full max-w-md">
						<label for="startDate" class="block text-sm font-medium text-gray-700 mb-2">
							Start Date
						</label>
						<input
							type="date"
							id="startDate"
							bind:value={startDate}
							class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							required
						/>
					</div>
				</div>
				
				<button
					type="submit"
					class="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer"
				>
					Calculate Amortization Schedule
				</button>
			</form>
		</div>
		{/if}

		<!-- Results -->
		{#if monthlyPayment !== null && schedule.length > 0}
			<div class="bg-white rounded-lg shadow-lg p-6 mb-8">
				<h2 class="text-2xl font-bold text-gray-900 mb-4">Monthly Payment</h2>
				<p class="text-3xl font-semibold text-blue-600 mb-4">{formatCurrency(monthlyPayment)}</p>
				<div class="flex flex-wrap gap-2">
					<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
						Loan: {currencySymbol}{loanAmountDisplay || formatLoanAmount(loanAmount)}
					</span>
					<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
						Rate: {interestRate}%
					</span>
					<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
						Term: {paymentTerm} {termUnit}
					</span>
				</div>
			</div>

			<!-- Amortization Schedule Table -->
			<div class="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-2xl font-bold text-gray-900">Amortization Schedule</h2>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={hidePastMonths}
							class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700">Hide past months</span>
					</label>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Month
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Date
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Payment
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Principal
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Interest
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Remaining Balance
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each filteredSchedule as payment}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{payment.month}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										{formatDate(payment.date)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
										{formatCurrency(payment.payment)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
										{formatCurrency(payment.principal)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
										{formatCurrency(payment.interest)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
										{formatCurrency(payment.remainingBalance)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>
