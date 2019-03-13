const express = require('express');
const {
    ObjectId
} = require('mongodb');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const {
    mongoose
} = require('./database/db');
const socketIO = require('socket.io');
const http = require('http');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
var shuffle = require('shuffle-array');
var moment = require('moment');
var uuid4 = require('uuid4');
const gameContent = require('./modules/game');
var achievements = require('./modules/achievements');
const nl2br = require('nl2br');
const validator = require('validator');
const UIDGenerator = require('uid-generator');
const uidgen = new UIDGenerator();
const sharedsession = require("express-socket.io-session");

var app = express();
var server = http.createServer(app);
var io = socketIO(server);

var H = require('just-handlebars-helpers');

// App
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);
hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper("equal", require("handlebars-helper-equal"));
H.registerHelpers(hbs);

app.set('socketio', io);

app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json());
app.use(express.static('./public/'));
app.set('view options', {
    layout: '/layouts/main-layout'
});

app.use(cookieParser());
const exsession = require('express-session');
const MongoStore = require('connect-mongo')(exsession);

const session = exsession({
    secret: 'ianevutytsuinliv',
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    },
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    })
});


app.use(session);
io.use(sharedsession(session));

// Player
const {
    User
} = require('./models/user');

// Market
const {
    Item
} = require('./models/item');
const {
    BoughtItem
} = require('./models/bought-item');

// Fights
const {
    Fight
} = require('./models/fight');
const {
    LostFight
} = require('./models/lost');

// Chatroom
const {
    Message
} = require('./models/message');

// Temporary Fight
const {
    TempFight
} = require('./models/tempfight');

// Revives
const {
    Revive
} = require('./models/revive');

// Quests
const {
    Quest
} = require('./models/quest');
const {
    ActiveQuest
} = require('./models/activequest');
const {
    QuestBoss
} = require('./models/questboss');

// Achievements
const {
    Achievement
} = require('./models/achievement');
const {
    AchievementCompleted
} = require('./models/achievement-completed');

// Alliance
const {
    Alliance
} = require('./models/alliance');
const {
    AllianceMember
} = require('./models/alliancemember');

const {
    AllianceMessage
} = require('./models/alliancemessage');
const {
    AllianceMemberRequest
} = require('./models/alliancememberequest');


// Lobby
const {
    Lobby
} = require('./models/lobby');
const {
    UserLobby
} = require('./models/userlobby');
const {
    LobbyMessage
} = require('./models/lobbymessage');

// Match
const {Match} = require('./models/match');

// Render views
const renderView = require('./modules/renderview');


const port = process.env.PORT || 5000;

// Functions

inLobby = (user, res) => {
    let inLobby = UserLobby.findOne({
        username: user.username
    });
    if (inLobby != null) {
        res.send('You are already in a lobby.');
    }
}

liveItems = () => {
    return BoughtItem.aggregate([{
            "$sort": {
                createdAt: -1
            }
        },
        {
            "$limit": 25
        },
        {
            "$lookup": {
                "from": "alliancemembers",
                "localField": "username",
                "foreignField": "username",
                "as": "alliance"
            }
        }
    ]);
}

liveFights = () => {
    return Fight.aggregate([{
            "$sort": {
                createdAt: -1
            }
        },
        {
            "$limit": 35
        },
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
    ]);
}

liveLostFights = () => {
    return LostFight.aggregate([{
            "$sort": {
                createdAt: -1
            }
        },
        {
            "$limit": 62
        },
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
    ]);
}


// Routes

app.post('/new', (req, res) => {
    var newAchievement = Achievement({
        title: req.body.title,
        description: req.body.description,
        gold: req.body.gold,
        exp: req.body.exp,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss')
    });

    newAchievement.save().then(() => {
        res.redirect('/new-event');
    });
});

app.get('/', (req, res) => {
    if (!req.session.userId) {
        console.log('Server is runing on port', port);
        res.render('index', {
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            gameContent.getGameContent(user, res);
        });
    }
});

app.get('/achievements', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let memberAlly = await AllianceMember.findOne({
        username: user.username
    });
    if (memberAlly) {
        var memberAllyCurrent = await Alliance.findById(memberAlly.ally_id);
    }


    Achievement.aggregate([{
            "$lookup": {
                "from": "achievementcompleteds", // collection name in db
                "localField": "_id",
                "foreignField": "achievement_id",
                "as": "completeds"
            }
        },
        {
            "$match": {
                "completeds.user_id": user._id
            }
        }
    ]).then((results) => {
        renderView.renderViewAchievements(req, res, results, memberAllyCurrent);
    });

});

app.get('/rules', (req, res) => {
    return res.render('rules', {
        layout: false
    });
});

app.get('/revive/:id', (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {

        User.findById(req.session.userId).then((user) => {

            Revive.findOne({
                username: user.username
            }).then((userRevive) => {
                if (userRevive && userRevive.count < 3) {
                    if (user.health < 100) {
                        user.health = 100;
                        user.save();

                        Revive.findOneAndUpdate({
                            username: user.username
                        }, {
                            $inc: {
                                count: 1
                            }
                        }).then(() => {});

                        return res.redirect('/');
                    } else {
                        return res.redirect('/');
                    }
                } else if (userRevive && userRevive.count === 3) {
                    return res.redirect('/');
                } else {

                    if (user.health < 100) {
                        user.health = 100;
                        user.save();

                        var newRevive = Revive({
                            username: user.username,
                        });

                        newRevive.count = 1;
                        newRevive.save();
                        return res.redirect('/');
                    } else {
                        return res.redirect('/');
                    }
                }
            });

        });
    }
});

app.get('/signup', (req, res) => {
    if (!req.session.userId) {
        res.render('signup', {
            layout: false
        });
    } else {
        res.redirect('game');
    }
});

app.post('/login', (req, res) => {

    req.body.username = req.body.username.charAt(0).toUpperCase() + req.body.username.slice(1);

    User.findOne({
        username: req.body.username
    }).then((user) => {
        if (!user) {
            res.render('index', {
                errMsg: 'Player with provided username is not found.',
                layout: false
            });
        }
        bcrypt.compare(req.body.password, user.password).then(function (result) {
            if (result === true) {
                req.session.userId = user._id;
                req.session.username = user.username;
                req.session.userToken = uidgen.generateSync();
                user.last_login = moment().format('YYYY-MM-DD HH:mm:ss');
                user.save();
                res.redirect('/game');
            } else {
                res.render('index', {
                    errMsg: `Player ${user.username} password is incorrect.`,
                    layout: false
                });
            }
        });
    });
});

app.post('/signup', (req, res) => {

    if (req.body.username.length < 3) {
        return res.render('signup', {
            errMsg: 'Username is too short. Min 3 chars.',
            layout: false
        });
    }


    if (req.body.username.length > 12) {
        return res.render('signup', {
            errMsg: 'Username is too long. Max 12 chars.',
            layout: false
        });
    }

    if (req.body.password.length < 6) {
        return res.render('signup', {
            errMsg: 'Password is too short. Min 6 chars.',
            layout: false
        });
    }

    if (req.body.username && req.body.password && req.body.charSkin && req.body.type) {
        User.findOne({
            username: req.body.username
        }).then((user) => {
            if (user) {
                return res.render('signup', {
                    errMsg: 'Username already exist.',
                    layout: false
                });
            }
        });
        var newUser = User({
            username: validator.escape(req.body.username),
            password: validator.escape(req.body.password),
            type: validator.escape(req.body.type),
            skin: validator.escape(req.body.charSkin),
            strength: 0,
            dexterity: 0,
            vitality: 0,
            intellect: 0,
            items_dexterity: 0,
            items_intellect: 0,
            items_strength: 0,
            items_vitality: 0,
            fights_lost: 0,
            fights_win: 0,
            createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            last_login: moment().format('YYYY-MM-DD HH:mm:ss'),
            first_login: 0
        });

        newUser.username = newUser.username.charAt(0).toUpperCase() + newUser.username.slice(1);

        if (newUser['type'] === "Melee") {
            newUser['strength'] = 30;
            newUser['dexterity'] = 15;
            newUser['vitality'] = 15;
            newUser['intellect'] = 5;
        }

        if (newUser['type'] === "Magic") {
            newUser['strength'] = 5;
            newUser['dexterity'] = 15;
            newUser['vitality'] = 15;
            newUser['intellect'] = 30;
        }

        if (newUser['type'] === "Ranged") {
            newUser['strength'] = 15;
            newUser['dexterity'] = 30;
            newUser['vitality'] = 15;
            newUser['intellect'] = 5;
        }


        var newBoughtItem = BoughtItem({
            item_id: "5bb124cfc36e3d0dd25b0128",
            item_title: "Ressurect From Graveyard",
            item_price: 140,
            item_img: "/img/market/potions/silvercross.png",
            item_power: 100,
            item_type: "Health",
            username: newUser['username'],
            createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
        });
        newBoughtItem.save();

        bcrypt.hash(newUser['password'], saltRounds, function (err, hash) {
            newUser['password'] = hash;
            newUser.save().then((user) => {
                req.session.userId = user._id;
                res.redirect('/');
            });
        });
    } else {
        return res.render('signup', {
            errMsg: 'All fields are required.',
            layout: false
        });
    }
});

