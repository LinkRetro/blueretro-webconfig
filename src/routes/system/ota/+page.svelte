<script lang="ts">
	import { onMount } from 'svelte';
	import { brand } from '$lib/brand';
	import { device, deviceConfig, service } from '$lib/stores';
	import FirmwareUpdateBle from '$lib/components/FirmwareUpdateBle.svelte';
	import { PageGuide } from '$lib/components';

	// Debug hook: with /system/ota?debug=1 a "device connected" state can be simulated
	// without hardware, to verify the BLE page's auto-selection / model memory logic
	onMount(() => {
		if (!new URLSearchParams(location.search).has('debug')) return;
		(window as unknown as Record<string, unknown>).__updateTest = {
			connectFake: (name = 'BlueRetro', version = '1', address = 'AA:BB:CC:DD:EE:FF') => {
				device.set({
					name,
					gatt: { connected: true },
					addEventListener: () => {},
					removeEventListener: () => {}
				} as unknown as BluetoothDevice);
				deviceConfig.set({ bluetoothAddress: address, appVersion: version });
			},
			release: () => {
				device.set(undefined);
				deviceConfig.set(undefined);
				service.set(undefined);
			}
		};
	});
</script>

<svelte:head>
	<title>OTA update · {brand.documentTitle}</title>
</svelte:head>

<!--
  OTA update (Bluetooth): the upstream BlueRetro BLE OTA flow, the panel carries
  its own connect button.
  On phones / tablets this is the only route (browsers have no Web Serial), and
  desktops can use it too.
  Recovery flashing over a USB cable lives at /system/update.
-->
<div class="update-page">
	<PageGuide />
	<FirmwareUpdateBle />
</div>
