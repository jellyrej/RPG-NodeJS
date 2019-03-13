var mongoose = require('mongoose');

var QuestBoss = mongoose.model('QuestBoss', {
    quest_id: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        trim: true,
        required: true
    },
    health: {
        type: Number,
        required: true,
        trim: true
    },
    str: {
        type: Number,
        required: true
    },
    dex: {
        type: Number,
        required: true
    },
    vit: {
        type: Number,
        required: true
    },    
    intel: {
        type: Number,
        required: true
    },
    img: {
        type: String,
        required: true
    }
});

module.exports = {QuestBoss};