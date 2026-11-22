import { brUuid } from "$lib/constants";
import { brand } from "$lib/brand";

const getDevice = async (): Promise<BluetoothDevice> => {
    console.log('Requesting Bluetooth Device...');
    const d = await navigator.bluetooth.requestDevice({
        // The firmware's Bluetooth advertising name; when the product name changes,
        // update bleNamePrefix in $lib/brand.ts as well
        filters: [{ namePrefix: brand.bleNamePrefix }],
        optionalServices: [brUuid[0]]
    });
    return d;
};

export { getDevice }