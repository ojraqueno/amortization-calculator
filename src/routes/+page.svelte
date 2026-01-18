<script lang="ts">
	import { goto } from '$app/navigation';
	import { amortizationResults, type ResultsData } from '$lib/stores/amortization';
	import { formatLoanAmount, parseLoanAmount } from '$lib/utils/formatting';
	import { calculateAmortizationSchedule } from '$lib/utils/amortization';
	import { validateSessionData, validateSessionValues, type SessionData } from '$lib/types/session';
	import { parseSessionFile } from '$lib/utils/file-handling';
	import { DatePicker, Portal, parseDate } from '@skeletonlabs/skeleton-svelte';

	let loanAmount = $state(100000);
	let loanAmountDisplay = $state('100,000');
	let interestRate = $state(5.0);
	let paymentTerm = $state(30);
	let currencySymbol = $state('$');
	let startDate = $state(new Date().toISOString().split('T')[0]);
	let loadError = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = null;
	let pendingHidePastMonths: boolean | undefined = undefined;
	let isCalculating = $state(false);
	
	// Form validation errors
	let validationErrors = $state({
		loanAmount: '',
		interestRate: '',
		paymentTerm: '',
		startDate: ''
	});

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

	function validateForm(): boolean {
		validationErrors = {
			loanAmount: loanAmount <= 0 ? 'Loan amount must be greater than 0' : '',
			interestRate: interestRate < 0 ? 'Interest rate cannot be negative' : '',
			paymentTerm: paymentTerm <= 0 ? 'Payment term must be greater than 0' : '',
			startDate: !startDate ? 'Start date is required' : ''
		};
		return Object.values(validationErrors).every(err => !err);
	}

	async function calculateAmortization() {
		if (!validateForm()) {
			return;
		}
		
		isCalculating = true;
		// Allow UI to update
		await new Promise(resolve => setTimeout(resolve, 0));

		try {
			// Calculate amortization schedule using utility function
			const schedule = calculateAmortizationSchedule(
				loanAmount,
				interestRate,
				paymentTerm,
				startDate
			);

			// Calculate monthly payment
			const monthlyPayment = schedule[0]?.payment || 0;
			
			// Store data in the store and navigate to results
			const resultsData: ResultsData = {
				loanAmount,
				loanAmountDisplay,
				interestRate,
				paymentTerm,
				termUnit: 'years' as const,
				currencySymbol,
				startDate,
				monthlyPayment,
				schedule: schedule.map(item => ({
					...item,
					date: item.date.toISOString()
				})),
				...(pendingHidePastMonths !== undefined && { hidePastMonths: pendingHidePastMonths })
			};
			
			amortizationResults.set(resultsData);
			pendingHidePastMonths = undefined; // Clear after use
			goto('/results');
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'An error occurred during calculation.';
		} finally {
			isCalculating = false;
		}
	}

	async function handleFileLoad(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		// Reset error
		loadError = null;

		if (!file) {
			return;
		}

		try {
			// Parse and validate file
			const { data: parsedData, error: parseError } = await parseSessionFile(file);
			
			if (parseError) {
				loadError = parseError;
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
			pendingHidePastMonths = sessionData.hidePastMonths;

			// Clear the file input
			target.value = '';
			loadError = null;

			// Automatically calculate and submit the form with loaded values
			calculateAmortization();
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'An error occurred while reading the file. Please try again.';
			target.value = '';
		}
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
							<label for="currencySymbol" class="sr-only">Currency Symbol</label>
							<input
								type="text"
								id="currencySymbol"
								bind:value={currencySymbol}
								maxlength="5"
								class="input w-24"
								required
								aria-label="Currency symbol"
							/>
							<div class="flex-1 min-w-0">
								<input
									type="text"
									id="loanAmount"
									value={loanAmountDisplay}
									oninput={handleLoanAmountInput}
									class="input w-full number-input"
									class:input-error={validationErrors.loanAmount}
									required
									aria-invalid={validationErrors.loanAmount ? 'true' : 'false'}
									aria-describedby={validationErrors.loanAmount ? 'loanAmount-error' : undefined}
								/>
								{#if validationErrors.loanAmount}
									<div id="loanAmount-error" role="alert" class="mt-1 text-sm text-error-500">
										{validationErrors.loanAmount}
									</div>
								{/if}
							</div>
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
							class:input-error={validationErrors.interestRate}
							required
							aria-invalid={validationErrors.interestRate ? 'true' : 'false'}
							aria-describedby={validationErrors.interestRate ? 'interestRate-error' : undefined}
						/>
						{#if validationErrors.interestRate}
							<div id="interestRate-error" role="alert" class="mt-1 text-sm text-error-500">
								{validationErrors.interestRate}
							</div>
						{/if}
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
							class:input-error={validationErrors.paymentTerm}
							required
							aria-invalid={validationErrors.paymentTerm ? 'true' : 'false'}
							aria-describedby={validationErrors.paymentTerm ? 'paymentTerm-error' : undefined}
						/>
						{#if validationErrors.paymentTerm}
							<div id="paymentTerm-error" role="alert" class="mt-1 text-sm text-error-500">
								{validationErrors.paymentTerm}
							</div>
						{/if}
					</div>
					
					<div class="w-full max-w-md">
						<DatePicker
							value={startDate ? [parseDate(startDate)] : undefined}
							onValueChange={(e) => {
								const selectedDate = e.value?.at(0);
								if (selectedDate) {
									const year = selectedDate.year;
									const month = String(selectedDate.month).padStart(2, '0');
									const day = String(selectedDate.day).padStart(2, '0');
									startDate = `${year}-${month}-${day}`;
								} else {
									startDate = '';
								}
							}}
							invalid={!!validationErrors.startDate}
						>
							<DatePicker.Label>
								<span class="label-text">Start Date</span>
							</DatePicker.Label>
							<DatePicker.Control>
								<DatePicker.Input placeholder="mm/dd/yyyy" />
								<DatePicker.Trigger />
							</DatePicker.Control>
							<Portal>
								<DatePicker.Positioner>
									<DatePicker.Content>
										<DatePicker.View view="day">
											<DatePicker.Context>
												{#snippet children(datePicker)}
													<DatePicker.ViewControl>
														<DatePicker.PrevTrigger />
														<DatePicker.ViewTrigger>
															<DatePicker.RangeText />
														</DatePicker.ViewTrigger>
														<DatePicker.NextTrigger />
													</DatePicker.ViewControl>
													<DatePicker.Table>
														<DatePicker.TableHead>
															<DatePicker.TableRow>
																{#each datePicker().weekDays as weekDay, id (id)}
																	<DatePicker.TableHeader>{weekDay.short}</DatePicker.TableHeader>
																{/each}
															</DatePicker.TableRow>
														</DatePicker.TableHead>
														<DatePicker.TableBody>
															{#each datePicker().weeks as week, id (id)}
																<DatePicker.TableRow>
																	{#each week as day, id (id)}
																		<DatePicker.TableCell value={day}>
																			<DatePicker.TableCellTrigger>{day.day}</DatePicker.TableCellTrigger>
																		</DatePicker.TableCell>
																	{/each}
																</DatePicker.TableRow>
															{/each}
														</DatePicker.TableBody>
													</DatePicker.Table>
												{/snippet}
											</DatePicker.Context>
										</DatePicker.View>
										<DatePicker.View view="month">
											<DatePicker.Context>
												{#snippet children(datePicker)}
													<DatePicker.ViewControl>
														<DatePicker.PrevTrigger />
														<DatePicker.ViewTrigger>
															<DatePicker.RangeText />
														</DatePicker.ViewTrigger>
														<DatePicker.NextTrigger />
													</DatePicker.ViewControl>
													<DatePicker.Table>
														<DatePicker.TableBody>
															{#each datePicker().getMonthsGrid({ columns: 4, format: 'short' }) as months, id (id)}
																<DatePicker.TableRow>
																	{#each months as month, id (id)}
																		<DatePicker.TableCell value={month.value}>
																			<DatePicker.TableCellTrigger>{month.label}</DatePicker.TableCellTrigger>
																		</DatePicker.TableCell>
																	{/each}
																</DatePicker.TableRow>
															{/each}
														</DatePicker.TableBody>
													</DatePicker.Table>
												{/snippet}
											</DatePicker.Context>
										</DatePicker.View>
										<DatePicker.View view="year">
											<DatePicker.Context>
												{#snippet children(datePicker)}
													<DatePicker.ViewControl>
														<DatePicker.PrevTrigger />
														<DatePicker.ViewTrigger>
															<DatePicker.RangeText />
														</DatePicker.ViewTrigger>
														<DatePicker.NextTrigger />
													</DatePicker.ViewControl>
													<DatePicker.Table>
														<DatePicker.TableBody>
															{#each datePicker().getYearsGrid({ columns: 4 }) as years, id (id)}
																<DatePicker.TableRow>
																	{#each years as year, id (id)}
																		<DatePicker.TableCell value={year.value}>
																			<DatePicker.TableCellTrigger>{year.label}</DatePicker.TableCellTrigger>
																		</DatePicker.TableCell>
																	{/each}
																</DatePicker.TableRow>
															{/each}
														</DatePicker.TableBody>
													</DatePicker.Table>
												{/snippet}
											</DatePicker.Context>
										</DatePicker.View>
									</DatePicker.Content>
								</DatePicker.Positioner>
							</Portal>
						</DatePicker>
						{#if validationErrors.startDate}
							<div id="startDate-error" role="alert" class="mt-1 text-sm text-error-500">
								{validationErrors.startDate}
							</div>
						{/if}
					</div>
				</div>
				
				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full"
					disabled={isCalculating}
					aria-busy={isCalculating}
				>
					{isCalculating ? 'Calculating...' : 'Calculate Amortization Schedule'}
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
