<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { docFor } from '$lib/help/content';
	import { IconArrowRight, IconHelpCircle } from '@tabler/icons-svelte';

	/**
	 * Beginner guide at the top of every page: what this page does + three steps to
	 * get started + a link to the full manual.
	 * Copy comes from $lib/help/content (English only for now).
	 * The collapsed state is remembered per page in localStorage.
	 */
	const doc = $derived(docFor(page.route.id));

	let open = $state(true);

	onMount(() => {
		if (!doc) return;
		try {
			open = localStorage.getItem('lr-guide-collapsed:' + doc.id) !== '1';
		} catch {
			/* private mode: keep it open */
		}
	});

	const toggle = () => {
		open = !open;
		if (!doc) return;
		try {
			localStorage.setItem('lr-guide-collapsed:' + doc.id, open ? '0' : '1');
		} catch {
			/* ignore */
		}
	};
</script>

{#if doc}
	<section class="page-guide" class:is-closed={!open}>
		<button type="button" class="page-guide-head" aria-expanded={open} onclick={toggle}>
			<IconHelpCircle class="page-guide-icon" />
			<span class="page-guide-title">How to use this page</span>
			<span class="page-guide-hint">{open ? 'Hide' : 'Show'}</span>
		</button>
		{#if open}
			<div class="page-guide-body">
				<p class="page-guide-summary">{doc.summary}</p>
				<ol class="page-guide-steps">
					{#each doc.steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
				<a class="page-guide-link" href="{base}/guide#{doc.slug}">
					Full manual
					<IconArrowRight class="size-3.5" />
				</a>
			</div>
		{/if}
	</section>
{/if}
