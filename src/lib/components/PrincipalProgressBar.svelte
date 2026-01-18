<script lang="ts">
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { formatCurrency } from '$lib/utils/formatting';

	type Props = {
		principalPaid: number;
		originalLoan: number;
		progress: number;
		currencySymbol: string;
		noCard?: boolean;
	};

	let { principalPaid, originalLoan, progress, currencySymbol, noCard = false }: Props = $props();
</script>

{#if noCard}
	<div>
		<h3 class="h4 mb-4">Principal Paid</h3>
		<Progress value={progress} min={0} max={100}>
			<Progress.Label class="sr-only">Principal Paid Progress</Progress.Label>
			<Progress.Track class="h-4">
				<Progress.Range class="bg-secondary-500" />
			</Progress.Track>
		</Progress>
		<div class="mt-2 text-sm text-surface-600-300">
			{formatCurrency(principalPaid, currencySymbol)} of {formatCurrency(originalLoan, currencySymbol)} ({progress.toFixed(1)}%)
		</div>
	</div>
{:else}
	<div class="card preset-filled-neutral p-6">
		<h3 class="h4 mb-4">Principal Paid</h3>
		<Progress value={progress} min={0} max={100}>
			<Progress.Label class="sr-only">Principal Paid Progress</Progress.Label>
			<Progress.Track class="h-4">
				<Progress.Range class="bg-secondary-500" />
			</Progress.Track>
		</Progress>
		<div class="mt-2 text-sm text-surface-600-300">
			{formatCurrency(principalPaid, currencySymbol)} of {formatCurrency(originalLoan, currencySymbol)} ({progress.toFixed(1)}%)
		</div>
	</div>
{/if}
