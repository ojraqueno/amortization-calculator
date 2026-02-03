<script lang="ts">
	import { goto } from '$app/navigation';
	import { SvelteDate } from 'svelte/reactivity';
	import { amortizationResults, type ResultsData, type LoanUpdate } from '$lib/stores/amortization';
	import { formatCurrency, formatDate, formatLoanAmount, parseLoanAmount } from '$lib/utils/formatting';
	import { downloadSessionFile } from '$lib/utils/file-handling';
	import MonthsProgressBar from '$lib/components/MonthsProgressBar.svelte';
	import PrincipalProgressBar from '$lib/components/PrincipalProgressBar.svelte';
	import { recalculateScheduleWithUpdates } from '$lib/utils/amortization';
	import { AppBar, DatePicker, Dialog, Portal, parseDate } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';

	let resultsData = $state<ResultsData | null>(null);
	let hidePastMonths = $state(false);

	let isInitializing = $state(true);
	let showUpdateModal = $state(false);
	
	// Loan update form state
	let principalPaymentDisplay = $state('');
	let principalPayment = $state(0);
	let newInterestRate = $state(0);
	let updateDate = $state(new Date().toISOString().split('T')[0]);
	let updateType = $state<'retain-term' | 'retain-payment'>('retain-term');

	onMount(() => {
		// Subscribe to the store
		const unsubscribe = amortizationResults.subscribe(async (data) => {
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
		
		const baseSchedule = resultsData.schedule.map(item => ({
			...item,
			date: new SvelteDate(item.date)
		}));
		
		// Apply loan updates if any
		if (resultsData.loanUpdates && resultsData.loanUpdates.length > 0) {
			return recalculateScheduleWithUpdates(
				baseSchedule,
				resultsData.loanUpdates,
				resultsData.interestRate,
				resultsData.loanAmount,
				resultsData.paymentTerm
			);
		}
		
		return baseSchedule;
	});

	// Count only entries with a month number (exclude extra principal payments)
	let totalMonths = $derived.by(() => schedule.filter((s) => s.month !== undefined).length);

	let filteredSchedule = $derived.by(() => {
		if (!hidePastMonths) {
			return schedule;
		}
		
		const today = new SvelteDate();
		today.setHours(0, 0, 0, 0);
		const todayTime = today.getTime();
		
		return schedule.filter(payment => {
			const paymentDate = new SvelteDate(payment.date);
			paymentDate.setHours(0, 0, 0, 0);
			const paymentTime = paymentDate.getTime();
			
			// Keep payments that are today or in the future (hide past months)
			return paymentTime >= todayTime;
		});
	});

	// Calculate progress values for progress bars as of today
	// Helper function to calculate months between two dates
	function _monthsBetweenDates(startDate: Date, endDate: Date): number {
		const startYear = startDate.getFullYear();
		const startMonth = startDate.getMonth();
		const endYear = endDate.getFullYear();
		const endMonth = endDate.getMonth();
		return (endYear - startYear) * 12 + (endMonth - startMonth);
	}

	// Find the current payment based on today's date
	let currentPayment = $derived.by(() => {
		if (!resultsData || schedule.length === 0) return null;
		
		const today = new SvelteDate();
		today.setHours(0, 0, 0, 0);
		
		// Find the most recent payment that has occurred (payment date <= today)
		for (let i = schedule.length - 1; i >= 0; i--) {
			const paymentDate = new SvelteDate(schedule[i].date);
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
		if (!resultsData || schedule.length === 0) return 0;
		const today = new SvelteDate();
		today.setHours(0, 0, 0, 0);
		
		// Count payments that have occurred (payment date <= today) with a month number
		let elapsed = 0;
		for (const payment of schedule) {
			if (payment.month !== undefined) {
				const paymentDate = new SvelteDate(payment.date);
				paymentDate.setHours(0, 0, 0, 0);
				if (paymentDate <= today) {
					elapsed++;
				}
			}
		}
		
		return elapsed;
	});

	// Months Progress: Percentage of months completed as of today
	let monthsProgress = $derived.by(() => {
		if (!resultsData || totalMonths === 0) return 0;
		return Math.min(100, (monthsElapsed / totalMonths) * 100);
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
			hidePastMonths: hidePastMonths,
			propertyName: resultsData.propertyName
		};

		downloadSessionFile(sessionData);
	}

	function handlePrincipalPaymentInput(event: Event) {
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
		
		principalPaymentDisplay = value;
		principalPayment = parseLoanAmount(value);
	}

	function openUpdateModal() {
		if (!resultsData) return;
		// Initialize form with current values
		principalPaymentDisplay = '';
		newInterestRate = resultsData.interestRate;
		updateDate = new Date().toISOString().split('T')[0];
		updateType = 'retain-term';
		showUpdateModal = true;
	}

	function closeUpdateModal() {
		showUpdateModal = false;
	}

	function submitLoanUpdate() {
		if (!resultsData || principalPayment <= 0) return;

		const update: LoanUpdate = {
			id: globalThis.crypto.randomUUID(),
			principalPayment,
			newInterestRate,
			date: updateDate,
			updateType
		};

		const updates = [...(resultsData.loanUpdates || []), update];
		
		amortizationResults.update((data) => {
			if (data) {
				return { ...data, loanUpdates: updates };
			}
			return data;
		});

		closeUpdateModal();
	}

	function removeLoanUpdate(updateId: string) {
		if (!resultsData) return;

		const updates = (resultsData.loanUpdates || []).filter(update => update.id !== updateId);
		
		amortizationResults.update((data) => {
			if (data) {
				return { ...data, loanUpdates: updates };
			}
			return data;
		});
	}

	function clearAllLoanUpdates() {
		if (!resultsData) return;
		
		amortizationResults.update((data) => {
			if (data) {
				return { ...data, loanUpdates: [] };
			}
			return data;
		});
	}
</script>

<div class="min-h-screen">
	<AppBar class="mb-8 shadow-sm">
		<AppBar.Toolbar class="w-full max-w-6xl mx-auto px-4 flex justify-between items-center">
			<div class="h3 md:h2 truncate pr-4">
				{resultsData?.propertyName || ''}
			</div>
			<div class="flex gap-2 shrink-0">
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
		</AppBar.Toolbar>
	</AppBar>

	<div class="px-4">
		<div class="max-w-6xl mx-auto">
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
						totalMonths={totalMonths}
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
				<div class="flex flex-wrap justify-between items-center gap-3 mb-4">
					<h2 class="h3">Amortization Schedule</h2>
					<div class="flex items-center gap-3">
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={hidePastMonths}
								class="checkbox"
							/>
							<span class="text-sm">Hide past months</span>
						</label>
						<button
							onclick={openUpdateModal}
							class="btn preset-filled-primary-500"
						>
							Update Loan
						</button>
					</div>
				</div>
				
				{#if resultsData.loanUpdates && resultsData.loanUpdates.length > 0}
					<div class="mb-4">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium">Loan Updates:</span>
							<button
								onclick={clearAllLoanUpdates}
								class="btn preset-tonal-error text-sm"
								aria-label="Clear all loan updates"
							>
								Clear All
							</button>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each resultsData.loanUpdates as update (update.id)}
								<div class="badge preset-filled-surface-200-800 rounded-full flex items-center gap-2">
									<span>
										Extra Payment: {formatCurrencyWithSymbol(update.principalPayment)} | 
										New Rate: {update.newInterestRate}% | 
										Date: {formatDate(new Date(update.date))} | 
										{update.updateType === 'retain-term' ? 'Retain Term' : 'Retain Payment'}
									</span>
									<button
										onclick={() => removeLoanUpdate(update.id)}
										class="ml-2 hover:opacity-70 transition-opacity"
										aria-label="Remove this loan update"
										title="Remove this loan update"
									>
										<span aria-hidden="true" class="text-lg">×</span>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
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
							{#each filteredSchedule as payment (payment.month ?? payment.date.getTime())}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap font-medium">
										{payment.month ?? '—'}
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

</div>

<!-- Loan Update Modal -->
<Dialog 
	open={showUpdateModal} 
	onOpenChange={(details) => { 
		showUpdateModal = details.open;
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm" />
		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<Dialog.Content class="card preset-filled-neutral p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl bg-surface-100-900">
				<header class="flex justify-between items-center mb-4">
					<Dialog.Title class="h3">Loan Update</Dialog.Title>
					<Dialog.CloseTrigger class="btn-icon preset-tonal">
						<span aria-hidden="true">×</span>
					</Dialog.CloseTrigger>
				</header>

				<form onsubmit={(e) => { e.preventDefault(); submitLoanUpdate(); }} class="space-y-4">
					<div>
						<label for="principalPayment" class="label">
							<span class="label-text">Principal Payment Amount</span>
						</label>
						<div class="flex gap-2 items-center">
							<span class="text-lg">{resultsData?.currencySymbol || '$'}</span>
							<input
								type="text"
								id="principalPayment"
								value={principalPaymentDisplay}
								oninput={handlePrincipalPaymentInput}
								class="input flex-1"
								placeholder="0"
								required
							/>
						</div>
					</div>

					<div>
						<label for="newInterestRate" class="label">
							<span class="label-text">New Interest Rate (%)</span>
						</label>
						<input
							type="number"
							id="newInterestRate"
							bind:value={newInterestRate}
							min="0"
							step="0.01"
							class="input w-full"
							required
						/>
					</div>

					<div>
						<DatePicker
							value={updateDate ? [parseDate(updateDate)] : undefined}
							onValueChange={(e) => {
								const selectedDate = e.value?.at(0);
								if (selectedDate) {
									const year = selectedDate.year;
									const month = String(selectedDate.month).padStart(2, '0');
									const day = String(selectedDate.day).padStart(2, '0');
									updateDate = `${year}-${month}-${day}`;
								} else {
									updateDate = '';
								}
							}}
						>
							<DatePicker.Label>
								<span class="label-text">Update Date</span>
							</DatePicker.Label>
							<DatePicker.Control>
								<DatePicker.Input placeholder="mm/dd/yyyy" />
								<DatePicker.Trigger />
							</DatePicker.Control>
							<Portal>
								<DatePicker.Positioner class="!z-[100]">
									<DatePicker.Content class="!z-[100]">
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
					</div>

					<fieldset>
						<legend class="label-text mb-2">Update Type</legend>
						<div class="flex flex-col gap-3">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="updateType"
									value="retain-term"
									bind:group={updateType}
									class="radio"
								/>
								<span>Retain payment term but lower the amount</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="updateType"
									value="retain-payment"
									bind:group={updateType}
									class="radio"
								/>
								<span>Retain payment amount but shorten the term</span>
							</label>
						</div>
					</fieldset>

					<footer class="flex gap-2 justify-end mt-6">
						<Dialog.CloseTrigger class="btn preset-tonal">
							Cancel
						</Dialog.CloseTrigger>
						<button
							type="submit"
							class="btn preset-filled-primary-500"
							disabled={principalPayment <= 0}
						>
							Apply Update
						</button>
					</footer>
				</form>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
