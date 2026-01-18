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
	let loadError = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = null;

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
		
		// Check if hidePastMonths was stored (from loading a session)
		let hidePastMonthsValue: boolean | undefined;
		const storedHidePastMonths = sessionStorage.getItem('hidePastMonths');
		if (storedHidePastMonths !== null) {
			hidePastMonthsValue = JSON.parse(storedHidePastMonths);
			sessionStorage.removeItem('hidePastMonths'); // Clean up
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
			})),
			...(hidePastMonthsValue !== undefined && { hidePastMonths: hidePastMonthsValue })
		};
		
		sessionStorage.setItem('amortizationResults', JSON.stringify(resultsData));
		goto('/results');
	}

	type SessionData = {
		version: number;
		loanAmount: number;
		interestRate: number;
		paymentTerm: number;
		startDate: string;
		currencySymbol: string;
		hidePastMonths: boolean;
	};

	function validateSessionData(data: unknown): data is SessionData {
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
			!('hidePastMonths' in obj)
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

		return true;
	}

	function validateSessionValues(data: SessionData): string | null {
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

		// Validate currencySymbol length (max 5 characters)
		if (data.currencySymbol.length > 5) {
			return 'Currency symbol must be 5 characters or less';
		}

		return null;
	}

	async function handleFileLoad(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		// Reset error
		loadError = null;

		if (!file) {
			return;
		}

		// Security: Validate file type
		if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
			loadError = 'Invalid file type. Please select a JSON file.';
			target.value = '';
			return;
		}

		// Security: Validate file size (max 1MB)
		const MAX_FILE_SIZE = 1024 * 1024; // 1MB
		if (file.size > MAX_FILE_SIZE) {
			loadError = 'File size exceeds maximum allowed size of 1MB.';
			target.value = '';
			return;
		}

		// Security: Validate file is not empty
		if (file.size === 0) {
			loadError = 'File is empty.';
			target.value = '';
			return;
		}

		try {
			const fileContent = await file.text();

			// Security: Validate JSON is parseable
			let parsedData: unknown;
			try {
				parsedData = JSON.parse(fileContent);
			} catch (parseError) {
				loadError = 'Invalid JSON format. Please check the file and try again.';
				target.value = '';
				return;
			}

			// Validate schema
			if (!validateSessionData(parsedData)) {
				loadError = 'Invalid session file format. File must contain version, loanAmount, interestRate, paymentTerm, startDate, currencySymbol, and hidePastMonths fields.';
				target.value = '';
				return;
			}

			// Validate values are within reasonable ranges
			const validationError = validateSessionValues(parsedData);
			if (validationError) {
				loadError = validationError;
				target.value = '';
				return;
			}

			// All validations passed - load the data
			const sessionData = parsedData as SessionData;
			loanAmount = sessionData.loanAmount;
			loanAmountDisplay = formatLoanAmount(sessionData.loanAmount);
			interestRate = sessionData.interestRate;
			paymentTerm = sessionData.paymentTerm;
			startDate = sessionData.startDate;
			currencySymbol = sessionData.currencySymbol;

			// Store hidePastMonths temporarily so calculateAmortization can include it
			sessionStorage.setItem('hidePastMonths', JSON.stringify(sessionData.hidePastMonths));

			// Clear the file input
			target.value = '';
			loadError = null;

			// Automatically calculate and submit the form with loaded values
			calculateAmortization();
		} catch (error) {
			loadError = 'An error occurred while reading the file. Please try again.';
			target.value = '';
		}
	}

	function formatLoanAmount(value: number): string {
		if (isNaN(value) || value === 0) return '0';
		// Format with commas, allow decimals
		const parts = value.toString().split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

	function triggerFileInput() {
		fileInput?.click();
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

				<input
					type="file"
					accept=".json,application/json"
					bind:this={fileInput}
					onchange={handleFileLoad}
					class="hidden"
				/>
				<button
					type="button"
					onclick={triggerFileInput}
					class="btn preset-filled-primary-500 w-full"
				>
					Load Session
				</button>
				{#if loadError}
					<div class="mt-2 p-3 bg-error-500/20 border border-error-500 rounded text-error-500 text-sm">
						{loadError}
					</div>
				{/if}
			</form>
		</div>
	</div>
</div>
