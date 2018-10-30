const fs = require('fs');

function defaultBlueprint() {
	return {
		cover: _defaultCover(),
		toc: _defaultToc(),
		document: _defaultDocument(),
		options: _defaultOptions()
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
		template: './templates/default_cover.html',
		css: './templates/default_cover.css',
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
		template: './templates/default_toc.html',
		css: './templates/default_toc.css',
		assets: {}
	};
}

function _defaultDocument() {
	return {
		template: './templates/default.html',
		css: './templates/default.css',
		assets: {},
		items: [],
		groups: []
	};
}

module.exports = {
	fromCommandLineOptions
};
