#!/usr/bin/env node
const pup = require('puppeteer');
const got = require('got');
const { JSDOM } = require('jsdom');
const nunjucks = require('nunjucks');
const tmp = require('tmp');
const fs = require('fs');
const css = require('css');
const slugify = require('slugify');
const Readability = require('./vendor/readability');
const pkg = require('./package.json');

const blueprints = require('./src/blueprints');
const log = require('./src/log');

const {
	ampToHtml,
	fixLazyLoadedImages,
	extractImage,
	imagesAtFullSize,
	wikipediaSpecific,
	noUselessHref,
	relativeToAbsoluteURIs,
	singleImgToFigure
} = require('./src/enhancements');
const get_style_attribute_value = require('./src/get-style-attribute-value');

const resolve = path =>
	require.resolve(path, {
		paths: [process.cwd(), __dirname]
	});

const enhancePage = function(dom) {
	// Note: the order of the enhancements matters!
	[
		ampToHtml,
		fixLazyLoadedImages,
		relativeToAbsoluteURIs,
		imagesAtFullSize,
		singleImgToFigure,
		noUselessHref,
		wikipediaSpecific
	].forEach(enhancement => {
		enhancement(dom.window.document);
	});
};

let spinner = log.spinner(false);

function createDom({ url, content }) {
	const dom = new JSDOM(content, { url });

	// Force relative URL resolution
	dom.window.document.body.setAttribute(null, null);

	return dom;
}

/*
	Some setup
	----------
 */
function configure() {
	nunjucks.configure({ autoescape: false, noCache: true });
}

/*
	Fetch a web page and clean the HTML
	-----------------------------------
 */
async function cleanup(item, blueprint) {
	try {
		spinner.start(`Fetching: ${item.url}`);
		const content = (await got(item.url, {
			headers: {
				'user-agent': `percollate/${pkg.version}`
			}
		})).body;
		spinner.succeed();

		spinner.start('Enhancing web page');
		const dom = createDom({ url: item.url, content });

		if (!item.amp) {
			item._url = item.url;
		}
		const amp = dom.window.document.querySelector('link[rel=amphtml]');
		if (amp && blueprint.options.amp) {
			spinner.succeed('Found AMP version');
			return cleanup(
				Object.assign({}, item, { url: amp.href, amp: amp.href }),
				blueprint
			);
		}

		/* 
			Run enhancements
			----------------
		*/
		enhancePage(dom);
		const img = extractImage(dom.window.document);

		// Run through readability and return
		const parsed = new Readability(dom.window.document, {
			classesToPreserve: [
				'no-href',

				/*
					Placed on some <a> elements
					as in-page anchors
				 */
				'anchor'
			]
		}).parse();

		spinner.succeed();

		const _id = Math.random()
			.toString(36)
			.replace(/[^a-z]+/g, '')
			.substr(2, 10);
		return Object.assign({}, parsed, item, { _id: _id, img: img });
	} catch (error) {
		spinner.fail(error.message);
		throw error;
	}
}

/*
	Bundle the HTML files into a PDF
	--------------------------------
 */