app.get('/game', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            gameContent.getGameContent(user, res);
        });
    }
});

app.get('/logout', function (req, res, next) {
    if (req.session) {
        // delete session object
        req.session.destroy(function (err) {
            if (err) {
                return next(err);
            } else {
                return res.redirect('/');
            }
        });
    }
});

app.get('/alliances-leaderboard', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let userItems = await BoughtItem.find({
        username: user.username
    });
    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();


    Alliance.aggregate([{
            $sort: {
                expCount: -1,
            }
        },
        {
            "$lookup": {
                "from": "alliancemembers",
                "localField": "_id",
                "foreignField": "ally_id",
                "as": "allymembers"
            }
        }
    ]).then((alliances) => {

        res.render('alliances-leaderboard', {
            alliances,
            liveitems,
            fights,
            lostFights,
            userItems,
            user
        });
    });

});

app.get('/leaderboard', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        let user = await User.findById(req.session.userId);
        let allyMember = await AllianceMember.findOne({
            username: user.username
        });
        if (allyMember) {
            var memberAllyCurrent = await Alliance.findById(allyMember.ally_id);
        }

        User.aggregate([{
                $sort: {
                    current_exp: -1,
                    level: 1
                }
            },
            {
                "$lookup": {
                    from: "alliancemembers", // collection name in db
                    localField: "username",
                    foreignField: "username",
                    as: "alliances"
                }
            }
        ]).then(async (users) => {
            let liveitems = await liveItems();
            BoughtItem.find({
                username: user.username
            }).then(async (userItems) => {
                let fights = await liveFights();
                let lostFights = await liveLostFights();
                Message.find().sort('-createdAt').limit(30).then((messages) => {
                    Revive.findOne({
                        username: user.username
                    }).then((revive) => {
                        res.render('leaderboard', {
                            user,
                            users,
                            userItems,
                            liveitems,
                            fights,
                            lostFights,
                            messages,
                            revive,
                            memberAllyCurrent
                        });
                    });
                });
            });
        });
    }
});

app.get('/market', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then(async (user) => {
            let liveitems = await liveItems();
            let fights = await liveFights();
            let lostFights = await liveLostFights();
            Message.find().sort('-createdAt').limit(20).then((messages) => {
                Revive.findOne({
                    username: user.username
                }).then((revive) => {
                    res.render(__dirname + '/views/market/market', {
                        user,
                        revive,
                        liveitems,
                        fights,
                        lostFights,
                        messages
                    });
                });
            });
        });
    }
});

app.get('/market/strength', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            Item.find({
                type: "Strength"
            }).sort('price').then((items) => {
                BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            res.render(__dirname + '/views/market/strength', {
                                user,
                                items,
                                revive,
                                userItems,
                                messages,
                                liveitems,
                                lostFights,
                                fights
                            });
                        });
                    });
                });
            });
        });
    }
});

app.get('/market/intellect', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            Item.find({
                type: "Intellect"
            }).sort('price').then((items) => {
                BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            res.render(__dirname + '/views/market/intellect', {
                                user,
                                revive,
                                items,
                                userItems,
                                messages,
                                fights,
                                lostFights,
                                liveitems
                            });
                        });
                    });
                });
            });
        });
    }
});

app.get('/market/vitality', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            Item.find({
                type: "Vitality"
            }).sort('price').then((items) => {
                BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            res.render(__dirname + '/views/market/vitality', {
                                user,
                                revive,
                                items,
                                userItems,
                                messages,
                                liveitems,
                                fights,
                                lostFights
                            });
                        });
                    });
                });
            });
        });
    }
});

app.get('/market/dexterity', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            Item.find({
                type: "Dexterity"
            }).sort('price').then((items) => {
                BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            res.render(__dirname + '/views/market/dexterity', {
                                user,
                                items,
                                revive,
                                userItems,
                                messages,
                                liveitems,
                                fights,
                                lostFights
                            });
                        });
                    });
                });
            });
        });
    }
});

app.get('/market/potions', (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {
        User.findById(req.session.userId).then((user) => {
            Item.find({
                type: "Health"
            }).sort('price').then((items) => {
                BoughtItem.find({
                    username: user.username
                }).then((userItems) => {
                    Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();
                        Revive.findOne({
                            username: user.username
                        }).then((revive) => {
                            res.render(__dirname + '/views/market/potions', {
                                user,
                                items,
                                revive,
                                userItems,
                                messages,
                                liveitems,
                                fights,
                                lostFights
                            });
                        });
                    });
                });
            });
        });
    }
});

app.get('/arena', async (req, res) => {

    if (req.session.userId) {
        User.findById(req.session.userId).then((user) => {
            if (user.health < 1) {
                return res.redirect('/');
            }

            User.aggregate([{
                    "$match": {
                        "_id": {
                            "$ne": ObjectId(req.session.userId)
                        }
                    }
                },
                {
                    $lookup: {
                        from: "boughtitems", // collection name in db
                        localField: "username",
                        foreignField: "username",
                        as: "boughtitems"
                    }
                },
                {
                    $lookup: {
                        from: "alliancemembers", // collection name in db
                        localField: "username",
                        foreignField: "username",
                        as: "alliance"
                    }
                }
            ]).then((users) => {
                users = shuffle(users);

                User.findById(req.session.userId).then(async (user) => {

                    let allyMember = await AllianceMember.findOne({
                        username: user.username
                    });
                    if (allyMember) {
                        var memberAllyCurrent = await Alliance.findById(allyMember.ally_id);
                    }

                    BoughtItem.find({
                        username: user.username
                    }).then(async (userItems) => {
                        let liveitems = await liveItems();
                        let fights = await liveFights();
                        let lostFights = await liveLostFights();

                        Message.find().sort('-createdAt').limit(20).then((messages) => {
                            Revive.findOne({
                                username: user.username
                            }).then((revive) => {
                                res.render(__dirname + '/views/arena/index', {
                                    user,
                                    users,
                                    userItems,
                                    revive,
                                    messages,
                                    liveitems,
                                    fights,
                                    lostFights,
                                    memberAllyCurrent
                                });
                            });
                        });
                    });
                });
            });
        });
    } else {
        res.redirect('/');
    }
});

app.get('/arena/fight/user/:username', async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (req.params.username === user.username) {
        return res.redirect('/arena');
    }


    const target = await User.findOne({
        username: req.params.username
    });
    const fights = await TempFight.find({
        $and: [{
            user: user.username
        }, {
            target: target.username
        }]
    });
    if (fights.length > 0) {
        return res.redirect('/arena');
    } else {
        const battleId = uuid4();
        const newtempFight = TempFight({
            target: target.username,
            user: user.username,
            code: battleId
        });
        await newtempFight.save();
    }


    if (req.session.userId) {
        User.findOne({
            username: req.params.username
        }).then((enemy) => {
            if (enemy) {
                User.findById(req.session.userId).then((user) => {
                    BoughtItem.find({
                        username: user.username
                    }).then((userItems) => {
                        BoughtItem.find({
                            username: enemy.username
                        }).then(async (enemyItems) => {
                            let liveitems = await liveItems();
                            let fights = await liveFights();
                            let lostFights = await liveLostFights();
                            Message.find().sort('-createdAt').limit(20).then((messages) => {
                                Revive.findOne({
                                    username: user.username
                                }).then((revive) => {
                                    res.render(__dirname + '/views/arena/battle', {
                                        messages,
                                        revive,
                                        user,
                                        enemy,
                                        userItems,
                                        enemyItems,
                                        liveitems,
                                        fights,
                                        lostFights
                                    });
                                });
                            });



                        });
                    });
                });
            } else {
                return res.redirect('/');
            }
        });
    } else {
        return res.redirect('/');
    }
});

app.get('/character/:username', async (req, res) => {
    if (!req.session.userId) {
        res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    } else {

        let user = await User.findOne({
            username: req.params.username
        });

        let allyMember = await AllianceMember.findOne({
            username: user.username
        });
        if (allyMember) {
            var memberAlly = await Alliance.findById(allyMember.ally_id);
        }

        User.findOne({
            username: req.params.username
        }).then((userProfile) => {
            if (userProfile) {
                User.findById(req.session.userId).then((user) => {
                    AchievementCompleted.find({
                        user_id: userProfile._id
                    }).then((achvs) => {
                        BoughtItem.find({
                            username: userProfile.username
                        }).then((items) => {
                            BoughtItem.find({
                                username: user.username
                            }).then((userItems) => {
                                Message.find().sort('-createdAt').limit(20).then(async (messages) => {
                                    let liveitems = await liveItems();
                                    let fights = await liveFights();
                                    let lostFights = await liveLostFights();

                                    Revive.findOne({
                                        username: user.username
                                    }).then((revive) => {
                                        res.render('profile', {
                                            userProfile,
                                            user,
                                            items,
                                            userItems,
                                            messages,
                                            liveitems,
                                            revive,
                                            fights,
                                            lostFights,
                                            achvs,
                                            memberAlly
                                        });
                                    });



                                });
                            });
                        });
                    });
                });
            } else {
                res.redirect('/');
            }
        });
    }
});

