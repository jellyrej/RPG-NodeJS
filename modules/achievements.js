const {AchievementCompleted} = require('./../models/achievement-completed');
const {Achievement} = require('./../models/achievement');
const moment = require('moment');


exports.getAchievementCompleted = function(userId, achievementId) {
    var newAchievementCompleted = AchievementCompleted({
        user_id: userId,
        achievement_id: achievementId,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss')    
    });

    AchievementCompleted.find({
        $and: [{
            user_id: userId
        }, {
            achievement_id: achievementId
        }]
    }).then((result) => {
        if(result.length > 0) {
            return console.log('You have already completed it.');
        } else {
            newAchievementCompleted.save();
        }
    });
}

exports.getAchievement = function(user, achievementId) {

        AchievementCompleted.find({
            $and: [{
                user_id: user._id
            }, {
                achievement_id: achievementId
            }]
        }).then((result) => {
            if(result.length > 0) {
                return console.log('Cannot get rewards from completed achievement.');
            } else {
                Achievement.findById(achievementId).then((achievement) => {

                user.gold = user.gold + achievement.gold;
                user.current_exp = user.current_exp + achievement.exp;
                user.save();
                console.log(`${achievement.title} achievement is completed!`);
            });
            }
        });        
}