async function bundle(blueprint) {
	spinner.start('Generating temporary HTML file');
	const temp_file = tmp.tmpNameSync({ postfix: '.html' });

	const stylesheet = resolve(blueprint.document.css);
	let style = fs.readFileSync(stylesheet, 'utf8');
	if (blueprint.cover.generate) {
		style += fs.readFileSync(resolve(blueprint.cover.css), 'utf8');
		if (!blueprint.cover.title) {
			blueprint.cover.title = blueprint.document.items[0].title;
		}
		if (!blueprint.cover.picture) {
			blueprint.cover.picture = blueprint.document.items[0].img;
		}
	}
	if (blueprint.toc.generate) {
		style += fs.readFileSync(resolve(blueprint.toc.css), 'utf8');
	}

	if (blueprint.document.groups && blueprint.document.groups.length > 0) {
		let itemIndex = {};
		blueprint.document.items.forEach(function(item) {
			itemIndex[item._url] = item;
		});
		blueprint.document.groups = blueprint.document.groups.map(function(
			group
		) {
			group.items = group.items.map(function(item) {
				return itemIndex[item.url];
			});
			return group;
		});
	}
	console.log(blueprint);

	const html = nunjucks.renderString(
		fs.readFileSync(resolve(blueprint.document.template), 'utf8'),
		{
			items: blueprint.document.items,
			style,
			blueprint
		}
	);

	const doc = new JSDOM(html).window.document;
	const headerTemplate = doc.querySelector('.header-template');
	const footerTemplate = doc.querySelector('.footer-template');
	const header = new JSDOM(
		headerTemplate ? headerTemplate.innerHTML : '<span></span>'
	).window.document;
	const footer = new JSDOM(
		footerTemplate ? footerTemplate.innerHTML : '<span></span>'
	).window.document;

	const css_ast = css.parse(style);

	const header_style = get_style_attribute_value(css_ast, '.header-template');
	const header_div = header.querySelector('body :first-child');

	if (header_div && header_style) {
		header_div.setAttribute(
			'style',
			`
				${header_style};
				${header_div.getAttribute('style') || ''}
			`
		);
	}

	const footer_style = get_style_attribute_value(css_ast, '.footer-template');
	const footer_div = footer.querySelector('body :first-child');

	if (footer_div && footer_style) {
		footer_div.setAttribute(
			'style',
			`
				${footer_style};
				${footer_div.getAttribute('style') || ''}
			`
		);
	}

	fs.writeFileSync(temp_file, html);

	spinner.succeed(
		`Processed ${
			blueprint.document.items.length
		} items, temporary HTML file: file://${temp_file}`
	);

	spinner.start('Saving PDF');

	const browser = await pup.launch({
		headless: true,
		/*
			Allow running with no sandbox
			See: https://github.com/danburzo/percollate/issues/26
		 */
		args: blueprint.options.sandbox
			? undefined
			: ['--no-sandbox', '--disable-setuid-sandbox'],
		defaultViewport: {
			// Emulate retina display (@2x)...
			deviceScaleFactor: 2,
			// ...but then we need to provide the other
			// viewport parameters as well
			width: 1920,
			height: 1080
		}
	});
	const page = await browser.newPage();
	await page.goto(`file://${temp_file}`, { waitUntil: 'load' });

	/*
		When no output path is present,
		produce the file name from the web page title
		(if a single page was sent as argument), 
		or a timestamped file (for the moment) 
		in case we're bundling many web pages.
	 */
	const output_path =
		blueprint.options.output ||
		(blueprint.document.items.length === 1
			? `${slugify(
					blueprint.document.items[0].title || 'Untitled page'
			  )}.pdf`
			: `percollate-${Date.now()}.pdf`);

	await page.pdf({
		path: output_path,
		preferCSSPageSize: true,
		displayHeaderFooter: true,
		headerTemplate: header.body.innerHTML,
		footerTemplate: footer.body.innerHTML,
		printBackground: true
	});

	await browser.close();

	spinner.succeed(`Saved PDF: ${output_path}`);
}

/*
	Generate PDF
 */
async function pdf(urls, options) {
	const blueprint = blueprints.fromCommandLineOptions(urls, options);
	if (!blueprint.document.items || !blueprint.document.items.length) {
		return;
	}
	spinner = log.spinner(blueprint.options.silent);
	blueprint.document.items = await Promise.all(
		blueprint.document.items.map(async function(item) {
			return await cleanup(item, blueprint);
		})
	);
	if (blueprint.options.individual) {
		await Promise.all(
			blueprint.document.items.map(async function(item) {
				let itemBlueprint = Object.assign({}, blueprint);
				itemBlueprint.document.items = [item];
				await bundle(blueprint);
			})
		);
	} else {
		await bundle(blueprint);
	}
}

/*
	Generate EPUB
 */
async function epub(urls, options) {
	console.log('TODO', urls, options);
}

/*
	Generate HTML
 */
async function html(urls, options) {
	console.log('TODO', urls, options);
}

module.exports = { configure, pdf, epub, html };
