/**
 * Single source of truth for the in-app manual.
 *
 * - `chapters`: concept chapters shown first on /guide
 * - `pages`: one chapter per config page; field help is also reused by the
 *   `?` popovers next to each option
 *
 * Edit copy here only: /guide, the per-page guide block and the field popovers
 * all render from this data.
 */

export type L = string;

export type Chapter = {
	slug: string;
	title: L;
	body: L[];
	note?: L;
};

export type FieldDoc = {
	label: L;
	help: L;
};

export type PageDoc = {
	/** Route id, matching page.route.id, used to find this page automatically. */
	id: string;
	slug: string;
	nav: L;
	title: L;
	summary: L;
	steps: L[];
	fields: Record<string, FieldDoc>;
	tips?: L[];
};

export const chapters: Chapter[] = [
	{
		slug: 'start',
		title: 'Before you start',
		body: [
			'Your LinkRetro receiver turns modern Bluetooth controllers, keyboards and mice into signals an old console understands (PS2, N64, Dreamcast, PS1 and so on). This web tool is where you set it up.',
			'You need Chrome or Edge — desktop or Android. Safari on iPhone / iPad does not support Web Bluetooth, so these pages will not work there.',
			'Disconnect your controllers from the receiver before connecting (let them sleep or turn them off). Otherwise the browser may fail to pair.',
			'Click Select Device in the top bar and pick the device that starts with BlueRetro_. Once connected the button shows the device name and firmware version; click it to see the address or disconnect.',
			'Most fields are greyed out until you connect. That is normal: the settings live on the receiver, so it has to be connected first.'
		]
	},
	{
		slug: 'slots',
		title: 'Inputs and outputs',
		body: [
			'Input means “which player’s controller goes into the receiver”. Output means “which port on the console the receiver is plugged into”.',
			'Single controller, single console port: Input #1 and Output #1. That covers most single-player setups.',
			'You only need other numbers for same-screen multiplayer or a multitap. Getting the number wrong looks like “the controller responds but the console ignores it”.'
		]
	},
	{
		slug: 'layers',
		title: 'Three layers: Global / Console / Game ID',
		body: [
			'The same setting can live in three places: Global (shared by every game), Console (per console), or Game ID (per individual game).',
			'The three buttons at the top of a page choose which layer you are reading and writing. Saving only touches the selected layer.',
			'To work per console or per game: put a game in the console, disconnect the controllers, switch to Console or Game ID and press the refresh button so the receiver can read the console / game ID.',
			'Beginner advice: get one good setup working in Global first, then override only the games that need it.'
		]
	},
	{
		slug: 'remap',
		title: 'Button mapping: presets and custom',
		body: [
			'There are two ways: Presets writes a whole ready-made mapping in one go; Custom lets you edit entries one by one.',
			'One entry is: source button (on your controller) → destination button (what the console receives), plus a few feel parameters.',
			'Max is the value sent when the button is fully pressed; Threshold is the point where it counts as pressed; Deadzone ignores small stick movement near the centre; Turbo repeats the press; Scaling is the stick curve; Diagonal compensates diagonals.',
			'Common fixes: X / O swapped → change Source and Destination in Custom; stick drifting on its own → raise Deadzone; need rapid fire → set Turbo.'
		],
		note: 'Remapping only changes how buttons are interpreted. It does not change which console the receiver pretends to be — that is System on the Global page.'
	},
	{
		slug: 'memory',
		title: 'Memory cards',
		body: [
			'The receiver can act as a virtual memory card: N64 Controller Pak (.MPK), Dreamcast VMU (.BIN) and PS1 memory card (.BIN).',
			'Read saves what is on the card to a file; Write puts a file from your computer back on the card; Format wipes and re-initialises the card.',
			'Writing overwrites whatever is on the card. Do a Read first to keep a backup — then you can always write it back.',
			'These pages have no slot picker: the receiver works on the card it currently sees. If several are attached, leave only one connected while you work.'
		]
	},
	{
		slug: 'firmware',
		title: 'Firmware update',
		body: [
			'Two routes: USB Update (cable, desktop browser) and OTA Update (wireless over Bluetooth, works on phones too).',
			'USB uses the chip’s download mode and can rescue a receiver that no longer connects. OTA is for a receiver that still works and pairs.',
			'OTA only accepts the app-only image; full packages must go over USB. The built-in firmware list on the site is already split by type — just pick from the dropdown.',
			'Do not unplug, close the page or cut power during an update. The receiver restarts by itself when writing finishes.'
		]
	},
	{
		slug: 'system',
		title: 'System pages: Files / Manage / Debug',
		body: [
			'Files lists the configuration files stored on the receiver. You can delete them one by one to free space.',
			'Manage holds system commands: Deep Sleep for low-power sleep, Reset to reboot (keeps settings) and Factory Reset to wipe everything back to defaults.',
			'Debug downloads a trace file. When you report a problem, send that file too — it helps far more than a description.'
		],
		note: 'Factory Reset wipes every mapping and memory-card setting. Make sure you really want that before using it.'
	}
];

