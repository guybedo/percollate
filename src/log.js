const ora = require('ora');
const _spinner = ora();

function spinner(silent) {
	return {
		start: function(message) {
			if (silent) {
				return;
			}
			_spinner.start(message);
		},
		succeed: function() {
			if (silent) {
				return;
			}
			_spinner.succeed();
		},
		fail: function(message) {
			if (silent) {
				return;
			}
			_spinner.fail(message);
		}
	};
}

module.exports = {
	spinner
};
