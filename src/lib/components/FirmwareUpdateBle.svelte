<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { cfg_cmd_ota_abort, cfg_cmd_ota_end, cfg_cmd_ota_start, mtu } from '$lib/constants';
	import { device, deviceConfig, isFullyInitialized } from '$lib/stores';
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { toaster, getService, getCharacteristic } from '$lib/utilities';
	import { brand } from '$lib/brand';
	import { IconUpload, IconX, IconBluetooth } from '@tabler/icons-svelte';
	import ActivityProgress from './ActivityProgress.svelte';

	/**
	 * Bluetooth (BLE) OTA update: keeps the upstream BlueRetro write flow,
	 * only the UI is restyled after the marketing site, and the Connect Device
	 * entry lives here (update pages hide the global Select Device bar).
	 *
	 * Firmware can come from the site-bundled manifest (generated at build time
	 * by tools/sync-firmware.mjs) or from a local .bin picked by hand — on phones
	 * that is the only route, so the built-in manifest matters especially there.
	 */

	let isDoingSomething = $state(false);
	let isConnecting = $state(false);
	let progress = $state(0);
	let isCanceling = false;
	let files: FileList | undefined = $state();

	/** Firmware picked from the site manifest */
	let siteFile: File | undefined = $state();
	let siteName = $state('');
	let pickName = $state('');
	let siteList: { name: string; size: number; label: string; meta: string; target?: string; date?: string; version?: string }[] =
		$state([]);

	/** Note about the auto-matched model (shown under the device row) */
	let autoNote = $state('');
	let needsChoice = $state(false);

	/** Newest manifest entry for the same model */
	const newestOf = (target?: string) => {
		const pool = siteList.filter((i) => (target ? i.target === target : true));
		if (!pool.length) return undefined;
		return pool
			.slice()
			.sort((a, b) => {
				const da = String(a.date ?? '');
				const db = String(b.date ?? '');
				if (da !== db) return da < db ? 1 : -1;
				return String(a.version ?? '') < String(b.version ?? '') ? 1 : -1;
			})[0];
	};

	/** Whether the current selection is the latest build for that model */
	let isLatest = $derived.by(() => {
		const cur = siteList.find((i) => i.name === siteName);
		if (!cur) return false;
		const newest = newestOf(cur.target);
		return !!newest && newest.name === siteName;
	});

	onMount(async () => {
		try {
			const res = await fetch(`${base}/ota/index.json`, { cache: 'no-store' });
			if (res.ok) {
				const list = await res.json();
				if (Array.isArray(list)) siteList = list;
			}
		} catch (error) {
			// Without a manifest (or when offline) only manual file picking works
			console.log('no built-in firmware list', error);
		}

		// If the last USB session identified a model, preselect by it so the user
		// does not have to wait for a connection
		const remembered = rememberedModel();
		const newest = remembered ? newestOf(remembered) : undefined;
		if (newest) {
			pickName = newest.name;
			pickSiteFile(newest);
		}
	});

	/**
	 * Guess the model from the version / name the device reports.
	 * Note: our firmware reports version "1" and name "BlueRetro" in the app
	 * descriptor, and BLE exposes only those two, so the model usually cannot be
	 * guessed; when it cannot, fall back to the last USB identification.
	 */
	const guessModel = (version?: string, name?: string) => {
		const text = `${version ?? ''} ${name ?? ''}`.toUpperCase();
		if (!text.trim()) return '';
		if (text.includes('N64')) return 'N64';
		if (text.includes('NGC') || text.includes('GAMECUBE') || text.includes('GAME CUBE')) return 'NGC';
		if (text.includes('PS12') || text.includes('PS1') || text.includes('PS2') || text.includes('PLAYSTATION'))
			return 'PS12';
		return '';
	};

	const rememberedModel = () => {
		try {
			return localStorage.getItem('brfw.deviceModel') || '';
		} catch {
			return '';
		}
	};

	/** Remember the model for this receiver (keyed by Bluetooth address) so the next connection auto-selects it */
	const saveModel = (target?: string) => {
		if (!target) return;
		try {
			const addr = $deviceConfig?.bluetoothAddress;
			if (addr) localStorage.setItem(`brfw.model.${addr}`, target);
			if (addr) localStorage.setItem('brfw.deviceModel', target);
		} catch {
			/* localStorage may be unavailable in private mode */
		}
	};

	/** Model resolution order: device self-report → record for this device → last USB identification */
	const resolveModel = () => {
		const cfg = $deviceConfig;
		const byKeyword = guessModel(
			cfg?.appVersion,
			[cfg?.appName, $device?.name].filter(Boolean).join(' ')
		);
		if (byKeyword) return byKeyword;
		try {
			const addr = cfg?.bluetoothAddress;
			if (addr) {
				const saved = localStorage.getItem(`brfw.model.${addr}`);
				if (saved) return saved;
			}
		} catch {
			/* ignore */
		}
		return rememberedModel();
	};

	/** Once connected, auto-select the newest firmware for that model; if the model cannot be identified, ask the user to pick once */
	const autoSelect = async () => {
		if (!siteList.length || !$deviceConfig) return;
		const model = resolveModel();
		const newest = model ? newestOf(model) : undefined;
		if (!newest) {
			needsChoice = true;
			autoNote = '';
			return;
		}
		needsChoice = false;
		autoNote = newest.label;
		pickName = newest.name;
		await pickSiteFile(newest);
	};

	// Auto-select once per newly connected device (deduplicated by Bluetooth address so it does not retrigger)
	let lastAuto = '';
	$effect(() => {
		const cfg = $deviceConfig;
		if (!cfg || !siteList.length) return;
		const key = cfg.bluetoothAddress ?? 'device';
		if (lastAuto === key) return;
		lastAuto = key;
		autoSelect();
	});

	// Clear the note on disconnect so no "selected for this device" text lingers
	$effect(() => {
		if (!$deviceConfig) {
			lastAuto = '';
			autoNote = '';
			needsChoice = false;
		}
	});

	const pickSiteFile = async (item: { name: string; label: string }) => {
		try {
			const res = await fetch(`${base}/ota/${encodeURIComponent(item.name)}`, {
				cache: 'no-store'
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			siteFile = new File([blob], item.name, { type: 'application/octet-stream' });
			siteName = item.name;
			files = undefined;
		} catch (error) {
			console.error('load built-in firmware failed', error);
			toaster.error({ title: 'Could not load that firmware file' });
			pickName = '';
		}
	};

	let isHw2 = $derived(
		($deviceConfig?.appVersion?.includes('hw2') ?? false) ||
			($deviceConfig?.appName?.includes('hw2') ?? false)
	);

	const connect = async () => {
		isConnecting = true;
		try {
			await getService(0, { isCanceled: false });
			toaster.success({ title: `Connected to the ${brand.product}` });
		} catch (error) {
			console.error('Bluetooth connect failed', error);
			toaster.error({ title: `Could not connect to the ${brand.product}` });
		} finally {
			isConnecting = false;
		}
	};

	const otaWriteFwRecursive = async (
		chrc: BluetoothRemoteGATTCharacteristic,
		data: ArrayBuffer,
		offset: number
	) => {
		if (isCanceling) {
			isCanceling = false;
			isDoingSomething = false;
			throw new Error('Cancelled');
		}
		progress = Math.round((offset / data.byteLength) * 100);
		var tmpViewSize = data.byteLength - offset;
		if (tmpViewSize > mtu) {
			tmpViewSize = mtu;
		}
		var tmpView = new DataView(data, offset, tmpViewSize);
		await chrc.writeValue(tmpView);
		offset += Number(mtu);
		if (offset < data.byteLength) {
			await otaWriteFwRecursive(chrc, data, offset);
		}
	};

	const otaWriteFirmware = async (
		service: BluetoothRemoteGATTService,
		data: ArrayBuffer
	): Promise<boolean> => {
		const cmd = new Uint8Array([cfg_cmd_ota_start]);
		let characteristics: BluetoothRemoteGATTCharacteristic | undefined = undefined;

		try {
			characteristics = await getCharacteristic(service, 7);
			characteristics.writeValue(cmd);
			const chrc = await getCharacteristic(service, 8);
			await otaWriteFwRecursive(chrc, data, 0);
			cmd[0] = cfg_cmd_ota_end;
			await characteristics.writeValue(cmd);

			return true;
		} catch (e) {
			cmd[0] = cfg_cmd_ota_abort;
			characteristics?.writeValue(cmd);
			return false;
		}
	};

	const fmtSize = (n: number) => (n / 1048576).toFixed(2) + ' MB';

	const clearPicked = () => {
		siteFile = undefined;
		siteName = '';
		pickName = '';
	};

	const onPickChange = async (name: string) => {
		pickName = name;
		if (!name) {
			clearPicked();
			return;
		}
		const item = siteList.find((i) => i.name === name);
		if (item) {
			// A connected device remembers this pick as its model
			if ($deviceConfig) {
				saveModel(item.target);
				autoNote = item.label;
				needsChoice = false;
			}
			await pickSiteFile(item);
		}
	};

	const onWriteClick = async () => {
		const target = siteFile ?? files?.[0];
		if (target) {
			try {
				// BLE OTA can only write app images: a full image (bootloader + partition
				// table + app) written here would brick the device
				const head = new Uint8Array(await target.slice(0, 0x40).arrayBuffer());
				const view = new DataView(head.buffer);
				const looksAppImage = head[0] === 0xe9 && head.length >= 0x24 && view.getUint32(0x20, true) === 0xabcd5432;
				if (!looksAppImage) {
					toaster.error({
						title: 'That file is a full flash image',
						description: 'Bluetooth update needs the app-only .bin. Use USB Update for full images.'
					});
					isDoingSomething = false;
					progress = 0;
					return;
				}
				isDoingSomething = true;
				const serv = await getService();
				const reader = new FileReader();
				reader.onabort = (_) => {
					console.log('File read cancelled');
				};
				reader.onload = async (_) => {
					if (reader.result) {
						var decoder = new TextDecoder('utf-8');
						var header = decoder.decode(reader.result.slice(0, 256) as ArrayBuffer);
						let isNewFirmwareFileHw2 = header.indexOf('hw2') != -1;
						if (isHw2 == isNewFirmwareFileHw2) {
							var success = await otaWriteFirmware(serv, reader.result as ArrayBuffer);

							if (success) {
								toaster.success({ title: 'Success updating firmware' });
							} else {
								toaster.error({ title: 'There was an error updating the firmware!' });
							}

							device.set(undefined);
						} else {
							toaster.error({ title: 'Hardware and firmware mismatch!' });
						}
					}

					isDoingSomething = false;
					progress = 0;
					$device?.gatt?.disconnect();
					device.set(undefined);
					deviceConfig.set(undefined);
				};

				// Read in the image file as a binary string.
				reader.readAsArrayBuffer(target);
			} catch {
				toaster.error({ title: 'There was an error updating the firmware!' });
				isDoingSomething = false;
				progress = 0;
			}
		}
	};

	const cancelClick = () => {
		isCanceling = true;
	};

	const onFileChange = (details: any) => {
		files = details.acceptedFiles;
		clearPicked();
	};

	const removeFile = () => {
		files = undefined;
	};
</script>

<div class="ble-panel">
	<div class="ble-head">
		<IconBluetooth class="size-5 text-primary-500" />
		<h2 class="ble-title">Wireless update over Bluetooth</h2>

		{#if $deviceConfig && $device}
			<span class="ble-chip">
				<span class="ble-dot"></span>
				{$device.name || 'Receiver'}
				{#if $deviceConfig.appVersion && $deviceConfig.appVersion !== '1'}
					&nbsp;·&nbsp;{$deviceConfig.appVersion}
				{/if}
			</span>
		{/if}
	</div>

	<p class="ble-sub">
		Send a firmware <code>.bin</code> to the receiver over Bluetooth — no USB cable needed. The
		receiver restarts once when writing finishes.
	</p>

	{#if !$deviceConfig || !$device}
		<div class="ble-connect">
			<button class="btn preset-filled-primary-500" onclick={connect} disabled={isConnecting}>
				{isConnecting ? 'Connecting…' : 'Connect over Bluetooth'}
			</button>
			<span class="ble-hint">Chrome or Edge · the browser asks for Bluetooth permission</span>
		</div>
	{/if}

	{#if siteList.length}
		<div class="ble-fwlist">
			<select
				class="ble-fwselect"
				bind:value={pickName}
				onchange={(event) => onPickChange(event.currentTarget.value)}
				disabled={isDoingSomething}
				aria-label="Built-in firmware"
			>
				<option value="">Choose from the built-in list…</option>
				{#each siteList as item (item.name)}
					<option value={item.name}>{item.label} — {item.meta}</option>
				{/each}
			</select>
			{#if autoNote}
				<p class="ble-auto">Selected for this receiver: <b>{autoNote}</b></p>
			{:else if needsChoice}
				<p class="ble-auto">
					Pick the firmware for this receiver once — it will be remembered next time.
				</p>
			{/if}
		</div>
	{/if}

		<div class="ble-row">
			<div class="ble-file">
				{#if siteName}
					<span class="ble-filename">{siteName}</span>
					{#if isLatest}<span class="ble-latest">✓ Latest version</span>{/if}
					<button
						onclick={clearPicked}
						class="btn btn-icon"
						disabled={isDoingSomething}
						aria-label="Clear selected firmware"
					>
						<IconX class="size-4" />
					</button>
				{:else if files?.length}
					<span class="ble-filename">{files[0].name}</span>
					<button
						onclick={removeFile}
						class="btn btn-icon"
						disabled={isDoingSomething}
						aria-label="Remove selected firmware"
					>
						<IconX class="size-4" />
					</button>
				{:else if !siteList.length}
					<FileUpload
						name="files"
						onFileChange={onFileChange}
						maxFiles={1}
						disabled={isDoingSomething || !$device}
					>
						<button class="btn preset-tonal-tertiary">
							<IconUpload class="size-4" />
							<span>Select firmware .bin</span>
						</button>
					</FileUpload>
				{/if}
			</div>

			<button
				onclick={onWriteClick}
				class="btn preset-filled-primary-500"
				disabled={!$isFullyInitialized || isDoingSomething || !$device || !(siteFile || files?.length)}
			>
				Write
			</button>
		</div>

	<ActivityProgress
		max={100}
		onCancelClick={cancelClick}
		{progress}
		{isDoingSomething}
		labelText="Updating…"
	/>

	<!-- Placement note mirroring the USB panel -->
	<p class="ble-why">
		<b>Why Bluetooth?</b> No cable and no driver — handy when the receiver is already paired and you
		just want to push a new build. The transfer runs through the receiver's own firmware, so if it
		will not start or pair, use the <a class="anchor" href="{base}/system/update">USB Update</a> page
		instead.
	</p>
</div>
