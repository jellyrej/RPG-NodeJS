const {BoughtItem} = require('./../models/bought-item');
const {Fight} = require('./../models/fight');
const {LostFight} = require('./../models/lost');
const {Message} = require('./../models/message');
const {Revive} = require('./../models/revive');
const {User} = require('./../models/user');
const {Achievement} = require('./../models/achievement');


exports.renderViewAllianceError = (res) => {
    BoughtItem.find().sort('-createdAt').limit(25).then((liveitems) => {
        Fight.find().sort('-createdAt').limit(35).then((fights) => {
            LostFight.find().sort('-createdAt').limit(62).then((lostFights) => {
         return res.render(__dirname + './../views/alliance/create', {liveitems, lostFights, fights, errmsg: "Something went wrong. Try again."});
        });
        });
    });
}

exports.renderViewAlliance = (res) => {
   BoughtItem.find().sort('-createdAt').limit(25).then((liveitems) => {
        Fight.find().sort('-createdAt').limit(35).then((fights) => {
            LostFight.find().sort('-createdAt').limit(62).then((lostFights) => {
         return res.render(__dirname + './../views/alliance/info', {liveitems, lostFights, fights, msg: "New alliance created successfully."});
        });
        });
    });
    return res.redirect('/alliance-information');

}

exports.renderViewAchievements = async (req, res, results, memberAllyCurrent) => {

    let allAchievements = await Achievement.find();

    User.findById(req.session.userId).then((user) => {
        BoughtItem.aggregate([
            {"$sort": {createdAt: -1}},
            {"$limit": 25},
            {
                "$lookup": {
                    "from": "alliancemembers",
                    "localField": "username",
                    "foreignField": "username",
                    "as": "alliance"
                }
            } 
        ]).then((liveitems) => {
            Fight.aggregate([
                {"$sort": {createdAt: -1}},
                {"$limit": 35},
                {
                    "$lookup": {
                        "from": "alliancemembers",
                        "localField": "username",
                        "foreignField": "username",
                        "as": "alliance"
                    }
                },
                {
                    "$lookup": {
                        "from": "alliancemembers",
                        "localField": "enemyname",
                        "foreignField": "username",
                        "as": "enemyalliance"
                    }
                }             
            ]).then((fights) => {
                LostFight.aggregate([
                    {"$sort": {createdAt: -1}},
                    {"$limit": 62},
                    {
                        "$lookup": {
                            "from": "alliancemembers",
                            "localField": "username",
                            "foreignField": "username",
                            "as": "alliance"
                        }
                    },
                    {
                        "$lookup": {
                            "from": "alliancemembers",
                            "localField": "enemyname",
                            "foreignField": "username",
                            "as": "enemyalliance"                        
                        }
                    } 
                ]).then((lostFights) => {               
                    BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then((messages) => {
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            Fight.find({
                                username: user.username
                            }).sort('-createdAt').limit(10).then((userFights) => {
                                LostFight.find({
                                    username: user.username
                                }).sort('-createdAt').limit(10).then((userLostFights) => {
    
                                    res.render('achievements', {
                                        user,
                                        userFights,
                                        userLostFights,
                                        userItems,
                                        liveitems,
                                        fights,
                                        lostFights,
                                        messages,
                                        revive,
                                        results,
                                        allAchievements,
                                        memberAllyCurrent
                                      });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });    
    });
}
