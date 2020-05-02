const uniqid = require('uniqid');
const session = require("express-session");
const express= require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const mysql = require('mysql');
const passport = require('passport');
const initializePassport = require('./passport-config');
const flash = require('express-flash');
const bcrypt = require('bcrypt');

const app = express();


const db_config = require('./config');
let db = mysql.createPool(db_config);


currentVoting = 11;


const runQuery = (sql) => {
    return new Promise( (resolve, reject) => {
        db.query(sql, (err, res) => {
            if (err) reject(err);
            else resolve (res);
        });
    });
};


const getUsers= async () => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT username, code FROM user";
        runQuery(sql).then( (res) => resolve(res) );
    });
};


const getQuestions = async () => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT question_id, question_text FROM question";
        runQuery(sql).then( (res) => resolve(res) );
    });
};

const getQuestion = async (question_id) => {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT question_text FROM question WHERE question_id=${question_id}`;
        runQuery(sql).then( (res) => resolve(res[0].question_text) );
    });
};


const getAnswers = async (question_id) => {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT answer_text, answer_id FROM answer WHERE question_id = ${question_id}`;
        runQuery(sql).then( (res) => resolve(res) );
    });
};

const getUserByCode= async code => {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT * FROM user WHERE code='${code}'`;
        runQuery(sql).then( (result) => resolve(result[0]) );
    });
};

const getUserByUsername = async username => {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT * FROM user WHERE username='${username}'`;
        runQuery(sql).then( result => resolve(result[0]) );
    });
};


const getUserById = async user_id=> {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT * FROM user WHERE user_id='${user_id}'`;
        runQuery(sql).then( result => resolve(result[0]) );
    });
};


const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()){
        return next();
    }else  {
        return res.redirect('/'); 
    }
};



const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()){
        return res.redirect('/'); 
    }else  {
        return next();
    }
};


initializePassport(passport, getUserByUsername, getUserById );


//Set view engine to ejs
app.set("view engine", "ejs");

//Tell Express where we keep our index.ejs
app.set("views", __dirname + "/views");

//Use body-parser
app.use(bodyParser.urlencoded({ extended: false }));

app.use(flash());
app.use(session({
	//TODO: change secret to smth more secure
	secret: 'matkoisthebest',
	resave: true,
	saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());







app.get("/", async (req, res) => { 
    res.render("index", {isAuthenticated : req.isAuthenticated()});
});

app.get("/vote", async (req, res) => {
    const question = await getQuestion( currentVoting ).then( (question) => {return question;});
    const answers = await getAnswers(currentVoting).then ( (answers) => {return answers;});
    res.render("vote", {question: question, question_id: currentVoting, answers : answers}); 
});

app.post("/vote", async (req, res) => {
	const code = req.body.code;
	const vote = req.body.vote;
    const question_id = req.body.question_id;

    let sql;
    msg = {};
    
    if ( question_id != currentVoting){
        msg.text = "The voting position has changed after you have opened the voting page. Please go back to the homepage and vote again";
        msg.type = 'warning';
    } else {
        const user = await getUserByCode(code).then( (user) => {return user;});
        if(user.length === 0){
            msg.text = "The code you have typed does not exist";
            msg.type = 'warning';

        } else{
            const user_id = user[0].user_id; 
            sql = `SELECT user_id FROM voted WHERE user_id=${user_id} AND question_id=${currentVoting}`;
            const userIdInVoted = await runQuery(sql).then( result => {return result;});
            if(userIdInVoted.length === 0){
                sql = `INSERT INTO voted VALUES(${user_id}, ${currentVoting})`;
                runQuery(sql).then( res => {});
                sql = `INSERT INTO vote (answer_id) VALUES(${vote})`;
                runQuery(sql).then( res => {});
                res.render("done", {err: error});

                msg.text = "Your vote has been submitted sucessfully";
                msg.type = 'success';

            } else{
                msg.text = "You have already votes for this question"; 
                msg.type = 'warning';
            }
        }
    }
    res.render("notification", {msg: msg});
});


app.get("/results", (req, res) => {
    const sql = "SELECT question_text, answer_text, COUNT(*) AS votes FROM vote INNER JOIN answer ON vote.answer_id=answer.answer_id INNER JOIN question ON answer.question_id = question.question_id GROUP BY vote.answer_id";
    db.query(sql, (err, result) => {
        if(err) console.log(err); 
        let processed = 0;
        voting_results = {};
        result.forEach( elem =>{
            if (! voting_results.hasOwnProperty(elem.question_text)){
                voting_results[elem.question_text] = {}; 
            }
            voting_results[elem.question_text][elem.answer_text] = elem.votes;
        });
        res.render('results', {results: voting_results});
    });
});



app.get("/register", (req, res) => { 
	res.render("register");
});



app.post("/register", async (req, res) => {
    const code = req.body.code;
    const password = req.body.password;

    const msg = {};

    const user = await getUserByCode(code).then( (user) => {return user;});
    if (user.length === 0){
        msg.text = "User with this code does not exist in the database";
        msg.type= "error";
    } else {
        const hashed_password = await bcrypt.hash(password, 10);
        const sql = `UPDATE user SET password = '${hashed_password}' WHERE code='${code}'`; 
        await runQuery(sql).then( result => {
            msg.text = "Password has been setup succesfully";
            msg.type= "success";
        }).catch( err => {
                msg.text = err;
                msg.type= "error";
        });
    }
    res.render('notification', {msg : msg});
});




app.get("/login", (req, res) => { 
	res.render("login");
});


app.post("/login", passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login',
    failureFlash: true
}));


app.post('/logout', (req, res) => {
    req.logOut();
    res.redirect('/');
});


app.get("/dashboard", checkAuthenticated, async (req, res) => {
	if (req.user.admin == 1){
        Promise.all([getUsers(), getQuestions()]).then( ([users, questions]) => {
            res.render("dashboard", { questions : questions, users: users});
        }).catch( err => console.log(err));
	} else {
		res.redirect("/");
    }

});


app.post("/addUser", (req, res) => {
	if (req.user === "matko"){
    const username = req.body.username;
    const code = uniqid();
    const sql = `INSERT INTO user (username, code) VALUES ('${username}', '${code}')`;
    db.query(sql, (err, result) => {
        res.redirect('/dashboard');
    });
    }
});


app.post("/addQuestion", (req, res) => {
	if (req.user === "matko"){
    const question = req.body.question;
    const sql = `INSERT INTO question (question_text) VALUES ('${question}')`;
    db.query(sql, (err, result1) => {

        const sql2 = `SELECT question_id FROM question WHERE question_text = '${question}'`;
        db.query(sql2, (err, result2) => {
            
            const q_id = result2[0].question_id;

            let processed = 0;
            const answers = ['accept', 'reject', 'abstain', 'withdraw'];
            for (let i=0; i<4; i++){
                let sql3 = `INSERT INTO answer (answer_text, question_id) VALUES ('${answers[i]}', ${q_id})`;
                db.query(sql3, (err, result2) => {
                    processed++;
                    if (err) {console.log(err);}
                    if (processed  == 4){
                        res.redirect('/dashboard');                    
                }
                });
            }
        });
    });

    }
});


app.post("/changeCurrentVoting", (req, res) => {
    if (req.user === "matko"){
        if('currentVoting' in req.body){
            currentVoting = req.body.currentVoting;
        }
    }
    res.redirect("/");
});








// Shuffle function using the Fisher-Yates algorithm
function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

		// swap elements array[i] and array[j]
		[array[i], array[j]] = [array[j], array[i]];
	}
}


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
