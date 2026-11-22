<script lang="ts">
	import { base } from '$app/paths';
	import { chapters, images, pages } from '$lib/help/content';
	import { brand } from '$lib/brand';
	import { IconPrinter } from '@tabler/icons-svelte';
</script>

<svelte:head>
	<title>Manual · {brand.documentTitle}</title>
</svelte:head>

<div class="manual">
	<header class="manual-head">
		<p class="manual-kicker">Manual · LinkRetro wireless receiver</p>
		<h1>Web config manual</h1>
		<p class="manual-lede">
			This manual starts from what the receiver is and how to connect, then covers every page and
			every option. Read it top to bottom the first time, or jump straight to a topic with the
			contents list.
		</p>
		<div class="manual-actions">
			<button class="btn preset-tonal border border-surface-300" onclick={() => window.print()}>
				<IconPrinter class="size-4" />
				Print / save as PDF
			</button>
		</div>
	</header>

	<div class="manual-grid">
		<nav class="manual-toc" aria-label="Contents">
			<p class="manual-toc-title">Contents</p>
			<ol>
				<li><a href="#basics">Basics</a></li>
				{#each chapters as chapter (chapter.slug)}
					<li class="lvl2"><a href="#{chapter.slug}">{chapter.title}</a></li>
				{/each}
				<li class="toc-group">Page by page</li>
				{#each pages as doc (doc.id)}
					<li class="lvl2"><a href="#{doc.slug}">{doc.nav}</a></li>
				{/each}
			</ol>
		</nav>

		<article class="manual-body">
			<section id="basics" class="manual-section">
				<h2>Basics</h2>
				{#each chapters as chapter (chapter.slug)}
					<section class="manual-chapter" id={chapter.slug}>
						<h3>{chapter.title}</h3>
						{#each chapter.body as paragraph, i (i)}
							<p>{paragraph}</p>
						{/each}
						{#if chapter.note}
							<p class="manual-note"><b>Note:</b> {chapter.note}</p>
						{/if}
						{#if images[chapter.slug]}
							{@const shot = images[chapter.slug]}
							<figure class="manual-figure">
								<a href="{base}{shot.src}" target="_blank" rel="noreferrer">
									<img src="{base}{shot.src}" alt={shot.alt} loading="lazy" />
								</a>
								<figcaption>{shot.caption}</figcaption>
							</figure>
						{/if}
					</section>
				{/each}
			</section>

			<section id="pages" class="manual-section">
				<h2>Page by page</h2>
				{#each pages as doc (doc.id)}
					<section class="manual-chapter" id={doc.slug}>
						<h3>
							{doc.nav}
							<span class="manual-route">{doc.id}</span>
						</h3>
						<p>{doc.summary}</p>

						{#if images[doc.slug]}
							{@const shot = images[doc.slug]}
							<figure class="manual-figure">
								<a href="{base}{shot.src}" target="_blank" rel="noreferrer">
									<img src="{base}{shot.src}" alt={shot.alt} loading="lazy" />
								</a>
								<figcaption>{shot.caption}</figcaption>
							</figure>
						{/if}

						<h4>How to use it</h4>
						<ol>
							{#each doc.steps as step, i (i)}
								<li>{step}</li>
							{/each}
						</ol>

						<h4>What each option does</h4>
						<dl class="manual-fields">
							{#each Object.entries(doc.fields) as [key, field] (key)}
								<div>
									<dt>{field.label}</dt>
									<dd>{field.help}</dd>
								</div>
							{/each}
						</dl>

						{#if doc.tips?.length}
							<ul>
								{#each doc.tips as tip, i (i)}
									<li>{tip}</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/each}
			</section>
		</article>
	</div>
</div>