export const pages: PageDoc[] = [
	{
		id: '/controller/global',
		slug: 'global',
		nav: 'Global',
		title: 'Global settings',
		summary: 'Decides which console the receiver pretends to be, how many controllers it accepts and which memory-card bank it serves. Start here on a new setup.',
		steps: [
			'Beginners can just use: System = Auto, Multitap = None, Inquiry Mode = Auto, Memory Card Bank = Bank 1.',
			'Press Save at the bottom; nothing changes on the receiver until you do.',
			'If the console shows no picture, first check the video cable is on the receiver output and the receiver has power.'
		],
		fields: {
			system: {
				label: 'System',
				help: 'Which console the receiver emulates. Auto detects it; if you always use one console, leave it on Auto.'
			},
			multitap: {
				label: 'Multitap',
				help: 'Multi-player adapter mode (Slot 1 / Slot 2 / Dual / Alt, depending on the console). Leave it on None unless you need four ports.'
			},
			inquiryMode: {
				label: 'Inquiry Mode',
				help: 'Auto keeps scanning for paired controllers. Manual waits until you press a button on the controller — saves power and avoids accidental connections.'
			},
			bank: {
				label: 'Memory Card Bank',
				help: 'Memory-card bank: switching it is like swapping to another card. Use Bank 1 normally; Debug Mode is for diagnostics only.'
			}
		},
		tips: [
			'A grey Save button means the receiver is not connected yet, or a write is already running.'
		]
	},
	{
		id: '/controller/output',
		slug: 'output',
		nav: 'Output',
		title: 'Output',
		summary: 'Sets what each console-side port looks like to the console, and whether it offers a memory card and rumble.',
		steps: [
			'Single controller: Output # 1, Mode GamePad.',
			'Pick Accessories = Rumble for rumble, Memory for a memory card, or Both for both.',
			'Press Save to apply.'
		],
		fields: {
			output: {
				label: 'Output #',
				help: 'Which console-side port this applies to. Single-port setups use 1; you only change it for a multitap.'
			},
			mode: {
				label: 'Mode',
				help: 'What the port looks like: GamePad, GamePadAlt (alternative layout), Keyboard or Mouse.'
			},
			accessory: {
				label: 'Accessories',
				help: 'Whether this port offers a memory card and/or rumble: None, Memory, Rumble, or Both.'
			}
		},
		tips: [
			'Keyboard/mouse play needs both places: set Mode to Keyboard or Mouse here, then pick a keyboard/mouse preset on the Presets page.'
		]
	},
	{
		id: '/controller/n64',
		slug: 'n64',
		nav: 'N64 Controller Pak',
		title: 'N64 Controller Pak',
		summary: 'Read and write N64 Controller Pak images (.MPK): back one up to your PC, restore one, or wipe it.',
		steps: [
			'Pick Pak 1–4 (four virtual slots).',
			'Press Read first: it saves the card contents to your PC as .MPK.',
			'To restore: choose an .MPK file then Write. To wipe: Format.'
		],
		fields: {
			pak: {
				label: 'Pak',
				help: 'Which Controller Pak slot to work on — the same 1–4 numbering the game shows.'
			},
			read: {
				label: 'Read',
				help: 'Reads the card and downloads it as an .MPK file. Do this before writing, so you have a backup.'
			},
			format: {
				label: 'Format',
				help: 'Wipes and re-initialises the card. Everything on it is lost.',
			},
			file: {
				label: 'Select .MPK file',
				help: 'Choose an .MPK file from your PC, ready to write to the selected slot.',
			},
			write: {
				label: 'Write',
				help: 'Writes the chosen .MPK into the slot. It overwrites what is on the card.'
			}
		},
		tips: [
			'Do not unplug or close the page while reading or writing.',
			'The card is transferred in small blocks over Bluetooth, so the progress bar is slow on purpose — that is normal.'
		]
	},
	{
		id: '/controller/dcvmu',
		slug: 'dcvmu',
		nav: 'DC VMU Manager',
		title: 'DC VMU Manager',
		summary: 'Read and write Dreamcast VMU images (.BIN, 200 blocks): back up saves or restore one from your PC.',
		steps: [
			'Press Read to save the current VMU as a .BIN.',
			'Choose a .BIN file, then Write to put it back.',
			'Always Read first — writing replaces the whole card.'
		],
		fields: {
			read: {
				label: 'Read',
				help: 'Downloads the VMU the receiver currently sees as a .BIN file.'
			},
			file: {
				label: 'Select .BIN file',
				help: 'Pick a VMU image (.BIN) from your PC to write.'
			},
			write: {
				label: 'Write',
				help: 'Writes the chosen .BIN to the VMU, replacing its contents.'
			}
		},
		tips: [
			'There is no slot picker here: the receiver works on the VMU it sees. If you have several, leave only one attached.'
		]
	},
	{
		id: '/controller/ps1mc',
		slug: 'ps1mc',
		nav: 'PS1 Memory Card',
		title: 'PS1 Memory Card',
		summary: 'Read and write PlayStation memory cards (.BIN): export a backup, restore one, or format the card.',
		steps: [
			'Read first to make a backup.',
			'To restore saves: pick a .BIN then Write.',
			'To wipe it: Format (all 15 blocks are cleared).'
		],
		fields: {
			read: {
				label: 'Read',
				help: 'Downloads the current memory card as a .BIN file.'
			},
			format: {
				label: 'Format',
				help: 'Formats the card: every save is erased, only the header remains.'
			},
			file: {
				label: 'Select .BIN file',
				help: 'Pick a PlayStation memory-card image from your PC.'
			},
			write: {
				label: 'Write',
				help: 'Writes the image to the card, replacing its contents.'
			}
		}
	},
	{
		id: '/controller/presets',
		slug: 'presets',
		nav: 'Presets',
		title: 'Presets',
		summary: 'Apply a whole ready-made mapping to one input in a single step instead of editing entries one by one.',
		steps: [
			'Pick the config layer at the top; beginners should use Global.',
			'Choose the controller number under Input #; single player is 1.',
			'Console only filters the list; pick one. Then pick a preset. Beginners: Console = Default, Preset = Default Gamepad only.',
			'Press Save: the whole mapping replaces that input’s current one.'
		],
		fields: {
			layer: {
				label: 'Configuration Options',
				help: 'Which layer to write to: Global (all games), Console (per console) or Game ID (per game). For the last two, put a game in and disconnect controllers, then press refresh.'
			},
			input: {
				label: 'Input #',
				help: 'Which controller this mapping is for. Single player: 1 — match the port you actually use.',
			},
			console: {
				label: 'Console',
				help: 'This only filters the preset list; it does not change where the config is stored. If there is no preset for your console, use Default.'
			},
			preset: {
				label: 'Preset',
				help: 'Which preset to apply. Save stays disabled until you pick one; saving replaces the mapping rather than adding to it.'
			}
		},
		tips: [
			'Presets replaces everything. To change a single button, use Custom instead.',
			'The dropdowns start empty while the preset list loads — give it a second, or reload if it stays empty.'
		]
	},
	{
		id: '/controller/buttons',
		slug: 'buttons',
		nav: 'Custom mapping',
		title: 'Custom mapping',
		summary: 'Edit mappings entry by entry — for fine tuning, fixing one game, or tweaking a few buttons on top of a preset.',
		steps: [
			'Pick the layer and controller number first (beginners: Global, device #1).',
			'Source / Destination choose the device type, which decides the button names available per row.',
			'For each row, set Source (controller button) and Destination (console button).',
			'Press Save Mappings to write; Add Mapping appends an entry.'
		],
		fields: {
			layer: {
				label: 'Configuration Options',
				help: 'Same as on Presets: Global / Console / Game ID picks which layer this page reads and writes.'
			},
			device: {
				label: 'Bluetooth Device #',
				help: 'Which controller this mapping belongs to. Single player: 1.',
			},
			source: {
				label: 'Source',
				help: 'The input device type (gamepad / keyboard / mouse). It decides which source button names each row offers.'
			},
			destination: {
				label: 'Destination',
				help: 'The device type the console side should look like. It decides the destination button names.'
			},
			hide: {
				label: 'Hide mappings not relevant',
				help: 'Shows only entries relevant to the chosen source/destination types. It affects what you see, not what gets saved.'
			},
			save: {
				label: 'Save Mappings',
				help: 'Writes the whole current mapping set to that input on the receiver.'
			},
			add: {
				label: 'Add Mapping',
				help: 'Appends a blank entry; fill in its source and destination buttons.'
			},
			rowSource: {
				label: 'Source button',
				help: 'Which button on your controller triggers this mapping.'
			},
			rowDestination: {
				label: 'Destination button',
				help: 'Which button the console receives — this is where you fix swapped X / O.'
			},
			rowDestinationId: {
				label: 'Destination ID',
				help: 'Which output port this entry goes to in multi-controller setups. Keep 1 for single player.'
			},
			max: {
				label: 'Max',
				help: 'The maximum value sent at full press. Default 100; rarely needs changing.'
			},
			threshold: {
				label: 'Threshold',
				help: 'How far the button must travel to count as pressed. Lower triggers earlier; raise it if a light touch fires by accident.'
			},
			deadzone: {
				label: 'Deadzone',
				help: 'How much movement near the stick centre is ignored. Raise it if the stick drifts; lower it if it feels sluggish.'
			},
			turbo: {
				label: 'Turbo',
				help: 'Holds the button down as repeated presses at a chosen rate; Disable turns it off.'
			},
			scaling: {
				label: 'Scaling',
				help: 'The stick response curve from centre to edge. Linear is the easiest to predict; others suit racing or flight games.'
			},
			diagonal: {
				label: 'Diagonal',
				help: 'Compensates diagonal output when two directions are held — worth trying if special moves drop inputs.'
			}
		},
		tips: [
			'Start from a Preset, then tweak a few entries here. Building a full set from scratch takes a long time.'
		]
	},
	{
		id: '/system/files',
		slug: 'files',
		nav: 'Files',
		title: 'Files',
		summary: 'Configuration files stored on the receiver. Delete them one by one to free space.',
		steps: [
			'Once connected the list loads by itself; recognised games show their name after the file name.',
			'Press the bin icon to delete a file — this cannot be undone.'
		],
		fields: {
			list: {
				label: 'File list',
				help: 'Config and save files on the receiver. The list is empty when nothing is connected — that is normal.'
			},
			delete: {
				label: 'Delete',
				help: 'Deletes the file permanently. If unsure, leave it alone or export a backup first.'
			}
		}
	},
	{
		id: '/system/manage',
		slug: 'manage',
		nav: 'Manage',
		title: 'Manage',
		summary: 'System commands for the receiver: sleep, reboot and factory reset.',
		steps: [
			'You normally do not need this page.',
			'If the receiver stops responding, try Reset — it reboots and keeps your settings.',
			'Only use Factory Reset when nothing else helps; every setting has to be redone afterwards.'
		],
		fields: {
			deepSleep: {
				label: 'Deep Sleep',
				help: 'Puts the receiver into low-power sleep — useful on battery or for long storage. A button press or power cycle wakes it.'
			},
			reset: {
				label: 'Reset',
				help: 'Reboots the receiver. Settings and saves are kept — same as unplugging it.'
			},
			factory: {
				label: 'Factory Reset',
				help: 'Wipes every setting, mapping and memory-card config back to defaults. Cannot be undone.'
			}
		}
	},
	{
		id: '/system/update',
		slug: 'update',
		nav: 'USB Update',
		title: 'USB Update',
		summary: 'Flash firmware over the USB cable. It uses the chip’s download mode, so it can rescue a receiver that no longer connects.',
		steps: [
			'Use desktop Chrome or Edge for this page.',
			'Plug the receiver into the PC with a USB data cable; the page finds the serial port.',
			'Pick the firmware from the built-in list, then start the update.',
			'The receiver reboots when done. Do not unplug while it writes.'
		],
		fields: {
			usb: {
				label: 'Embedded updater',
				help: 'This is the standalone updater embedded in this site; it uses Web Serial. Phones, Safari and Firefox have no Web Serial, so they see a fallback message instead.'
			},
			fallback: {
				label: 'Fallback notice',
				help: 'USB flashing is not available in this browser. If the receiver still connects, use the OTA Update page instead.'
			}
		},
		tips: [
			'On Windows the first connection may need a serial driver installed (usually CH340 or CP210x).'
		]
	},
	{
		id: '/system/ota',
		slug: 'ota',
		nav: 'OTA Update',
		title: 'OTA Update',
		summary: 'Flash firmware wirelessly over Bluetooth — works on phones too. It only accepts the app-only image; full packages go on the USB page.',
		steps: [
			'Click Connect over Bluetooth to connect the receiver.',
			'Pick firmware from the built-in list; the newest is tagged ✓ Latest version.',
			'Press Write; the receiver restarts when it finishes.',
			'If the receiver no longer connects, use USB Update instead — OTA cannot reach it.'
		],
		fields: {
			firmware: {
				label: 'Firmware',
				help: 'Built-in firmware list, already grouped by model and version. After connecting it preselects the right one for this receiver.'
			},
			write: {
				label: 'Write',
				help: 'Writes the selected firmware to the receiver. Keep the page open and do not cut power while it runs.'
			},
			model: {
				label: 'Model memory',
				help: 'If the model cannot be detected you pick once; the choice is remembered per Bluetooth address and preselected next time.'
			}
		}
	},
	{
		id: '/system/debug',
		slug: 'debug',
		nav: 'Debug',
		title: 'Debug',
		summary: 'Download the receiver’s debug trace for troubleshooting or support.',
		steps: [
			'Reproduce the problem, then come back to this page.',
			'Click Download Debug Trace to save the file.',
			'Send the file together with a description of what happened.'
		],
		fields: {
			trace: {
				label: 'Download Debug Trace',
				help: 'Downloads the receiver’s debug log as a text file. It contains no personal data.'
			}
		}
	}
];

