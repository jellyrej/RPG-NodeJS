const mongoose = require('mongoose');

var AllianceMemberRequest = mongoose.model('AllianceMemberRequest', {
    user_id: {},
    username: {
        required: true,
        type: String
    },
    ally_id: {},
    created_at: {
        type: Date
    }
});

module.exports = {AllianceMemberRequest};