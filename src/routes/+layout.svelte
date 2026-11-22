<script lang="ts">
	import '../app.css';
	import { Toaster, Modal } from '@skeletonlabs/skeleton-svelte';
	import { IconBrandGithub, IconMenu2, IconBluetoothConnected } from '@tabler/icons-svelte';
	import { deviceConfig, device, service } from '$lib/stores';
	import { NavigationMenu, ActivityProgress } from '$lib/components';
	import { getService, toaster } from '$lib/utilities';
	import { brand } from '$lib/brand';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// Firmware update pages (USB / OTA) use the connect button in the serial or BLE panel; guide pages are pure docs
	let isUpdatePage = $derived(
		page.url.pathname.includes('/system/update') || page.url.pathname.includes('/system/ota')
	);
	let isGuidePage = $derived(page.url.pathname.includes('/guide'));

	let isGettingService = $state(false);
	let isDrawerOpen = $state(false);
	let isConnectedModalOpen = $state(false);
	let isIntentionallyDisconnecting = $state(false);
	let cancellationToken: ICancellationToken = $state({ isCanceled: false })

	const unselectDevice = () => {
		if ($device?.gatt?.connected) {
			$device.gatt.disconnect();
		}
		device.set(undefined);
		deviceConfig.set(undefined);
		service.set(undefined);
	};

	const initializeDevice = async () => {
		isGettingService = true;
		try {
			await getService(0, cancellationToken);
			if(!cancellationToken.isCanceled) {
				toaster.success({ title: `Connected to the ${brand.product}` });
			}
			
			isGettingService = false;
		} catch (error) {
			console.log('Error initializing device', error);
			if(!cancellationToken.isCanceled) {
				toaster.error({ title: `Could not connect to the ${brand.product}` });
			}
			isGettingService = false;
		}
	};

	const onMenuClick = () => {
		isDrawerOpen = true;
	};

	const onSwitchDeviceClick = async () => {
		isIntentionallyDisconnecting = true;
		cancellationToken.isCanceled = false;
		unselectDevice();
		await initializeDevice();
		isConnectedModalOpen = false;
	};

	const onDisconnectClick = async () => {
		isIntentionallyDisconnecting = true;
		cancellationToken.isCanceled = false;
		unselectDevice();
		isConnectedModalOpen = false;
	};

	/**
	 * Disconnect handling.
	 * The previous version had two problems:
	 *   1) the $effect attached a listener without a cleanup function → every
	 *      connection-state change attached another one, so on disconnect N
	 *      listeners reconnected at once and hammered the adapter into a
	 *      "can never connect again" state;
	 *   2) it reconnected immediately, giving the peripheral no time to advertise again.
	 * Now: the listeners are added and removed by $effect itself, a drop retries
	 * once only, and on failure the user reconnects by hand.
	 */
	let reconnectAttempts = 0;

	const onDisconnectedListener = async () => {
		if (isIntentionallyDisconnecting) {
			isIntentionallyDisconnecting = false;
			reconnectAttempts = 0;
			return;
		}

		deviceConfig.set(undefined);
		service.set(undefined);

		if (reconnectAttempts >= 1) {
			reconnectAttempts = 0;
			device.set(undefined);
			toaster.error({ title: 'Connection lost. Select the device again.' });
			return;
		}

		reconnectAttempts += 1;
		toaster.error({ title: 'Connection lost — reconnecting…' });

		// Give the peripheral a moment to advertise again / drop the old link
		await new Promise((resolve) => setTimeout(resolve, 1200));
		await initializeDevice();
		reconnectAttempts = 0;
	};

	const onConnectCancelClick = () => {
		cancellationToken.isCanceled = true;
		unselectDevice();
		isGettingService = false;
	}

	const onSelectDeviceClick = async () => {
		cancellationToken.isCanceled = false;
		reconnectAttempts = 0;
		await initializeDevice();
	}

	// The listener follows the device: swap it out when the device changes, and
	// remove it on unmount as well
	$effect(() => {
		const dev = $device;
		if (!dev) return;
		dev.addEventListener('gattserverdisconnected', onDisconnectedListener);
		return () => dev.removeEventListener('gattserverdisconnected', onDisconnectedListener);
	});

	// Release the link when the page is closed / navigated away from, don't leave
	// the connection hanging
	onMount(() => {
		const release = () => {
			try {
				const dev = get(device);
				if (dev?.gatt?.connected) dev.gatt.disconnect();
			} catch {
				/* Page is unmounting, failure does not matter */
			}
		};
		window.addEventListener('pagehide', release);
		window.addEventListener('beforeunload', release);
		return () => {
			window.removeEventListener('pagehide', release);
			window.removeEventListener('beforeunload', release);
		};
	});
</script>

<svelte:head>
	<title>{brand.documentTitle}</title>
	<meta name="description" content={brand.documentDescription} />
	<meta property="og:title" content={brand.documentTitle} />
	<meta property="og:description" content={brand.documentDescription} />
	<meta property="og:type" content="website" />
