const mongoose = require('mongoose');

let Match = mongoose.model('Match', {
    lobby_one_title: {
        required: true,
        type: String
    },
    lobby_one_id: {},
    lobby_two_title: {
        required: true,
        type: String
    }, 
    lobby_two_id: {},
    created_at: {}
});

module.exports = {Match};