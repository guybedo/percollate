const fs = require('fs');
const path = require('path');

function resolveTemplate(filename) {
	return path.resolve(__dirname, '..', 'templates', filename);
}

function defaultBlueprint() {
	return {
		cover: _defaultCover(),
		toc: _defaultToc(),
		document: _defaultDocument(),
		options: _defaultOptions(),
		templates: _defaultTemplates(),
		http: _defaultHttp(),
		pupeteer: _defaultPupeteer()
	};
}

function fromCommandLineOptions(urls, options) {
	let blueprint = null;
	if (options.blueprint) {
		blueprint = _buildBluePrint(
			JSON.parse(fs.readFileSync(options.blueprint, 'utf8'))
		);
	} else {
		blueprint = _parseCommandLineOptions(options, defaultBlueprint());
	}
	if (blueprint.document.groups && blueprint.document.groups.length > 0) {
		blueprint.document.useGroups = true;
		if (blueprint.templates.toc === resolveTemplate('default_toc.html')) {
			blueprint.templates.toc = resolveTemplate(
				'default_toc_w_groups.html'
			);
		}
	}
	if (urls && urls.length > 0) {
		blueprint.document.items = urls.map(function(url) {
			return { url: url };
		});
	}
	return blueprint;
}

function _buildBluePrint(userBlueprint) {
	let blueprint = Object.assign({}, defaultBlueprint());
	blueprint.cover = Object.assign({}, blueprint.cover, userBlueprint.cover);
	blueprint.toc = Object.assign({}, blueprint.toc, userBlueprint.toc);
	blueprint.document = Object.assign(
		{},
		blueprint.document,
		userBlueprint.document
	);
	blueprint.options = Object.assign(
		{},
		blueprint.options,
		userBlueprint.options
	);
	blueprint.http = Object.assign({}, blueprint.http, userBlueprint.http);
	blueprint.pupeteer = Object.assign(
		{},
		blueprint.pupeteer,
		userBlueprint.pupeteer
	);
	return blueprint;
}

function _parseCommandLineOptions(options, blueprint) {
	if (options.cover) {
		blueprint.cover['generate'] = options.cover;
	}
	if (options.toc) {
		blueprint.toc['generate'] = options.toc;
	}
	if (options.template) {
		blueprint.document['template'] = options.template;
	}
	if (options.style) {
		blueprint.document['css'] = options.style;
	}
	blueprint.options['sandbox'] = options.sandbox;
	blueprint.options['output'] = options.output;
	blueprint.options['individual'] = options.individual;
	blueprint.options['no-amp'] = options.amp;
	return blueprint;
}

function _defaultHttp() {
	return {
		concurrency: 5
	};
}

function _defaultPupeteer() {
	return {
		timeout: 60000
	};
}

function _defaultOptions() {
	return {
		output: 'percollate.pdf',
		individual: false,
		amp: true
	};
}

function _defaultCover() {
	return {
		generate: false,
		template: resolveTemplate('default_cover.html'),
		css: resolveTemplate('default_cover.css'),
		title: null,
		picture: null,
		header: 'Percollate',
		footer: new Date(),
		assets: {}
	};
}

function _defaultToc() {
	return {
		generate: false,
		template: resolveTemplate('default_toc.html'),
		css: resolveTemplate('default_toc.css'),
		assets: {}
	};
}

function _defaultDocument() {
	return {
		template: resolveTemplate('default.html'),
		css: resolveTemplate('default.css'),
		assets: {},
		items: [],
		groups: []
	};
}

function _defaultTemplates() {
	return {
		toc: resolveTemplate('default_toc.html'),
		cover: resolveTemplate('default_cover.html'),
		document: resolveTemplate('default.html'),
		item: resolveTemplate('default_item.html'),
		group: resolveTemplate('default_group.html')
	};
}

module.exports = {
	fromCommandLineOptions
};