app.get('/quests', (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }
    User.findById(req.session.userId).then((user) => {
        BoughtItem.find({
            username: user.username
        }).then((userItems) => {
            BoughtItem.find().sort('-createdAt').limit(23).then((liveitems) => {
                Fight.find().sort('-createdAt').limit(26).then((fights) => {
                    LostFight.find().sort('-createdAt').limit(63).then((lostFights) => {
                        Quest.find().then((quests) => {
                            ActiveQuest.find({
                                user_id: req.session.userId
                            }).then((userQuest) => {
                                res.render(__dirname + '/views/quests/index', {
                                    user,
                                    userItems,
                                    liveitems,
                                    fights,
                                    lostFights,
                                    quests,
                                    userQuest,
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});


app.get('/quests/id/:id', (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    User.findById(req.session.userId).then((user) => {
        BoughtItem.find({
            username: user.username
        }).then((userItems) => {
            BoughtItem.find().sort('-createdAt').limit(23).then((liveitems) => {
                Fight.find().sort('-createdAt').limit(26).then((fights) => {
                    LostFight.find().sort('-createdAt').limit(63).then((lostFights) => {
                        Quest.findById(req.params.id).then((quest) => {
                            ActiveQuest.findOne({
                                user_id: req.session.userId
                            }).then((userQuest) => {
                                res.render(__dirname + '/views/quests/quest', {
                                    user,
                                    userItems,
                                    liveitems,
                                    fights,
                                    lostFights,
                                    quest,
                                    userQuest,
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});


app.get('/quest/begin/id/:id', (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.redirect('/');
    }

    ActiveQuest.findOne({
        user_id: req.session.userId
    }).then((userQuest) => {
        if (userQuest) {
            if (userQuest.quest_id === req.params.id) {
                return res.redirect('/');
            }
        } else {

            var newActiveQuest = ActiveQuest({
                quest_id: req.params.id,
                user_id: req.session.userId,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            });

            newActiveQuest.save();

            return res.redirect('zdarova');

        }
    });

});

app.get('/create-alliance', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    user = await User.findById(req.session.userId);
    memberOfAlly = await AllianceMember.findOne({
        username: user.username
    });

    if (memberOfAlly) {
        return res.redirect('/');
    }

    BoughtItem.find().sort('-createdAt').limit(23).then((liveitems) => {
        Fight.find().sort('-createdAt').limit(26).then((fights) => {
            LostFight.find().sort('-createdAt').limit(63).then((lostFights) => {
                res.render(__dirname + '/views/alliance/create', {
                    liveitems,
                    lostFights,
                    fights
                });
            });
        });
    });

});

app.post('/create-alliance', (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    User.findById(req.session.userId).then((user, err) => {
        var newAlliance = Alliance({
            title: req.body.title,
            leader: user.username,
            description: req.body.description,
            bank: 0,
            expCount: user.current_exp,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });

        var newMember = AllianceMember({
            user_id: user._id,
            username: user.username,
            ally_id: newAlliance._id,
            ally_title: newAlliance.title,
            money_borrow: 0,
            money_added: 0,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });

        Alliance.findOne({
            leader: user.username
        }).then((alliance) => {
            if (alliance === true) {
                renderView.renderViewAllianceError(res);
            }

            newMember.save();
            newAlliance.save().then(() => {

                return res.redirect('/alliance-information');

            }).catch((err) => {
                renderView.renderViewAllianceError(res);
            });

        });
    });

});

app.get('/alliance-information', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);


    if (!user) {
        return res.redirect('/');
    }

    const allianceMember = await AllianceMember.findOne({
        username: user.username
    });
    if (allianceMember) {
        const alliance = await Alliance.findById(allianceMember.ally_id);
        let messages = await AllianceMessage.find({
            ally_id: alliance._id
        }).sort('-createdAt').limit(30);

        if (alliance) {

            const membersAlliance = await AllianceMember.find({
                ally_id: alliance._id
            });

            let leader = await User.findOne({
                username: alliance.leader
            });

            AllianceMember.aggregate([{
                    "$match": {
                        "ally_id": mongoose.Types.ObjectId(alliance._id)
                    }
                },
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "users"
                    }
                }
            ]).then(async (members) => {

                let liveitems = await liveItems();
                let fights = await liveFights();
                let lostFights = await liveLostFights();
                User.findById(req.session.userId).then((user) => {
                    return res.render(__dirname + '/views/alliance/info', {
                        alliance,
                        user,
                        leader,
                        messages,
                        membersAlliance,
                        members,
                        liveitems,
                        fights,
                        lostFights
                    });
                });


            });
        } else {
            return res.redirect('/');
        }

    } else {
        return res.redirect('/');
    }
});

app.get('/alliances', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let member = await AllianceMember.findOne({
        username: user.username
    });

    let userRequests = await AllianceMemberRequest.find({
        username: user.username
    });
    Alliance.aggregate([{
            $sort: {
                expCount: -1,
            }
        },
        {
            "$lookup": {
                "from": "alliancemembers",
                "localField": "_id",
                "foreignField": "ally_id",
                "as": "allymembers"
            }
        }
    ]).then(async (alliances) => {
        let liveitems = await liveItems();
        let fights = await liveFights();
        let lostFights = await liveLostFights();
        res.render(__dirname + '/views/alliance/index', {
            alliances,
            lostFights,
            fights,
            liveitems,
            userRequests,
            member
        });
    });
});

app.get('/leave-alliance', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let memberOfAlly = await AllianceMember.findOne({
        username: user.username
    });
    let allmembersofalliance = await AllianceMember.find({
        ally_id: memberOfAlly.ally_id
    });
    let alliance = await Alliance.findById(memberOfAlly.ally_id);

    if (memberOfAlly) {
        memberOfAlly.remove(async () => {
            if (allmembersofalliance.length === 1) {
                alliance.remove();
            }
            if (memberOfAlly.username === alliance.leader) {
                await alliance.remove();

                await AllianceMember.deleteMany({
                    ally_id: alliance._id
                }).then(() => {
                    console.log('deleted');
                });
            }
        });
        return res.redirect('/alliances');
    } else {
        return res.redirect('/');
    }

});

app.get('/join-alliance/:title', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let title = req.params.title;
    let user = await User.findById(req.session.userId);

    const alliance = await Alliance.findOne({
        title: title
    });

    if (alliance) {

        let newMemberRequest = await AllianceMemberRequest({
            user_id: user._id,
            username: user.username,
            ally_id: alliance._id,
            ally_title: alliance.title,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });

        let userExists = await AllianceMember.findOne({
            username: user.username
        });
        if (userExists) {
            res.redirect('/alliances');
            return console.log('member of alliance');
        }

        let userRequested = await AllianceMemberRequest.find({
            username: user.username,
            ally_id: alliance._id
        });
        if (userRequested.length > 0) {
            res.redirect('/alliances');
            return console.log('Already requested');
        }

        newMemberRequest.save().then((member) => {
            // res.redirect('/alliance-information');
            res.redirect('/alliances');
            return console.log(member);
        });

    } else {
        return res.redirect('/');
    }

});

app.get('/new-member-requests', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    const leader = await User.findById(req.session.userId);
    const alliance = await Alliance.findOne({
        leader: leader.username
    });

    if (alliance) {
        return res.redirect('/accept-new-members');
    } else {
        return res.redirect('/alliance-information');
    }

});

app.get('/accept-new-members', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    const leader = await User.findById(req.session.userId);
    const alliance = await Alliance.findOne({
        leader: leader.username
    });

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();

    if (alliance) {
        // let memberRequests = await AllianceMemberRequest.find({ally_id: alliance._id});

        AllianceMemberRequest.aggregate([{
                "$match": {
                    "ally_id": mongoose.Types.ObjectId(alliance._id)
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "users"
                }
            }
        ]).then((members) => {

            res.render(__dirname + '/views/alliance/accept-request.html', {
                members,
                lostFights,
                fights,
                liveitems
            });
        });
    } else {
        return res.redirect('/');
    }
});

app.get('/accept-user-to-alliance/:username', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let username = req.params.username;

    const leader = await User.findById(req.session.userId);
    const alliance = await Alliance.findOne({
        leader: leader.username
    });
    let requestMember = await AllianceMemberRequest.findOne({
        username: username,
        ally_id: alliance._id
    });

    let user = await User.findOne({
        username: username
    });

    if (alliance && requestMember && alliance._id.equals(requestMember.ally_id)) {
        console.log(user);

        let newMember = AllianceMember({
            user_id: ObjectId(user._id),
            username: user.username,
            experience: user.current_exp,
            ally_id: ObjectId(alliance._id),
            ally_title: alliance.title,
            money_borrow: 0,
            money_added: 0,
            createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
        });

        alliance.expCount = alliance.expCount + newMember.experience;
        alliance.save();
        newMember.save();

        AllianceMemberRequest.deleteMany({
            username: username
        }).then(() => {
            console.log('deleted');
        });

        res.redirect('/accept-new-members');
    } else {
        res.redirect('/alliance-information');
        console.log(requestMember);

    }

});

app.get('/decline-user-request-to-alliance/:username', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let username = req.params.username;
    let leader = await User.findById(req.session.userId);
    let alliance = await Alliance.findOne({
        leader: leader.username
    });
    let user = await User.findOne({
        username: username
    });
    let memberRequest = await AllianceMemberRequest.findOne({
        username: user.username,
        ally_id: alliance._id
    });
    if (memberRequest.ally_id && alliance) {
        if (alliance._id.equals(memberRequest.ally_id)) {
            memberRequest.remove();
            res.redirect('/accept-new-members');
        }
    } else {
        res.redirect('/accept-new-members');
    }

});

app.get('/kick-member-from-alliance/:username', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let username = req.params.username;
    let leader = await User.findById(req.session.userId);
    let alliance = await Alliance.findOne({
        leader: leader.username
    });
    let memberofalliance = await AllianceMember.findOne({
        username: username,
        ally_id: alliance._id
    });

    if (memberofalliance.username === alliance.leader) {
        alliance.remove();
        await AllianceMember.deleteMany({
            ally_id: alliance._id
        });
        res.redirect('/');
    }

    if (alliance && memberofalliance.ally_id.equals(alliance._id)) {
        memberofalliance.remove();
        alliance.expCount = alliance.expCount - memberofalliance.experience;
        alliance.save();
        res.redirect('/alliance-members');
    } else {
        console.log(memberofalliance.ally_id, alliance._id);
        res.redirect('/alliance-information');
    }
});

app.post('/borrow-money-from-alliance', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    const user = await User.findById(req.session.userId);
    const allianceMember = await AllianceMember.findOne({
        username: user.username
    });
    const alliance = await Alliance.findById(allianceMember.ally_id);
    let bank = alliance.bank;
    let money = req.body.money;

    if (bank < money) {
        return res.redirect('/alliance-information');
    } else if (money === 0 || money < 0 || money === bank) {
        return res.redirect('/alliance-information');
    } else {
        bank = parseInt(bank) - parseInt(money);
        alliance.bank = bank;
        alliance.save();
        user.gold = user.gold + parseInt(money);
        user.save();
        allianceMember.money_borrow = money;
        allianceMember.save();
        return res.redirect('/');
    }

});

app.post('/fill-the-bank-of-alliance', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }
    const user = await User.findById(req.session.userId);
    const allianceMember = await AllianceMember.findOne({
        username: user.username
    });
    const alliance = await Alliance.findById(allianceMember.ally_id);
    let bank = alliance.bank;
    let money = req.body.money;

    if (money < 0 || money === 0) {
        return res.redirect('/alliance-information');
    }

    if (money > 0 && user.gold > money || user.gold === money) {
        bank = parseInt(bank) + parseInt(money);
        alliance.bank = bank;
        alliance.save();
        user.gold = user.gold - parseInt(money);
        user.save();
        allianceMember.money_added = money;
        allianceMember.save();
        return res.redirect('/alliance-information');
    } else {
        return res.redirect('/alliance-information');
    }

});

app.get('/update-alliance-description', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }
    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();
    let user = await User.findById(req.session.userId);

    let memberOfAlliance = await AllianceMember.findOne({
        username: user.username
    });

    let alliance = await Alliance.findOne({
        leader: memberOfAlliance.username
    });

    if (alliance) {
        return res.render(__dirname + '/views/alliance/update-desc.html', {
            alliance,
            liveitems,
            fights,
            lostFights
        });
    } else {
        return res.redirect('/alliance-information');
    }
});

app.post('/update-alliance-description', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);

    let memberOfAlliance = await AllianceMember.findOne({
        username: user.username
    });

    let alliance = await Alliance.findOne({
        leader: memberOfAlliance.username
    });

    if (alliance) {
        let description = req.body.description;

        Alliance.findById(alliance._id).then((alliance) => {
            alliance.description = nl2br(description);
            alliance.save();
            return res.redirect('/alliance-information');
        });
    }
});

app.get('/alliance-members', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);

    let leader = await AllianceMember.findOne({
        username: user.username
    });

    let alliance = await Alliance.findOne({
        leader: leader.username
    });

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();

    if (alliance) {

        AllianceMember.aggregate([{
                "$match": {
                    "ally_id": mongoose.Types.ObjectId(alliance._id)
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "users"
                }
            }
        ]).then((members) => {

            return res.render(__dirname + '/views/alliance/member.html', {
                members,
                liveitems,
                lostFights,
                fights
            });
        });
    } else {
        return res.redirect('/alliance-information');
    }
});


app.get('/alliance-boss-fight', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let memberOfAlliance = await AllianceMember.findOne({
        username: user.username
    });

    if (memberOfAlliance) {
        return res.render(__dirname + '/views/alliance/boss-fight.html');
    } else {
        return res.redirect('/');
    }

});


app.get('/alliance-boss-fight-one', async (req, res) => {
    let players = [];
    players.push(req.session.userId);
    console.log(players);
});


app.get('/create-lobby', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }
    let user = await User.findById(req.session.userId);
    let alreadyLobby = await UserLobby.findOne({
        username: user.username
    });

    if (alreadyLobby) {
        return res.redirect('/lobby');
    }

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();

    res.render(__dirname + '/views/lobby/create');
});

app.post('/create-lobby', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);

    let newLobby = await Lobby({
        title: req.body.title,
        password: req.body.password,
        leader: user.username,
        searching: 0,
        in_game: 0,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss')
    });

    let alliance = await AllianceMember.findOne({
        username: user.username
    });

    if (alliance) {
        let newUserInLobby = UserLobby({
            username: user.username,
            lobby_id: newLobby._id,
            lobby_title: newLobby.title,
            alliance: alliance.ally_title,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });
        newUserInLobby.save();
        newLobby.save();
        return res.redirect('/lobby/' + newLobby._id);
    } else {
        let newUserInLobby = UserLobby({
            username: user.username,
            lobby_id: newLobby._id,
            lobby_title: newLobby.title,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });
        newUserInLobby.save();
        newLobby.save();
        return res.redirect('/lobby/' + newLobby._id);
    }

});

app.get('/join-lobby', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();
    let user = await User.findById(req.session.userId);

    res.render(__dirname + '/views/lobby/lobby', {
        liveitems,
        fights,
        lostFights,
        user
    });
});

app.get('/lobby/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();

    let id = req.params.id;

    let players = [];

    let user = await User.findById(req.session.userId);

    let allyMember = await AllianceMember.findOne({
        username: user.username
    });
    if (allyMember) {
        var memberAllyCurrent = await Alliance.findById(allyMember.ally_id);
    }

    let userItems = await BoughtItem.find({
        username: user.username
    });

    Lobby.findById(id).then(async (lobby) => {
        if (lobby) {
            let lobbyMessages = await LobbyMessage.find({
                lobby_id: ObjectId(id)
            }).sort('-createdAt');

            let UsersInLobbyCount = await UserLobby.find({
                lobby_title: lobby.title
            });

            let joinedPlayers = UsersInLobbyCount.length;

            let userInThisLobby = await UserLobby.findOne({username: user.username});


            UserLobby.aggregate([{
                    "$match": {
                        "lobby_id": ObjectId(lobby._id)
                    }
                },
                {
                    "$lookup": {
                        "from": "users", // collection name in db
                        "localField": "username",
                        "foreignField": "username",
                        "as": "usersInLobby"
                    }
                }
            ]).then((users) => {

                if(String(lobby._id) === String(userInThisLobby.lobby_id)) {

               return res.render(__dirname + '/views/lobby/index', {
                    liveitems,
                    fights,
                    lostFights,
                    lobby,
                    users,
                    user,
                    memberAllyCurrent,
                    lobbyMessages,
                    joinedPlayers,
                    userItems
                });

            } else {
                res.redirect('/');
            }
            });
        } else {
            return res.redirect('/');
        }
    
    });
});

app.get('/lobby', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    let userLobby = await UserLobby.findOne({
        username: user.username
    });
    if (userLobby) {
        let lobbyId = userLobby.lobby_id;

        if (lobbyId === userLobby.lobby_id) {
            return res.redirect('/lobby/' + lobbyId);
        } else {
            return res.redirect('/');
        }
    } else {
        return res.redirect('/');
    }
});

