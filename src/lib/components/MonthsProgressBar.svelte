<script lang="ts">
	import { Progress } from '@skeletonlabs/skeleton-svelte';

	type Props = {
		monthsElapsed: number;
		totalMonths: number;
		progress: number;
		noCard?: boolean;
	};

	let { monthsElapsed, totalMonths, progress, noCard = false }: Props = $props();
</script>

{#if noCard}
	<div>
		<h3 class="h4 mb-4">Months Progress</h3>
		<Progress value={progress} min={0} max={100}>
			<Progress.Label class="sr-only">Months Progress</Progress.Label>
			<Progress.Track class="h-4">
				<Progress.Range class="bg-primary-500" />
			</Progress.Track>
		</Progress>
		<div class="mt-2 text-sm text-surface-600-300">
			{monthsElapsed} of {totalMonths} months ({progress.toFixed(1)}%)
		</div>
	</div>
{:else}
	<div class="card preset-filled-neutral p-6">
		<h3 class="h4 mb-4">Months Progress</h3>
		<Progress value={progress} min={0} max={100}>
			<Progress.Label class="sr-only">Months Progress</Progress.Label>
			<Progress.Track class="h-4">
				<Progress.Range class="bg-primary-500" />
			</Progress.Track>
		</Progress>
		<div class="mt-2 text-sm text-surface-600-300">
			{monthsElapsed} of {totalMonths} months ({progress.toFixed(1)}%)
		</div>
	</div>
{/if}
