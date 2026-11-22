<script lang="ts">
	import { Popover } from '@skeletonlabs/skeleton-svelte';
	import { IconHelpCircle } from '@tabler/icons-svelte';
	import type { Localized } from '$lib/help/content';

	interface Props {
		/** Help text (from $lib/help/content); the English text is shown */
		text: Localized;
		label?: string;
	}

	let { text, label = 'What is this?' }: Props = $props();
	let open = $state(false);
</script>

<span class="help-tip">
	<Popover
		{open}
		onOpenChange={(e: any) => (open = e.open)}
		positioning={{ placement: 'top' }}
		zIndex="40"
		arrow
		triggerBase="help-tip-trigger"
		triggerAriaLabel={label}
		contentBase="help-tip-card"
		arrowBase="help-tip-arrow"
	>
		{#snippet trigger()}
			<IconHelpCircle />
		{/snippet}
		{#snippet content()}
			<p>{text}</p>
		{/snippet}
	</Popover>
</span>
