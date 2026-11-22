import { cfg_cmd_get_fw_name } from "$lib/constants";
import type { IDeviceConfig } from "$lib/interfaces";
import { getCharacteristic } from ".";

const getAppVersion = async (service: BluetoothRemoteGATTService) => {
    console.log('Reading App version...');
    const charactristics = await getCharacteristic(service, 9);
    let enc = new TextDecoder('utf-8');
    let app_ver = enc.decode(await charactristics.readValue());
    console.log('App Version: ', app_ver);
    return app_ver;
};

const getAppName = async (service: BluetoothRemoteGATTService, command: number) => {
    console.log('Reading App Name...');
    var cmd = new Uint8Array(1);
    var cmd_chrc = await getCharacteristic(service, 7);
    cmd[0] = command;
    await cmd_chrc.writeValue(cmd);
    const dataview = await cmd_chrc.readValue();
    let enc = new TextDecoder('utf-8');
    let commandString = enc.decode(dataview);
    console.log('App Name: ', commandString);
    return commandString;
};

const getBdAddr = async (service: BluetoothRemoteGATTService) => {
    console.log('Reading Bluetooth Address...');
    const charactristics = await getCharacteristic(service, 12);
    const dataview = await charactristics.readValue();
    let address =
        dataview.getUint8(5).toString(16).padStart(2, '0') +
        ':' +
        dataview.getUint8(4).toString(16).padStart(2, '0') +
        ':' +
        dataview.getUint8(3).toString(16).padStart(2, '0') +
        ':' +
        dataview.getUint8(2).toString(16).padStart(2, '0') +
        ':' +
        dataview.getUint8(1).toString(16).padStart(2, '0') +
        ':' +
        dataview.getUint8(0).toString(16).padStart(2, '0');
    console.log('Bluetooth Address: ', address);
    return address;
};

const getDeviceConfiguration = async (s: BluetoothRemoteGATTService) => {
    const bluetoothAddress = await getBdAddr(s);
    const appVersion = await getAppVersion(s);

    const config: IDeviceConfig = {
        bluetoothAddress,
        appVersion
    };
    // Upstream only reads the name when the version starts with v and is not v1.8.
    // Our firmware reports version "1" (no v), so by upstream rules appName would
    // never be read — yet the name may carry the model, and the BLE page relies on
    // it to auto-select firmware, so always attempt one read here.
    try {
        config.appName = await getAppName(s, cfg_cmd_get_fw_name);
    } catch (error) {
        console.log('App name unavailable (ignored)', error);
    }
    console.log(
        'Connected to: ' +
        config.appName +
        ' (' +
        config.bluetoothAddress +
        ') [' +
        config.appVersion +
        ']'
    );
    return config;
};

export { getDeviceConfiguration }