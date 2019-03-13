const mongoose = require('mongoose');

var AllianceMember = mongoose.model('AllianceMember', {
    user_id: {},
    username: {
        required: true,
        type: String
    },
    ally_id: {},
    money_borrow: {
        type: Number
    },  
    experience: {},
    ally_title: {
        type: String
    },
    money_added: {
        type: Number
    },
    created_at: {
        type: Date
    }
});

module.exports = {AllianceMember};