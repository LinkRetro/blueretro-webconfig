<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { brand } from '$lib/brand';
	import { PageGuide } from '$lib/components';

	/**
	 * USB update (Web Serial). Without navigator.serial in the browser this cannot
	 * work (Chrome, Safari and Firefox on phones / tablets all lack it), so instead
	 * of rendering a dead updater we show a card pointing people at the OTA route.
	 * Detection: a capability check plus touch pointer / narrow viewport count as mobile.
	 */
	let canUsb = $state(false);
	let checked = $state(false);

	onMount(() => {
		const coarse = window.matchMedia('(pointer: coarse)');
		const narrow = window.matchMedia('(max-width: 767px)');

		const sync = () => {
			const isMobile = coarse.matches || narrow.matches;
			canUsb = 'serial' in navigator && !isMobile;
			checked = true;
		};

		sync();
		coarse.addEventListener('change', sync);
		narrow.addEventListener('change', sync);
		return () => {
			coarse.removeEventListener('change', sync);
			narrow.removeEventListener('change', sync);
		};
	});
</script>

<svelte:head>
	<title>USB update · {brand.documentTitle}</title>
</svelte:head>

<!--
  USB update: embeds the standalone flasher from static/updater (WebSerial + esptool-js),
  which uses ROM download mode and can unbrick. OTA (Bluetooth) has its own page: /system/ota.
-->
<div class="update-page">
	<PageGuide />

	{#if !checked}
		<!-- Render nothing before mount, so phones don't pull the 800px updater first -->
		<div class="update-loading"></div>
	{:else if canUsb}
		<div class="updater-wrap">
			<iframe
				class="updater-frame"
				title="Firmware update over USB"
				src="{base}/updater/index.html?embed=1"
				allow="serial; usb"
			></iframe>
		</div>
	{:else}
		<div class="usb-fallback">
			<p class="usb-fallback-kicker">Web Serial unavailable</p>
			<h2>USB update needs a desktop browser</h2>
			<p>
				This browser cannot talk to a serial port, so the cable route is not available here —
				that includes phones, tablets, Safari and Firefox. Chrome or Edge on a desktop works.
			</p>
			<p>
				If the receiver still pairs over Bluetooth, use the
				<a class="anchor" href="{base}/system/ota">OTA update</a> page instead — it flashes the same
				firmware wirelessly.
			</p>
			<a class="btn preset-filled-primary-500" href="{base}/system/ota">Go to OTA Update</a>
		</div>
	{/if}
</div>