</svelte:head>

<Modal
	open={isDrawerOpen}
	onOpenChange={(e: any) => (isDrawerOpen = e.open)}
	triggerBase="btn preset-tonal"
	contentBase="bg-surface-100-900 p-4 space-y-4 shadow-xl w-64 h-screen"
	positionerJustify="justify-start"
	positionerAlign=""
	positionerPadding=""
	transitionsPositionerIn={{ x: -480, duration: 200 }}
	transitionsPositionerOut={{ x: -480, duration: 200 }}
>
	{#snippet content()}
		<NavigationMenu onItemSelect={() => (isDrawerOpen = false)} />
	{/snippet}
</Modal>
<!-- App Shell -->
<div class="overflow-hidden h-dvh flex flex-col">
	<!-- App Bar -->
	<header class="brandbar">
		<div class="brandbar-left">
			<button class="btn md:hidden" onclick={onMenuClick} aria-label="Open menu">
				<IconMenu2 />
			</button>
			<a class="brand-lockup" href="{base}/" aria-label="{brand.productFull} home">
				<img src="{base}/brand/linkretro-logo.png" alt={brand.name} class="brand-logo" />
				<span class="brand-divider" aria-hidden="true"></span>
				<span class="brand-product">{brand.product} <em>Web Config</em></span>
			</a>
		</div>
		<div class="brandbar-right">
			<a class="brand-help" href="{base}/guide" title="Manual & help">Manual</a>
			<a class="brand-site" href={brand.site} target="_blank" rel="noreferrer">{brand.siteLabel}</a>
			<a
				class="btn-icon"
				href={brand.upstream.repo}
				target="_blank"
				rel="noreferrer"
				title="BlueRetro open-source project by darthcloud"
			>
				<IconBrandGithub />
			</a>
		</div>
	</header>
	<div class="flex flex-row overflow-hidden flex-1">
		<aside
			class="bg-surface-500/5 md:p-4 sticky top-0 w-64 hidden h-full md:block"
		>
			<NavigationMenu />
		</aside>
		<div class="flex-1 flex flex-col max-w-2xl">
			{#if !isUpdatePage && !isGuidePage}
			<div class="p-2 md:p-4 gap-4 flex lg:flex-row flex-col">
				{#if isGettingService}
					<div
						class="flex flex-1 flex-col text-xl font-bold gap-4"
					>
						<div class="flex flex-row justify-center" >
							Connecting...
						</div>
						<ActivityProgress 
							progress={null} 
							onCancelClick={onConnectCancelClick} 
							isDoingSomething={true}
						/>
					</div>
					
				{:else if $deviceConfig && $device}
						<Modal
							open={isConnectedModalOpen}
							onOpenChange={(e: any) => (isConnectedModalOpen = e.open)}
							triggerBase="btn btn preset-tonal border rounded-base border-tertiary-500"
							contentBase="p-4 space-y-4 shadow-xl max-w-screen-sm"
							backdropClasses="backdrop-blur-sm"
						>
							{#snippet trigger()}
								<!-- <button class="btn btn-icon h-10"> -->
								<IconBluetoothConnected class="h-10" />

								<div class="flex flex-col" >
									<div class="flex md:flex-row md:gap-4 flex-col" >
										<div class="flex flex-row gap-1">
											<div class="font-bold"> Connection:</div>
											{$device?.name || '...'} 
										</div>
										<div class="flex flex-row gap-1">
											<div class="font-bold">Version:</div>
											{$deviceConfig?.appVersion || '...'}
										</div>
									</div>
									<div class="flex flex-row gap-1 md:justify-center">
										<div class="font-bold">Address:</div>
										{$deviceConfig?.bluetoothAddress || '...'}
									</div>
								</div>
								<!-- </button> -->
							{/snippet}
							{#snippet content()}
								<div class="card p-4 max-w-sm">
									<div class="grid grid-cols-1 gap-2">
										<button class="btn" onclick={onDisconnectClick}>Disconnect</button>
										<button class="btn" onclick={onSwitchDeviceClick}>Switch Device</button>
									</div>
									<div class="arrow bg-surface-100-900"></div>
								</div>
							{/snippet}
						</Modal>
				{:else}
					<div class="flex-col">
						<div class="flex gap-4 items-center">
							<button type="button" class="btn preset-filled-primary-500" onclick={onSelectDeviceClick}>
								Select Device
							</button>
						</div>

						<p class="text-sm">Disconnect all controllers from the {brand.product} before connecting.</p>
					</div>
				{/if}
			</div>
			{/if}

			<div class="lr-page-scroll p-2 md:p-4 flex flex-col gap-4 max-w-2xl overflow-auto flex-1">
				{@render children?.()}
			</div>
		</div>
	</div>
	<!-- Page Route Content -->
</div>

<Toaster {toaster}></Toaster>
