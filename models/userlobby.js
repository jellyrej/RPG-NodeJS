const mongoose = require('mongoose');

let UserLobby = mongoose.model('UserLobby', {
	username: {
		type: String,
		trim: true
	},
	alliance: {
		type: String
	},
	lobby_id: {},
	lobby_title: {
		type: String
	},
	token: {},
	checked: {
		type: Number,
		default: 0
	},
	created_at: {}
});

module.exports = {UserLobby};