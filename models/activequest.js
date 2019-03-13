var mongoose = require('mongoose');

var ActiveQuest = mongoose.model('ActiveQuest', {
    quest_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    created_at: {
        type: Date
    }
});

module.exports = {ActiveQuest};