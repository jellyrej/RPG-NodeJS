const {
    BoughtItem
} = require('./../models/bought-item');

// Fights
const {
    Fight
} = require('./../models/fight');
const {
    LostFight
} = require('./../models/lost');

// Chatroom
const {
    Message
} = require('./../models/message');

// Revives
const {
    Revive
} = require('./../models/revive');

const {Alliance} = require('./../models/alliance');
const {AllianceMember} = require('./../models/alliancemember');

exports.getGameContent = async function(user, res) {

    let allyMember = await AllianceMember.findOne({username: user.username});
    if(allyMember) {
    var memberAllyCurrent = await Alliance.findById(allyMember.ally_id);
    }

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

                        Message.aggregate([
                            {"$sort": {createdAt: -1}},
                            {"$limit": 20},
                            {
                                "$lookup": {
                                    "from": "alliancemembers",
                                    "localField": "username",
                                    "foreignField": "username",
                                    "as": "alliance"
                                }
                            }
                        ]).then((messages) => {


                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            Fight.find({
                                username: user.username
                            }).sort('-createdAt').limit(10).then((userFights) => {
                                LostFight.find({
                                    username: user.username
                                }).sort('-createdAt').limit(10).then((userLostFights) => {
    
                                    res.render('game', {
                                        user,
                                        userFights,
                                        userLostFights,
                                        userItems,
                                        liveitems,
                                        fights,
                                        lostFights,
                                        messages,
                                        revive,
                                        memberAllyCurrent,
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