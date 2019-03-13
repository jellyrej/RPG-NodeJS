const mongoose = require('mongoose');

let Lobby = mongoose.model('Lobby', {
	title: {
		type: String,
		minlength: 3,
		maxlength: 10,
		required: true,
		trim: true
	},
	password: {
		type: String,
		minlength: 3,
		required: true,
		trim: true
	},
	leader: {},
	searching: {
		type: Number,
		default: 0
	},
	in_game: {
	},
	players: {
		type: Number,
		default: 1
	},
	created_at: {}
});

module.exports = {Lobby};