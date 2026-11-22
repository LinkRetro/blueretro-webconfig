# BlueRetroWebCfg (LinkRetro fork)

This is the **LinkRetro** fork of darthcloud's BlueRetro web configurator.
It adds the LinkRetro brand layer, a built-in illustrated manual, a split
USB / OTA firmware update flow and bundled presets.

- Fork-specific guide: [LINKRETRO-README.md](LINKRETRO-README.md)
- Upstream project: [darthcloud/BlueRetroWebCfg_Beta](https://github.com/darthcloud/BlueRetroWebCfg_Beta)
- License: Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
  Attribution to darthcloud stays visible in the UI.

The upstream README follows.

---

# BlueRetroWebCfg
BlueRetro Web-Bluetooth configuration pages

Those pages are base on [Google Chrome Samples](https://github.com/GoogleChrome/samples)

More detail BlueRetro:\
[Main hackaday.io page](https://hackaday.io/project/170365-blueretro)\
[Software files repository](https://github.com/darthcloud/BlueRetro)

## Creating additional presets
Presets are located under:
`static/config/presets`

## Developing

Once you've created a project and installed dependencies with `pnpm install`, start a development server:

```bash
pnpm dev

# or start the server and open the app in a new browser tab
pnpm dev -- --open
```

## Building

To create a production version of your app:

```bash
pnpm build
```

You can preview the production build with `pnpm preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
