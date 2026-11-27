<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { IconBluetooth, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-svelte';

	interface Props {
		/** Compact variant for pages that already have their own connect panel (OTA). */
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	let supported = $state<boolean | null>(null);
	let open = $state(true);

	onMount(() => {
		supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
		try {
			open = localStorage.getItem('lr-bt-help-collapsed') !== '1';
		} catch {
			/* localStorage may be unavailable in private mode */
		}
	});

	const toggle = () => {
		open = !open;
		try {
			localStorage.setItem('lr-bt-help-collapsed', open ? '0' : '1');
		} catch {
			/* ignore */
		}
	};
</script>

<section class="bt-help" class:bt-help-compact={compact} aria-labelledby="bt-help-title">
	<div class="bt-help-head">
		<span class="bt-help-icon" aria-hidden="true"><IconBluetooth class="size-5" /></span>
		<div class="bt-help-copy">
			<h2 id="bt-help-title">Bluetooth is required</h2>
			<p class="bt-help-lead">
				This page configures the receiver over Bluetooth.
				<strong>A computer without Bluetooth cannot connect to it.</strong>
			</p>
		</div>
		{#if supported !== null}
			<span class="bt-status" class:bt-status-ok={supported} class:bt-status-bad={!supported}>
				{#if supported}
					<IconCircleCheck class="size-4" aria-hidden="true" /> Web Bluetooth available
				{:else}
					<IconAlertTriangle class="size-4" aria-hidden="true" /> Web Bluetooth not available
				{/if}
			</span>
		{/if}
		{#if !compact}
			<button class="bt-toggle" type="button" onclick={toggle} aria-expanded={open}>
				{open ? 'Hide' : 'Show'}
			</button>
		{/if}
	</div>

	{#if compact}
		<p class="bt-help-line">
			Use Chrome or Edge on a device with Bluetooth. <a href="{base}/guide">How to connect →</a>
		</p>
	{:else if open}
		<ol class="bt-steps">
			<li>
				<b>Check the computer.</b> It needs Bluetooth: built in, or a USB Bluetooth adapter on
				desktops without it.
			</li>
			<li>
				<b>Use Chrome or Edge</b> — desktop or Android. Safari on iPhone / iPad has no Web
				Bluetooth and cannot open the receiver.
			</li>
			<li>
				<b>Turn Bluetooth on</b> in the system settings (Windows: Settings → Bluetooth &amp;
				devices; macOS: Control Centre) and allow the browser prompt when it appears.
			</li>
			<li>
				<b>Prepare the receiver:</b> power it, unplug any controllers, and press the pairing
				button until the LED blinks.
			</li>
			<li>
				<b>Click Select Device</b> and pick the entry starting with <code>BlueRetro_</code>.
			</li>
		</ol>
		<p class="bt-help-foot">
			Still empty? Close other apps that use Bluetooth, move closer, reload the page and try
			again. <a href="{base}/guide">Read the full guide</a>
		</p>
		{#if supported === false}
			<p class="bt-help-blocked">
				This browser or device does not expose Web Bluetooth, so the Select Device button
				cannot find the receiver. Open this page in Chrome or Edge on a computer with
				Bluetooth (or Chrome on Android).
			</p>
		{/if}
	{/if}
</section>
