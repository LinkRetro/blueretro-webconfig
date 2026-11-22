/**
 * Brand layer: product name, public links and Bluetooth advertising name all come from here.
 *
 * To switch customers or product models later, changing this one file rebrands the
 * whole site; other pages should never hardcode "BlueRetro" / "LinkRetro".
 */
export const brand = {
	/** Brand name shown in the wordmark */
	name: 'LinkRetro',
	site: 'https://www.linkretro.com',
	siteLabel: 'LINKRETRO.COM',

	/** Product name: used in page titles and messages */
	product: 'Wireless Receiver',
	productFull: 'LinkRetro Wireless Receiver',

	documentTitle: 'LinkRetro Wireless Receiver · Web Config',
	documentDescription:
		'Configure the LinkRetro wireless receiver in your browser over Bluetooth: button mapping, controller options, memory cards and firmware update.',

	/**
	 * Prefix of the firmware's Bluetooth advertising name.
	 * If the name is changed in the firmware, this must change too, otherwise the
	 * browser's device chooser will not find the receiver.
	 */
	bleNamePrefix: 'BlueRetro',

	/** Open-source attribution — required by Apache-2.0, do not remove */
	upstream: {
		name: 'BlueRetro',
		author: 'darthcloud',
		repo: 'https://github.com/darthcloud/BlueRetro',
		license: 'Apache-2.0'
	}
} as const;
