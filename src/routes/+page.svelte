<script lang="ts">
	import { goto } from '$app/navigation';

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
	let currencySymbol = $state('$');
	let startDate = $state(new Date().toISOString().split('T')[0]);

	function parseLoanAmount(value: string): number {
		// Remove commas and parse as number
		const cleaned = value.replace(/,/g, '');
		const parsed = parseFloat(cleaned);
		return isNaN(parsed) ? 0 : parsed;
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
			return;
		}

		// Convert term to months (always in years)
		const totalMonths = paymentTerm * 12;
		
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
		
		// Store data in sessionStorage and navigate to results
		const resultsData = {
			loanAmount,
			loanAmountDisplay,
			interestRate,
			paymentTerm,
			termUnit: 'years' as const,
			currencySymbol,
			startDate,
			monthlyPayment: payment,
			schedule: newSchedule.map(item => ({
				...item,
				date: item.date.toISOString()
			}))
		};
		
		sessionStorage.setItem('amortizationResults', JSON.stringify(resultsData));
		goto('/results');
	}
</script>

<div class="min-h-screen py-8 px-4">
	<div class="max-w-6xl mx-auto">
		<div class="mb-8">
			<h2 class="h2 text-center">Amortization Calculator</h2>
		</div>
		
		<!-- Input Form -->
		<div class="card preset-filled-neutral max-w-md mx-auto p-6 mb-8">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					calculateAmortization();
				}}
				class="space-y-6"
			>
				<div class="flex flex-col gap-6 items-center">
					<div class="w-full max-w-md">
						<label for="loanAmount" class="label">
							<span class="label-text">Loan Amount</span>
						</label>
						<div class="flex gap-2">
							<input
								type="text"
								id="currencySymbol"
								bind:value={currencySymbol}
								maxlength="5"
								class="input w-24"
								required
							/>
							<input
								type="text"
								id="loanAmount"
								value={loanAmountDisplay}
								oninput={handleLoanAmountInput}
								class="input flex-1 min-w-0 number-input"
								required
							/>
						</div>
					</div>
					
					<div class="w-full max-w-md">
						<label for="interestRate" class="label">
							<span class="label-text">Annual Interest Rate (%)</span>
						</label>
						<input
							type="number"
							id="interestRate"
							bind:value={interestRate}
							min="0"
							step="0.01"
							class="input w-full number-input"
							required
						/>
					</div>
					
					<div class="w-full max-w-md">
						<label for="paymentTerm" class="label">
							<span class="label-text">Payment Term (Years)</span>
						</label>
						<input
							type="number"
							id="paymentTerm"
							bind:value={paymentTerm}
							min="1"
							step="1"
							class="input w-full number-input"
							required
						/>
					</div>
					
					<div class="w-full max-w-md">
						<label for="startDate" class="label">
							<span class="label-text">Start Date</span>
						</label>
						<input
							type="date"
							id="startDate"
							bind:value={startDate}
							class="input w-full"
							required
						/>
					</div>
				</div>
				
				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full"
				>
					Calculate Amortization Schedule
				</button>
			</form>
		</div>
	</div>
</div>
