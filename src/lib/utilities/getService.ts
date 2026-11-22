import { brUuid, maxConnectRetries } from '$lib/constants';
import { device, deviceConfig, service } from '$lib/stores';
import { get } from 'svelte/store';
import { getDevice } from './getDevice';
import { getDeviceConfiguration } from './getConfiguration';

/**
 * Connection retry policy: leave a little time between two attempts.
 * The earlier implementation recursed immediately on failure, firing 5 `gatt.connect()`
 * calls within tens of milliseconds; the Windows Bluetooth stack easily gets slammed
 * into a "can never connect again" state by that burst (only a device restart recovers).
 */
const RETRY_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getGattService = async (
	dev: BluetoothDevice,
	retry: number = 0,
	cancellationToken?: ICancellationToken
): Promise<BluetoothRemoteGATTService | undefined> => {
	if (retry >= maxConnectRetries || cancellationToken?.isCanceled) return undefined;

	try {
		if (!dev.gatt?.connected) {
			console.log('Connecting to GATT Server...');
			await dev.gatt?.connect();
		}
		if (dev.gatt?.connected && !cancellationToken?.isCanceled) {
			console.log('Getting BlueRetro Service...');
			return await dev.gatt.getPrimaryService(brUuid[0]);
		}
	} catch (error) {
		console.log('error connecting to gat service', error);
	}

	if (cancellationToken?.isCanceled) return undefined;

	await sleep(RETRY_DELAY_MS);
	return getGattService(dev, retry + 1, cancellationToken);
};

const getService = async (
	retry: number = 0,
	cancellationToken?: ICancellationToken
): Promise<BluetoothRemoteGATTService> => {
	let dev: BluetoothDevice | undefined;

	if (retry >= maxConnectRetries || cancellationToken?.isCanceled) {
		// Hard failure: clear the device too, otherwise the next click reuses this
		// unreachable device and even the chooser never opens (users just see
		// "the page cannot detect the device").
		deviceConfig.set(undefined);
		service.set(undefined);
		if (!cancellationToken?.isCanceled) device.set(undefined);
		throw new Error(cancellationToken?.isCanceled ? 'Canceled' : 'Max connection retries exceeded');
	}

	try {
		dev = get(device);
		if (!dev) {
			console.log('Getting device');
			dev = await getDevice();
			device.set(dev);
		}

		if (!dev.gatt) throw new Error('Unable to get GATT server');

		const cached = get(service);
		if (cached && dev.gatt.connected) {
			return cached;
		}

		// New session: the previous link may still be hanging around, so disconnect
		// cleanly once before reconnecting; otherwise connect() hits "old connection
		// still held" and the whole device becomes unreachable afterwards.
		if (dev.gatt.connected && !cached) {
			try {
				console.log('Releasing stale GATT link before reconnecting...');
				dev.gatt.disconnect();
				await sleep(200);
			} catch (error) {
				console.log('stale disconnect failed (ignored)', error);
			}
		}

		const serv = await getGattService(dev, 0, cancellationToken);
		if (!serv) throw new Error('Unable to connect to the GATT service');

		const config = await getDeviceConfiguration(serv);
		deviceConfig.set(config);
		service.set(serv);
		return serv;
	} catch (error) {
		console.log('error getting service', error);
		if (cancellationToken?.isCanceled) throw new Error('Canceled');
		await sleep(RETRY_DELAY_MS);
		return getService(retry + 1, cancellationToken);
	}
};

export { getService };
