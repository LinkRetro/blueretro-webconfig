<script lang="ts">
	import { ActivityProgress } from '$lib/components';
	import { HelpTip, PageGuide } from '$lib/components';
	import { docFor } from '$lib/help/content';
	import { device, isFullyInitialized } from '$lib/stores';
	import { downloadFile, getService, toaster } from '$lib/utilities';
	import { dcReadFile } from '$lib/utilities/dcReadFile';
	import { IconDownload } from '@tabler/icons-svelte';

	const help = docFor('/system/debug')!;

	let isDoingSomething = $state(false);
	let progress = $state(0);
	let cancelationToken: ICancellationToken = $state({ isCanceled: false });

	const cancelClick = () => {
		cancelationToken.isCanceled = true;
	};

	const setProgress = (value: number) => {
		progress = value;
	};


const pakRead = async () =>  {
    progress = 0;
	isDoingSomething = true;

	try {
		const service = await getService();
		const value = await dcReadFile(service, setProgress, cancelationToken);
		downloadFile(new Blob([value.buffer], {type: "application/bin"}), 'br_debug_trace.bin');
		toaster.success({ title: 'Success downloading trace'});
	} catch (error) {
		console.log('There was an error downloading the trace', error);
		toaster.error({ title: 'There was an error downloading trace'});
	}

	isDoingSomething = false;
	progress = 0;
}
</script>

<PageGuide />

<p>
	Please consult the documentation found in the wiki: 
	<a class="anchor" href="https://github.com/darthcloud/BlueRetroWiki/blob/master/Debug-trace.md">Debug Trace Documentation</a>
</p>

<div class="flex items-center gap-2">
	<button 
		disabled={!$isFullyInitialized || isDoingSomething || !$device }
		class="btn preset-tonal-tertiary"
		onclick={pakRead}
		>
		<IconDownload class="size-4" />
		<span>Download Debug Trace</span>
	</button>
	<HelpTip text={help.fields.trace.help} />
</div>


<ActivityProgress 
	max={100} 
	onCancelClick={cancelClick} 
	{progress} 
	{isDoingSomething}
	labelText="Reading..."
/>