app.get('/leave-lobby', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    let user = await User.findById(req.session.userId);
    UserLobby.findOneAndRemove({
        username: user.username
    }).then(() => {
        res.redirect('/');
    });
});

app.get('/lobbies', async (req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }
    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();
    let user = await User.findById(req.session.userId);


    let allyMember = await AllianceMember.findOne({
        username: user.username
    });
    if (allyMember) {
        var memberAllyCurrent = await Alliance.findById(allyMember.ally_id);
    }

    //let allLobbies = await Lobby.find().sort('-created_at');

    Lobby.aggregate([{
        "$lookup": {
            "from": "userlobbies",
            "localField": "_id",
            "foreignField": "lobby_id",
            "as": "usersinlobby"
        }
    }]).then((lobbies) => {
        res.render(__dirname + '/views/lobby/lobbies', {
            lobbies,
            user,
            lostFights,
            liveitems,
            fights,
            memberAllyCurrent
        });
    });
});

app.get('/match/:id', async(req, res) => {
    if (!req.session.userId) {
        return res.render('index', {
            errMsg: 'You must be logged in to access game page.',
            layout: false
        });
    }

    const MatchId = await req.params.id;

    const match = await Match.findById(MatchId);

    const user = await User.findById(req.session.userId);

    let liveitems = await liveItems();
    let fights = await liveFights();
    let lostFights = await liveLostFights();

    let lobbyOnePlayers = await UserLobby.find({lobby_id: match.lobby_one_id});

    let lobbyTwoPlayers = await UserLobby.find({lobby_id: match.lobby_two_id});

    User.aggregate([
    {
        "$lookup": {
            from: "userlobbies", // collection name in db
            localField: "username",
            foreignField: "username",
            as: "players"
        }
    },
{
    "$lookup": {
        from: "boughtitems", // collection name in db
        localField: "username",
        foreignField: "username",
        as: "playersItems"
    }
},    
    {
        "$match": {
            "players.lobby_id": match.lobby_one_id
        }
    }
]).then((users) => {

    User.aggregate([
        {
            "$lookup": {
                from: "userlobbies", // collection name in db
                localField: "username",
                foreignField: "username",
                as: "playersSecondLobby"
            }
        },
        {
            "$lookup": {
                from: "boughtitems", // collection name in db
                localField: "username",
                foreignField: "username",
                as: "playersSecondLobbyItems"
            }
        },         
        {
            "$match": {
                "playersSecondLobby.lobby_id": match.lobby_two_id
            }
        }
    ]).then((usersSecondLobby) => {

    return res.render(__dirname + '/views/matches/index', {match, users, usersSecondLobby, user, liveitems, fights, lostFights});
});
});
});

