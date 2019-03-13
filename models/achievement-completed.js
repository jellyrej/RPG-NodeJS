var mongoose = require('mongoose');

var AchievementCompleted = mongoose.model('AchievementCompleted', {
    user_id: {

    },
    achievement_id: {

    },
    created_at: {
        type: Date,
        //required: true
    }
});

module.exports = {AchievementCompleted};