<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { error } = $props();

	// Extract error message
	const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
	const status = $derived(page.status);
</script>

<div class="min-h-screen py-8 px-4 flex items-center justify-center">
	<div class="max-w-md w-full">
		<div class="card preset-filled-neutral p-8 text-center">
			<div class="mb-6">
				<h1 class="h1 text-error-500 mb-2">Oops!</h1>
				<p class="text-lg text-surface-600 dark:text-surface-400">
					Something went wrong
				</p>
			</div>

			<div class="mb-6 p-4 bg-error-500/10 border border-error-500/20 rounded">
				<p class="text-sm text-error-500 font-mono break-words">
					{errorMessage}
				</p>
				{#if status}
					<p class="text-xs text-surface-500 mt-2">
						Status: {status}
					</p>
				{/if}
			</div>

			<div class="flex flex-col gap-3">
				<button
					onclick={() => goto('/')}
					class="btn preset-filled-primary-500 w-full"
				>
					Return to Home
				</button>
				<button
					onclick={() => window.location.reload()}
					class="btn preset-filled-neutral w-full"
				>
					Reload Page
				</button>
			</div>
		</div>
	</div>
</div>
