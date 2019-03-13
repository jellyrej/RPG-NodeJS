const mongoose = require('mongoose');

var Quest = mongoose.model('Quest', {
    'title': {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    'intro': {
        type: String,
        required: true,
        trim: true
    },
    'description': {
        type: String,
        required: true,
        trim: true
    },
    'level': {
        type: Number,
        required: true,
        trim: true
    }
});

module.exports = {Quest};