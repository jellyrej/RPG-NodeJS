const mongoose = require('mongoose');

var AllianceMessage = mongoose.model('AllianceMessage', {
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
    ally_id: {
    },
    createdAt: {}
});

module.exports = {AllianceMessage};