const mongoose = require('mongoose');

let LobbyMessage = mongoose.model('LobbyMessage', {
    username: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },
    lobby_id: {
    },
    createdAt: {}
});

module.exports = {LobbyMessage};