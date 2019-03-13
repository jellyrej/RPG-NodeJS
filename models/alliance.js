const mongoose = require('mongoose');

var Alliance = mongoose.model('Alliance', {
    title: {
        required: true,
        type: String,
        minlength: 3,
        maxlength: 10,
        trim: true,
        unique: true
    },
    leader: {
        required: true,
        type: String,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    bank: {
        type: Number
    },
    expCount: {
        type: Number
    },
    created_at: {
        type: Date
    }
});

module.exports = {Alliance};