export type ImageDoc = {
	/** Site-relative path; prefix with the SvelteKit base when rendering. */
	src: string;
	alt: L;
	caption: L;
};

/**
 * Manual illustrations, keyed by chapter/page slug.
 * Files live in static/guide/ and are produced by the screenshot + annotation
 * scripts; rerun them after UI changes so the manual matches the app.
 */
export const images: Record<string, ImageDoc> = {
	start: {
		src: '/guide/01-connect.png',
		alt: 'The Select Device button in the top bar',
		caption: '① Select Device in the top bar is the pairing entry point. Once connected it turns into the receiver name plus firmware version — click it to see the address or disconnect.'
	},
	slots: {
		src: '/guide/page-output.png',
		alt: 'The Output page',
		caption: 'Inputs are picked on the controller pages (Input # / Bluetooth Device #); outputs are picked on the Output page (Output #). Single controller, single port: both are 1.'
	},
	layers: {
		src: '/guide/02-layers.png',
		alt: 'The config-layer switch and refresh button',
		caption: '① Configuration Options picks which layer you are reading and writing (Global / Console / Game ID); ② the refresh button makes the receiver re-read the console / game ID.'
	},
	remap: {
		src: '/guide/03-presets.png',
		alt: 'The five steps on the Presets page',
		caption: '① layer → ② which controller → ③ preset category → ④ the preset itself → ⑤ Save. That covers most “I want a different feel” cases.'
	},
	memory: {
		src: '/guide/page-n64.png',
		alt: 'The N64 Controller Pak page',
		caption: 'Memory-card pages share the same actions: Read to export a backup, Format to wipe, pick a file and Write to restore. Back up first — then a bad write is recoverable.'
	},
	firmware: {
		src: '/guide/page-ota.png',
		alt: 'The OTA update page',
		caption: 'If it still connects, use OTA (phones work too). If it no longer connects, use USB Update. The two pages use separate firmware lists — never feed a full package to OTA.'
	},
	system: {
		src: '/guide/page-manage.png',
		alt: 'The three system commands on the Manage page',
		caption: 'Manage has three buttons: Deep Sleep, Reset and Factory Reset (wipes every setting — be careful).'
	},
	global: {
		src: '/guide/page-global.png',
		alt: 'The Global settings page',
		caption: 'On a fresh setup just keep the defaults here: Auto / None / Auto / Bank 1, then press Save.'
	},
	output: {
		src: '/guide/page-output.png',
		alt: 'The Output page',
		caption: 'Single controller: Output #1, Mode = GamePad. Change Accessories only if you need rumble or a memory card.'
	},
	n64: {
		src: '/guide/page-n64.png',
		alt: 'The N64 Controller Pak page',
		caption: 'Pick Pak 1–4 → Read to back up, Format to wipe, or choose an .MPK file then Write to restore.'
	},
	dcvmu: {
		src: '/guide/page-dcvmu.png',
		alt: 'The Dreamcast VMU page',
		caption: 'There is no slot picker here: the receiver works on the VMU it currently sees. With several cards, attach only one.'
	},
	ps1mc: {
		src: '/guide/page-ps1mc.png',
		alt: 'The PS1 memory card page',
		caption: 'Read exports a .BIN, Format clears all 15 blocks, Write restores an image.'
	},
	presets: {
		src: '/guide/page-presets.png',
		alt: 'The Presets page',
		caption: 'Beginner path: keep the layer on Global → Input # 1 → Console = Default → Preset = Default Gamepad only → Save.'
	},
	buttons: {
		src: '/guide/04-custom.png',
		alt: 'The four steps on the Custom mapping page',
		caption: '① controller number → ② source device type → ③ destination device type → ④ Save Mappings. Remember to save on this page.'
	},
	files: {
		src: '/guide/page-files.png',
		alt: 'The Files page',
		caption: 'This lists the config files on the receiver. The bin icon deletes one — that cannot be undone.'
	},
	manage: {
		src: '/guide/page-manage.png',
		alt: 'The Manage page',
		caption: 'Sleep, reboot and factory reset. Day to day you only need Reset; Factory Reset is for troubleshooting.'
	},
	update: {
		src: '/guide/page-update.png',
		alt: 'The USB update page',
		caption: 'Desktop Chrome / Edge gets the embedded updater; phones and browsers without Web Serial see a fallback message pointing at OTA.'
	},
	ota: {
		src: '/guide/page-ota.png',
		alt: 'The OTA update page',
		caption: 'Connect over Bluetooth → pick firmware from the built-in list → Write. Keep the page open while it writes.'
	},
	debug: {
		src: '/guide/page-debug.png',
		alt: 'The Debug page',
		caption: 'Reproduce the problem, download the trace and send it to support with a description.'
	}
};

/** Page chapter for a route id; undefined when the route has no chapter. */
export function docFor(routeId: string | null | undefined): PageDoc | undefined {
	if (!routeId) return undefined;
	const clean = routeId.replace(/\/+$/, '') || '/';
	return pages.find((page) => page.id === clean);
}

export type { L as Localized };