var users = 0

io.on('connection', (socket) => {

    let userInfo;

    socket.on('login', (userdata) => {
        socket.handshake.session.userdata = userdata;
        socket.handshake.session.save();
    });


    socket.on('lobby-left', (data) => {

        let userUsername = socket.handshake.session.userdata.username.charAt(0).toUpperCase() + socket.handshake.session.userdata.username.slice(1);

        UserLobby.findOne({
            username: userUsername
        }).then((inLobby) => {

            socket.broadcast.emit('lobby-left-username', {
                username: socket.handshake.session.userdata.username.charAt(0).toUpperCase() + socket.handshake.session.userdata.username.slice(1),
                createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
                lobbyID: data.lobbyID
            });

            Lobby.findById(ObjectId(inLobby.lobby_id)).then((lobby) => {
                lobby.players = lobby.players - 1;
                if(lobby.players === 4) {
                    lobby.searching = 0;
                    lobby.save();
                    socket.emit('stop-searching-for-match', {
                        lobbyID: lobby._id
                    });
                }
            });
        

        });
    });

    socket.on('join-lobby-password', (data) => {
        User.findOne({
            username: data.username
        }).then(async (user) => {
            if (user) {

                let allianceTitle = await AllianceMember.findOne({
                    username: user.username
                });

                let alliance = await AllianceMember.findOne({
                    username: user.username
                });

                let lobbyPassword = data.password;


                var lobby = await Lobby.findOne({
                    'password': lobbyPassword
                });
                if (lobby != null) {

                    let UsersInLobbyCount = await UserLobby.find({
                        lobby_title: lobby.title
                    });

                    let alreadyInLobby = await UserLobby.findOne({
                        username: user.username
                    });

                    if (UsersInLobbyCount.length < 5) {

                        if (alreadyInLobby != null) {

                            let inLobby = UserLobby.findOne({
                                username: user.username
                            });
                            if (inLobby != null) {
                                console.log('You are already in a lobby.');
                            }

                        } else {

                            lobby.players = lobby.players + 1;
                            lobby.save();

                            if (alliance) {
                                let newUserInLobby = UserLobby({
                                    username: user.username,
                                    lobby_id: lobby._id,
                                    lobby_title: lobby.title,
                                    alliance: alliance.ally_title,
                                    token: uidgen.generateSync(),
                                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                });
                                newUserInLobby.save();
                                let playersInLobby = UsersInLobbyCount.length + 1;

                                console.log(playersInLobby);
                                if (playersInLobby === 5) {
                                    io.emit('find-match', {
                                        lobbyID: lobby._id
                                    });
                                }

                                io.emit('join-lobby', {
                                    username: user.username,
                                    level: user.level,
                                    skin: user.skin,
                                    alliance: allianceTitle.ally_title,
                                    lobbyID: newUserInLobby.lobby_id,
                                    playerCount: UsersInLobbyCount.length + 1,
                                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                });


                                socket.emit("redirect-to-lobby", {
                                    lobbyID: newUserInLobby.lobby_id
                                });
                            } else {
                                let newUserInLobby = UserLobby({
                                    username: user.username,
                                    lobby_id: lobby._id,
                                    lobby_title: lobby.title,
                                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                });
                                newUserInLobby.save();
                                let playersInLobby = UsersInLobbyCount.length + 1;

                                if (playersInLobby === 5) {
                                    io.emit('find-match');
                                }

                                io.emit('join-lobby', {
                                    username: user.username,
                                    level: user.level,
                                    skin: user.skin,
                                    alliance: 'None',
                                    lobbyID: newUserInLobby.lobby_id,
                                    playerCount: UsersInLobbyCount.length + 1,
                                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                });

                                socket.emit("redirect-to-lobby", {
                                    lobbyID: newUserInLobby.lobby_id
                                });
                            }
                        }
                    } else {
                        console.log('Works.');
                    }

                } else {
                    console.log('Lobby not found');
                }


            } else {
                console.log('User not found');
            }

        });

    });

    socket.on('searching-for-match', async (data) => {

        let leaderUsername = socket.handshake.session.userdata.username.charAt(0).toUpperCase() + socket.handshake.session.userdata.username.slice(1);

        Lobby.findOne({
            leader: leaderUsername
        }).then((lobby) => {
            lobby.searching = 1;
            lobby.save();
            console.log(lobby);
            io.emit('searching-for-match', {
                lobbyID: lobby._id
            });

            Lobby.findOne({searching: 1, title: {$ne: lobby.title}, in_game: 0}).then((enemyLobby) => {
                if(enemyLobby){
                    let newMatch = Match({
                        lobby_one_title: lobby.title,
                        lobby_one_id: lobby._id,
                        lobby_two_title: enemyLobby.title,
                        lobby_two_id: enemyLobby._id,
                        created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                    });

                    newMatch.save();

                    lobby.in_game = newMatch._id;
                    lobby.save();

                    enemyLobby.in_game = newMatch._id;
                    enemyLobby.save();

                    io.emit('match-found', {
                        lobbyID: lobby._id,
                        enemyID: enemyLobby._id,
                        matchID: newMatch._id
                    });

                    io.emit('redirect-to-match', {
                        
                    });

                }
            });
        });
    });

    socket.on('cancel-searching', () => {
        let leaderUsername = socket.handshake.session.userdata.username.charAt(0).toUpperCase() + socket.handshake.session.userdata.username.slice(1);

        Lobby.findOne({leader: leaderUsername}).then((lobby) => {
            lobby.searching = 0;
            lobby.save();
            console.log('Canceled.');
        });
    });

    socket.on('lobby-msg', (data) => {
        User.findOne({
            username: data.username
        }).then((user) => {
            let memberoflobby = UserLobby.findOne({
                username: user.username
            });
            if (memberoflobby) {

                if (data.message.length < 3) {
                    return console.log('Message is too short');
                }
                if (data.message.length >= 3) {
                    var message = LobbyMessage({

                        username: user.username,
                        message: validator.escape(data.message),
                        lobby_id: ObjectId(data.lobbyId),
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    let lobby = Lobby.findById(message.lobby_id);
                    if (lobby) {
                        if (lobby._id === memberoflobby.lobby_id) {
                            message.save();
                        } else {
                            return console.log('Youre not a member of lobby');
                        }
                    } else {
                        return console.log('Lobby doesnt exist');
                    }
                    io.emit('lobby-msg-sent', {
                        username: user.username,
                        message: validator.escape(data.message),
                        lobbyId: data.lobbyId,
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                } else {
                    console.log('Your message is too complicated for server. Please stop.');
                }
            } else {
                console.log('Dont do stupid things');
            }

        });
    });


    socket.on('ally-msg', (data) => {
        User.findOne({
            username: data.username
        }).then((user) => {
            let memberofalliance = AllianceMember.findOne({
                username: user.username
            });
            if (memberofalliance) {
                if (data.message.length < 3) {
                    return console.log('Message is too short');
                }
                if (data.message.length >= 3) {
                    var message = AllianceMessage({

                        username: user.username,
                        message: validator.escape(data.message),
                        ally_id: ObjectId(data.allyId),
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    let ally = Alliance.findById(message.ally_id);
                    if (ally) {
                        if (ally._id === memberofalliance.ally_id) {
                            message.save();
                        } else {
                            return console.log('Youre not a member of alliance');
                        }
                    } else {
                        return console.log('Alliance doesnt exist');
                    }
                    io.emit('ally-msg-sent', {
                        username: user.username,
                        message: validator.escape(data.message),
                        allyId: data.allyId,
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                } else {
                    console.log('Your message is too complicated for server. Please stop.');
                }
            } else {
                console.log('Stop doing stupid things already.');
            }
        });
    });



    socket.on('upgrade-str', (data) => {
        User.findById(data.userid).then((user) => {
            if (user && user.upgradePoints > 0) {
                user.strength = user.strength + 1;
                user.upgradePoints = user.upgradePoints - 1;
                user.save();
            } else {
                console.log('Cheating');
            }
        });
    });

    socket.on('upgrade-dex', (data) => {
        User.findById(data.userid).then((user) => {
            if (user && user.upgradePoints > 0) {
                user.dexterity = user.dexterity + 1;
                user.upgradePoints = user.upgradePoints - 1;
                user.save();
            } else {
                console.log('Cheating');
            }
        });
    });

    socket.on('upgrade-vit', (data) => {
        User.findById(data.userid).then((user) => {
            if (user && user.upgradePoints > 0) {
                user.vitality = user.vitality + 1;
                user.upgradePoints = user.upgradePoints - 1;
                user.save();
            } else {
                console.log('Cheating');
            }
        });
    });

    socket.on('upgrade-int', (data) => {
        User.findById(data.userid).then((user) => {
            if (user && user.upgradePoints > 0) {
                user.intellect = user.intellect + 1;
                user.upgradePoints = user.upgradePoints - 1;
                user.save();
            } else {
                console.log('Cheating');
            }
        });
    });

    socket.on('item-bought-str', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        User.findById(data.userId).then((user) => {
            if (user.items_strength === 100) {
                return console.log('Your strength is already maximum.');
            }
            User.findOne({
                username: user.username
            }).then((realUser) => {
                Item.findById(data.itemId).then((item) => {
                    if (item) {
                        if (user.gold > item.price || user.gold === item.price) {
                            var newBoughtItem = BoughtItem({
                                item_id: item._id,
                                item_title: item.title,
                                item_price: item.price,
                                //item_description: data.item_description,
                                item_img: item.img,
                                item_power: item.power,
                                item_type: "Strength",
                                username: data.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                            newBoughtItem.save();
                            user.gold = user.gold - item.price;
                            user.items_strength = user.items_strength + item.power;
                            // user.strength = user.strength + item.power;
                            if (user.strength > 100) {
                                user.strength = 100;
                            }
                            if (user.items_strength > 100) {
                                user.items_strength = 100;
                            }
                            user.save();


                            io.emit('item-bought-str', ({
                                item_title: data.item_title,
                                item_img: data.item_img,
                                item_price: data.item_price,
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            }));
                            console.log('Item bought successfully');
                        } else {
                            console.log('Not enough gold');
                        }
                    } else {
                        console.log('Item not found.');
                    }
                });

            });
        });
    });

    socket.on('item-bought-intel', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        User.findById(data.userId).then((user) => {
            if (user.items_intellect === 100) {
                return console.log('Your intellect is already maximum.');
            }

            User.findOne({
                username: user.username
            }).then((realUser) => {
                Item.findById(data.itemId).then((item) => {
                    if (item) {
                        if (user.gold > item.price || user.gold === item.price) {
                            var newBoughtItem = BoughtItem({
                                item_id: item._id,
                                item_title: item.title,
                                item_price: item.price,
                                //item_description: data.item_description,
                                item_img: item.img,
                                item_power: item.power,
                                item_type: "Intellect",
                                username: data.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                            newBoughtItem.save();
                            user.gold = user.gold - item.price;
                            user.items_intellect = user.items_intellect + item.power;
                            //user.intellect = user.intellect + item.power;
                            if (user.intellect > 100) {
                                user.intellect = 100;
                            }
                            if (user.items_intellect > 100) {
                                user.items_intellect = 100;
                            }
                            user.save();


                            io.emit('item-bought-intel', ({
                                item_title: data.item_title,
                                item_img: data.item_img,
                                item_price: data.item_price,
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            }));
                            console.log('Item bought successfully');

                        } else {
                            console.log('Not enough gold');
                        }
                    } else {
                        console.log('Item not found');
                    }
                });
            });
        });
    });

    socket.on('item-bought-vit', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        User.findById(data.userId).then((user) => {
            if (user.items_vitality === 100) {
                return console.log('Your vitality is already maximum.');
            }

            User.findOne({
                username: user.username
            }).then((realUser) => {
                Item.findById(data.itemId).then((item) => {
                    if (item) {
                        if (user.gold > item.price || user.gold === item.price) {

                            var newBoughtItem = BoughtItem({
                                item_id: item._id,
                                item_title: item.title,
                                item_price: item.price,
                                //item_description: data.item_description,
                                item_img: item.img,
                                item_power: item.power,
                                item_type: "Vitality",
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                            newBoughtItem.save();
                            user.gold = user.gold - item.price;
                            user.items_vitality = user.items_vitality + item.power;
                            // user.vitality = user.vitality + item.power;
                            if (user.vitality > 100) {
                                user.vitality = 100;
                            }
                            if (user.items_vitality > 100) {
                                user.items_vitality = 100;
                            }
                            user.save();


                            io.emit('item-bought-vit', ({
                                item_title: data.item_title,
                                item_img: data.item_img,
                                item_price: data.item_price,
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            }));
                        } else {
                            console.log('Not enough gold');
                        }
                    } else {
                        console.log('Item not found');
                    }
                });
            });
        });
    });

    socket.on('item-bought-dex', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        User.findById(data.userId).then((user) => {
            if (user.items_dexterity === 100) {
                return console.log('Your dexterity is already maximum.');
            }
            User.findOne({
                username: user.username
            }).then((realUser) => {
                Item.findById(data.itemId).then((item) => {
                    if (item) {
                        if (user.gold > item.price || user.gold === item.price) {

                            var newBoughtItem = BoughtItem({
                                item_id: item._id,
                                item_title: item.title,
                                item_price: item.price,
                                //item_description: data.item_description,
                                item_img: item.img,
                                item_power: item.power,
                                item_type: "Dexterity",
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                            newBoughtItem.save();
                            user.gold = user.gold - item.price;
                            user.items_dexterity = user.items_dexterity + item.power;
                            //user.dexterity = user.dexterity + user.items_dexterity;
                            if (user.dexterity > 100) {
                                user.dexterity = 100;
                            }
                            if (user.items_dexterity > 100) {
                                user.items_dexterity = 100;
                            }
                            user.save();

                            io.emit('item-bought-dex', ({
                                item_title: data.item_title,
                                item_img: data.item_img,
                                item_price: data.item_price,
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            }));
                        } else {
                            console.log('Not enough gold');
                        }
                    } else {
                        console.log('Item not found');
                    }
                });
            });
        });
    });

    socket.on('item-bought-pot', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }

        User.findById(data.userId).then((user) => {
            User.findOne({
                username: user.username
            }).then((realUser) => {
                Item.findById(data.itemId).then((item) => {
                    if (item) {
                        if (user.gold > item.price || user.gold === item.price) {

                            var newBoughtItem = BoughtItem({
                                item_id: item._id,
                                item_title: item.title,
                                item_price: item.price,
                                //item_description: data.item_description,
                                item_img: item.img,
                                item_power: item.power,
                                item_type: "Health",
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                            newBoughtItem.save();
                            user.gold = user.gold - item.price;
                            user.save();
                            var item = Item.findById(data.itemId).then((item) => {
                                var user = User.findOne({
                                    username: data.username
                                }).then((user) => {
                                    user.gold = user.gold - item.price;
                                    user.save();
                                });
                            });
                            io.emit('item-bought-pot', ({
                                item_title: data.item_title,
                                item_img: data.item_img,
                                item_price: data.item_price,
                                username: realUser.username,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            }));
                        } else {
                            console.log('Not enough gold');
                        }
                    } else {
                        console.log('Item not found');
                    }
                });
            });
        });
    });

    socket.on('eat-it', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        User.findOne({
            username: data.username
        }).then((user) => {
            if (user.health === 100) {
                return console.log('Your health is full.');
            }
        });
        BoughtItem.findByIdAndRemove(data.itemId).then((item) => {
            if (item) {
                User.findOne({
                    username: item.username
                }).then((user) => {
                    user.health = user.health + item.item_power;
                    if (user.health > 100) {
                        user.health = 100;
                        user.save();
                    }
                    user.save();
                });
            } else {
                console.log('Item not found');
            }
        });
    });

    socket.on('sell-item', (data) => {
        if (!ObjectId.isValid(data.itemId)) {
            return console.log('Item not found.');
        }
        BoughtItem.findByIdAndRemove(data.itemId).then((item) => {
            if (item) {
                User.findOne({
                    username: item.username
                }).then((user) => {

                    user.gold = user.gold + item.item_price;
                    if (item.item_type === "Dexterity") {

                        user.items_dexterity = user.items_dexterity - item.item_power;
                        BoughtItem.find({
                            $and: [{
                                username: user.username
                            }, {
                                item_type: "Dexterity"
                            }]
                        }).then((userItems) => {
                            var power = userItems.reduce((total, item) => total + item.item_power, 0)
                            user.items_dexterity = power;
                            console.log(power);
                            user.save();
                            socket.emit('currentItemDex', {
                                currentItemDex: power
                            });
                        });
                    }

                    if (item.item_type === "Strength") {

                        user.items_strength = user.items_strength - item.item_power;
                        BoughtItem.find({
                            $and: [{
                                username: user.username
                            }, {
                                item_type: "Strength"
                            }]
                        }).then((userItems) => {
                            var power = userItems.reduce((total, item) => total + item.item_power, 0)
                            user.items_strength = power;
                            console.log(power);
                            user.save();
                            socket.emit('currentItemStr', {
                                currentItemStr: power
                            });
                        });
                    }
                    if (item.item_type === "Vitality") {

                        user.items_vitality = user.items_vitality - item.item_power;
                        BoughtItem.find({
                            $and: [{
                                username: user.username
                            }, {
                                item_type: "Vitality"
                            }]
                        }).then((userItems) => {
                            var power = userItems.reduce((total, item) => total + item.item_power, 0)
                            user.items_vitality = power;
                            console.log(power);
                            user.save();
                            socket.emit('currentItemVit', {
                                currentItemVit: power
                            });
                        });
                    }
                    if (item.item_type === "Intellect") {

                        user.items_intellect = user.items_intellect - item.item_power;
                        BoughtItem.find({
                            $and: [{
                                username: user.username
                            }, {
                                item_type: "Intellect"
                            }]
                        }).then((userItems) => {
                            var power = userItems.reduce((total, item) => total + item.item_power, 0)
                            user.items_intellect = power;
                            console.log(power);
                            user.save();
                            socket.emit('currentItemInt', {
                                currentItemInt: power
                            });
                        });
                    }
                    if (item.item_price > 500) {
                        achievements.getAchievementCompleted(user._id, ObjectId("5bf4a6dde1f97d04fc655f34"));
                        achievements.getAchievement(user, ObjectId("5bf4a6dde1f97d04fc655f34"));

                        AchievementCompleted.find({
                            $and: [{
                                user_id: user._id
                            }, {
                                achievement_id: ObjectId("5bf4a6dde1f97d04fc655f34")
                            }]
                        }).then((result) => {
                            if (result.length > 0) {
                                console.log('You cannot get reward for completed achievement.');
                            } else {
                                return socket.emit('richer-than-ever');
                            }
                        });

                    }
                    console.log('Sold');
                });

            } else {
                console.log('Item not found');
            }

        });

    });

    socket.on('fight-lost', (data) => {
        User.findOne({
            username: data.username
        }).then((user) => {
            if (user) {
                user.health = 0;
                user.fights_lost = user.fights_lost + 1;
                user.save();
            } else {
                return console.log('user not found');
            }
        });
    });

    socket.on('lost-fight', (data) => {
        User.findOne({
            username: data.username
        }).then((user) => {
            User.findOne({
                username: data.enemyname
            }).then((enemy) => {
                if (user && enemy) {

                    TempFight.findOneAndRemove({
                        user: user.username
                    }).then((f, e) => {
                        if (e) {
                            return console.log(e);
                        }
                    });

                    newLostFight = LostFight({
                        username: data.username,
                        enemyname: data.enemyname,
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    newLostFight.save();
                } else {
                    return console.log('user not found');
                }



                AllianceMember.findOne({
                    username: user.username
                }).then((userally) => {
                    AllianceMember.findOne({
                        username: enemy.username
                    }).then((enemyally) => {
                        if (userally && enemyally) {
                            io.emit('lost-fight', {
                                username: data.username,
                                enemyname: data.enemyname,
                                useralliance: userally.ally_title,
                                enemyalliance: enemyally.ally_title,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                        } else if (userally) {
                            io.emit('lost-fight', {
                                username: data.username,
                                enemyname: data.enemyname,
                                useralliance: userally.ally_title,
                                enemyalliance: "",
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                        } else if (enemyally) {
                            io.emit('lost-fight', {
                                username: data.username,
                                enemyname: data.enemyname,
                                useralliance: "",
                                enemyalliance: enemyally.ally_title,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                        }
                    });
                });
            });
        });

    });

    socket.on('escaped-fight', (data) => {
        User.findOne({
            username: data.username
        }).then((user) => {
            TempFight.findOneAndRemove({
                user: user.username
            }).then((fight, err) => {
                if (err) {
                    console.log(err);
                }
            });
            if (user) {
                user.health = data.health;
                user.save();
            } else {
                return console.log('User not found');
            }
        });
    });


    socket.on('message-sent', (data) => {

        User.findOne({
            username: data.username
        }).then((user) => {
            if (user) {
                if (data.message.length < 3) {
                    return console.log('Message is too short');
                }
                if (data.message.length >= 3) {
                    var message = Message({

                        username: user.username,
                        message: validator.escape(data.message),
                        createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                    });
                    message.save();
                    AllianceMember.findOne({
                        username: user.username
                    }).then((useralliance) => {
                        if (useralliance) {
                            io.emit('message-sent', {
                                username: user.username,
                                message: validator.escape(data.message),
                                useralliance: useralliance.ally_title,
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                        } else {
                            io.emit('message-sent', {
                                username: user.username,
                                message: validator.escape(data.message),
                                createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                            });
                        }
                    });
                } else {
                    console.log('Your message is too complicated for server. Please stop.');
                }
            } else {
                console.log('Stop doing stupid things already.');
            }
        });
    });


    var enemyHealth = 100;

    var isFightFinished = false;

    var requestCount = 0;

    var maxCalls = require('events').EventEmitter.defaultMaxListeners = 30;

    let fiveSeconds = Date.now() + 5000;

    socket.on('attack', (data) => {

        TempFight.findOne({
            user: data.username
        }).then((fight) => {
            User.findOne({
                username: fight.target
            }).then((target) => {
                if (fight && target) {

                    requestCount++;
                    console.log(requestCount++);

                    if (requestCount > maxCalls && Date.now() <= fiveSeconds) {

                        return console.log('Stop spamming');
                    }
                    User.findOne({
                        username: data.username
                    }).then((user) => {
                        if (user) {
                            var userHealth = user.health;

                            var userType = user.type;

                            var userItemStr = user.items_strength;
                            var userItemDex = user.items_dexterity;
                            var userItemVit = user.items_vitality;
                            var userItemInt = user.items_intellect;

                            var userStr = user.strength + userItemStr;
                            var userDex = user.dexterity + userItemDex;
                            var userVit = user.vitality + userItemVit;
                            var userInt = user.intellect + userItemInt;
                            var userLevel = user.level;


                            var enemyType = target.type;

                            var enemyItemStr = target.items_strength;
                            var enemyItemDex = target.items_dexterity;
                            var enemyItemVit = target.items_vitality;
                            var enemyItemInt = target.items_intellect;

                            var enemyStr = target.strength + enemyItemStr;
                            var enemyDex = target.dexterity + enemyItemDex;
                            var enemyVit = target.vitality + enemyItemVit;
                            var enemyInt = target.intellect + enemyItemInt;
                            var enemyLevel = target.level;

                            if (userType === 'Magic' && enemyType === 'Ranged') {

                                var userPower = ((userDex + userInt) / 2) + userStr / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyStr) / 2) + enemyInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Magic' && enemyType === 'Melee') {

                                var userPower = ((userDex + userInt) / 2) + userStr / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((userDex + userStr) / 2) + userInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }

                            if (userType === 'Magic' && enemyType === 'Magic') {

                                var userPower = ((userDex + userInt) / 2) + userStr / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((userDex + userInt) / 2) + userStr / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Ranged' && enemyType === 'Magic') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyInt) / 2) + enemyStr / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Ranged' && enemyType === 'Melee') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyStr) / 2) + enemyInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Ranged' && enemyType === 'Ranged') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyStr) / 2) + enemyInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Melee' && enemyType === 'Magic') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyInt) / 2) + enemyStr / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }



                            if (userType === 'Melee' && enemyType === 'Ranged') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyStr) / 2) + enemyInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            if (userType === 'Melee' && enemyType === 'Melee') {

                                var userPower = ((userDex + userStr) / 2) + userInt / 4;
                                var userDamage = Math.ceil((((2 * userLevel / 5) + 2) * (userPower * (userDex / (enemyVit + enemyDex)) / 50) + 4) + Math.random(0.9, 1.1));

                                var enemyPower = ((enemyDex + enemyStr) / 2) + enemyInt / 4;
                                var enemyDamage = Math.ceil((((2 * enemyLevel / 5) + 2) * (enemyPower * (enemyDex / (userVit + userDex)) / 50) + 4) + Math.random(0.9, 1.1));
                            }


                            var userDmg = userDamage;
                            var enemyDmg = enemyDamage;
                            var minimum = 0;

                            if (userDmg > 100) {
                                userDmg = 100;
                            }

                            if (enemyDmg > 100) {
                                enemyDmg = 100;
                            }

                            userHealth = userHealth - enemyDmg;
                            enemyHealth = enemyHealth - userDmg;

                            User.findOneAndUpdate({
                                username: data.username
                            }, {
                                $set: {
                                    health: userHealth
                                }
                            }).then(() => {});

                            socket.emit('attack-result', {
                                userDmg: userDmg,
                                enemyDmg: enemyDmg,
                            });

                        } else {
                            return console.log('User not found');
                        }
                    });

                    socket.on('win-fight', (data) => {

                        if (isFightFinished === false && (enemyHealth <= 0 || userHealth <= 0)) {
                            isFightFinished = true;

                            var gold = Math.floor(Math.random() * 10) + 1;
                            var exp = Math.floor(Math.random() * 20) + 10;
                            User.findOne({
                                username: data.username
                            }).then((user) => {
                                User.findOne({
                                    username: data.enemyname
                                }).then((enemy) => {
                                    if (user && enemy) {

                                        if (user.level > 5 && enemy.level < 5) {
                                            gold = 3;
                                            exp = 10;
                                        }

                                        if (user.level < 5 && enemy.level >= 5 && enemy.level < 25) {
                                            exp = exp * 2;
                                            gold = gold * 2;
                                        }

                                        if (user.level < 12 && enemy.level >= 25 && enemy.level < 40) {
                                            exp = exp * 3;
                                            gold = gold * 3;
                                        }

                                        if (user.level < 25 && enemy.level >= 40 && enemy.level < 80) {
                                            exp = exp * 5;
                                            gold = gold * 5;
                                        }

                                        if (user.level < 40 && enemy.level >= 80 && enemy.level < 100) {
                                            exp = exp * 9;
                                            gold = gold * 9;
                                        }

                                        if (user.level < 40 && enemy.level === 100) {
                                            exp = exp * 12;
                                            gold = gold * 12;
                                        }


                                        currentXP = user.current_exp;

                                        if (currentXP + exp > user.exp + 400 && user.level < 100) {
                                            user.exp = user.exp + 400;
                                            user.level = user.level + 1;
                                            user.gold = user.gold + 50;
                                            user.exp = user.exp + exp;
                                            user.upgradePoints = user.upgradePoints + 5;

                                            if (user.level === 10) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a748e1f97d04fc655f35"));
                                                achievements.getAchievement(user, ObjectId("5bf4a748e1f97d04fc655f35"));
                                                socket.emit('level-ten');
                                            }

                                            if (user.level === 20) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a765e1f97d04fc655f36"));
                                                achievements.getAchievement(user, ObjectId("5bf4a765e1f97d04fc655f36"));
                                                socket.emit('level-twenty');
                                            }

                                            if (user.level === 30) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a77ee1f97d04fc655f37"));
                                                achievements.getAchievement(user, ObjectId("5bf4a77ee1f97d04fc655f37"));
                                                socket.emit('level-thirty');
                                            }

                                            if (user.level === 40) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a7b2e1f97d04fc655f38"));
                                                achievements.getAchievement(user, ObjectId("5bf4a7b2e1f97d04fc655f38"));
                                                socket.emit('level-fourty');
                                            }


                                            if (user.level === 50) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a7cae1f97d04fc655f39"));
                                                achievements.getAchievement(user, ObjectId("5bf4a7cae1f97d04fc655f39"));
                                                socket.emit('level-fifty');
                                            }

                                            if (user.level === 100) {
                                                achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf535aabf9c2203ec16336c"));
                                                achievements.getAchievement(user, ObjectId("5bf535aabf9c2203ec16336c"));
                                                socket.emit('level-hundred');
                                            }

                                        }
                                        if (currentXP + exp > user.exp + 400 && user.level === 100) {
                                            user.exp = user.exp + 400;
                                            user.exp = user.exp + exp;
                                            user.gold = user.gold + 50;
                                        }

                                        user.fights_win = user.fights_win + 1;
                                        user.current_exp = user.current_exp + exp;
                                        user.gold = user.gold + gold;
                                        user.health = 100;
                                        user.save();

                                        AllianceMember.findOne({
                                            "username": user.username
                                        }).then((allyUser) => {
                                            if (allyUser) {
                                                User.findOne({
                                                    "username": user.username
                                                }).then((user) => {
                                                    allyUser.experience = user.current_exp;
                                                    allyUser.save();
                                                });
                                            } else {
                                                console.log('Not a member of alliance');
                                            }

                                            Alliance.findOne({
                                                "title": allyUser.ally_title
                                            }).then((alliance) => {
                                                if (alliance) {
                                                    alliance.expCount = alliance.expCount + exp;
                                                    alliance.save();
                                                } else {
                                                    console.log('Alliance not found.');
                                                }
                                            });


                                        });

                                        if (user.fights_win === 1) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bdd8048abc30800155d42bb"));
                                            achievements.getAchievement(user, ObjectId("5bdd8048abc30800155d42bb"));
                                            socket.emit('first-blood-achv');

                                        }

                                        if (user.fights_win === 10) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a907e1f97d04fc655f3a"));
                                            achievements.getAchievement(user, ObjectId("5bf4a907e1f97d04fc655f3a"));
                                            socket.emit('ten-fights-achv');


                                        }

                                        if (user.fights_win === 20) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a91be1f97d04fc655f3b"));
                                            achievements.getAchievement(user, ObjectId("5bf4a91be1f97d04fc655f3b"));
                                            socket.emit('twenty-fights-achv');

                                        }

                                        if (user.fights_win === 30) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a930e1f97d04fc655f3c"));
                                            achievements.getAchievement(user, ObjectId("5bf4a930e1f97d04fc655f3c"));
                                            socket.emit('thirty-fights-achv');

                                        }

                                        if (user.fights_win === 40) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a93fe1f97d04fc655f3d"));
                                            achievements.getAchievement(user, ObjectId("5bf4a93fe1f97d04fc655f3d"));
                                            socket.emit('fourty-fights-achv');

                                        }

                                        if (user.fights_win === 50) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a954e1f97d04fc655f3e"));
                                            achievements.getAchievement(user, ObjectId("5bf4a954e1f97d04fc655f3e"));
                                            socket.emit('fifty-fights-achv');

                                        }

                                        if (user.fights_win === 100) {
                                            achievements.getAchievementCompleted(ObjectId(user.id), ObjectId("5bf4a964e1f97d04fc655f3f"));
                                            achievements.getAchievement(user, ObjectId("5bf4a964e1f97d04fc655f3f"));
                                            socket.emit('hundred-fights-achv');

                                        }

                                        var newFight = Fight({
                                            username: user.username,
                                            enemyname: enemy.username,
                                            gold: gold,
                                            exp: exp,
                                            createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
                                            ended: 1
                                        });
                                        newFight.save();

                                    } else {
                                        return console.log('User not found');
                                    }
                                    AllianceMember.findOne({
                                        username: user.username
                                    }).then((userally) => {
                                        AllianceMember.findOne({
                                            username: enemy.username
                                        }).then((enemyally) => {
                                            if (userally && enemyally) {
                                                io.emit('fight-win', {
                                                    username: user.username,
                                                    useralliance: userally.ally_title,
                                                    enemyalliance: enemyally.ally_title,
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });

                                                socket.emit('battle-win', {
                                                    username: user.username,
                                                    useralliance: userally.ally_title,
                                                    enemyalliance: enemyally.ally_title,
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });
                                            } else if (userally) {
                                                io.emit('fight-win', {
                                                    username: user.username,
                                                    useralliance: userally.ally_title,
                                                    enemyalliance: "",
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });

                                                socket.emit('battle-win', {
                                                    username: user.username,
                                                    useralliance: userally.ally_title,
                                                    enemyalliance: "",
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });
                                            } else if (enemyally) {
                                                io.emit('fight-win', {
                                                    username: user.username,
                                                    useralliance: "",
                                                    enemyalliance: enemyally.ally_title,
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });

                                                socket.emit('battle-win', {
                                                    username: user.username,
                                                    useralliance: "",
                                                    enemyalliance: enemyally.ally_title,
                                                    enemyname: enemy.username,
                                                    gold: gold,
                                                    exp: exp,
                                                    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                });
                                            }
                                        });
                                    });
                                });
                            });

                        } else {
                            return console.log('fight ended');
                        }
                    });



                } else {
                    return console.log('Fight not found');
                }
            });
        });





    });

    socket.on('tutFinish', (data) => {
        User.findById(data.userId).then((user) => {
            if (user) {
                user.first_login = 1;
                user.save();
            } else {
                console.log('User is not found');
            }
        });
    });

  /*  socket.on('disconnect', (data) => {
        users = users - 1;
        io.emit('user-disconnected', {
            user: users
        });
    });*/


});

app.get('*', function (req, res) {
    res.redirect("/");
});

server.listen(port, () => {
    console.log('Server is runing on port 3000');
});