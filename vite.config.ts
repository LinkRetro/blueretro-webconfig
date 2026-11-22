import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// mkcert is only needed when the dev server is opened from a phone or another
// device on the LAN: it downloads the mkcert binary and installs a local root
// certificate, which fails offline or without permissions. Local development on
// http://localhost already satisfies the Web Bluetooth secure-context rule, so
// mkcert stays off by default. For LAN HTTPS run:
//   $env:LinkRetro_MKCERT='1'; pwsh -File tools\dev.ps1
const useMkcert = process.env.LinkRetro_MKCERT === '1';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(), 
		...(useMkcert ? [mkcert()] : [])
	], 
	server: {
		proxy: {},
	},
});
