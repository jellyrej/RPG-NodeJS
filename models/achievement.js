var mongoose = require('mongoose');

var Achievement = mongoose.model('Achievement', {
    title: {
        type: String,
        min: 6
    },
    description: {
        type: String,
        min: 6
    },
    exp: {
        type: Number
    },
    gold: {
        type: Number
    },
    created_at: {
        type: Date
    }
});

module.exports = {Achievement};