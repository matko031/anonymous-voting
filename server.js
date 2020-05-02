const uniqid = require('uniqid');
const session = require("express-session");
const express= require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const mysql = require('mysql');
const passport = require('passport');
const initializePassport = require('./passport-config');
initializePassport(passport);



const db_config = require('./config');

db.connect( (err) => {
    if (err) {
        console.log(err);
    }
    console.log('MySql Connected...');
});


const recreateConnection = () => {
        db.destroy();
        db = mysql.createConnection({
            user: 'b403519124d5e3',
            password: '2976cb03',
            host: 'eu-cdbr-west-03.cleardb.net',
            database: 'heroku_e2ec6684540f209'
        });
        db.connect( (err) => {
            if (err) {
                console.log(err);
            }
        });
};


setInterval(recreateConnection, 3000);

db.on('error', function(err) {
    console.log('leleleeeee', err);
    }
);

const app = express();

//Set view engine to ejs
app.set("view engine", "ejs");

//Tell Express where we keep our index.ejs
app.set("views", __dirname + "/views");

//Use body-parser
app.use(bodyParser.urlencoded({ extended: false }));


app.use(session({
	//TODO: change secret to smth more secure
	secret: 'matkoisthebest',
	resave: true,
	saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());






currentVoting = 1;

const getUsers= (next) => {
    const sql = "SELECT username, code FROM user";
    db.query(sql, (err, res) => {
        if (err) console.log('getUsers', err);
        else next(res);
    });
};


const getQuestions = (next) => {
    const sql = "SELECT question_id, question_text FROM question";
    db.query(sql, (err, res) => {
        if (err) console.log('getQuestions', err);
        else next(res);
    });
};


const getQuestion = (question_id, next) => {
    const sql = `SELECT question_text FROM question WHERE question_id=${question_id}`;
    db.query(sql, (err, res) => {
        if (err) console.log('getQuestion', err);
        else {
            next(res[0].question_text);
        }
    });
};


const getAnswers = (question_id, next) => {
    const sql = `SELECT answer_text, answer_id FROM answer WHERE question_id = ${question_id}`;
    db.query(sql, (err, res) => {
        if (err) console.log('getAnswer', err);
        else next(res);
    });
};




app.get("/", (req, res) => { 
    getQuestion( currentVoting, (q) =>{
        getAnswers(currentVoting, (answers) => {
            res.render("index", {question: q, question_id: currentVoting, answers : answers});
        });

    });
});


app.post("/vote", (req, res) => {
	const code = req.body.code;
	const vote = req.body.vote;
    const question_id = req.body.question_id;


    error = "";
    if ( question_id !== currentVoting){
        error = "The voting position has changed after you have opened the voting page. Please go back to the homepage and vote again";
        res.render("done", {err: error});
    } else {
        sql1 = `SELECT user_id FROM user WHERE code='${code}'`;
        db.query(sql1, (err, result) => {
            if (err) console.log(err);
            else{
                if(result.length === 0){
                    error = "The code you have typed does not exist";
                    res.render("done", {err: error});
                } else{
                    const user_id = result[0].user_id; 
                    sql2 = `SELECT user_id FROM voted WHERE user_id=${user_id} AND question_id=${currentVoting}`;
                    db.query(sql2, (err, result) => {
                        if(err) console.log(err);
                        if(result.length === 0){
                           sql3 = `INSERT INTO voted VALUES(${user_id}, ${currentVoting})`;
                            db.query(sql3, (err,result) => {
                               sql4 = `INSERT INTO vote (answer_id) VALUES(${vote})`;
                                db.query(sql4, (err, result) =>{
                                    if(err) console.log(err); 
                                    else{
                                    res.render("done", {err: error});
                                    }
                                });
                            });
                        } else{
                            error = "You have already votes for this question"; 
                            res.render("done", {err: error});
                        } 
                    });
                }
            }
        });
    }
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



app.post("/register", (req, res) => {
    const code = req.body.code;
    const password = req.body.password;

    const msg = {text:'', type:''};

    sql1 = `SELECT * FROM user WHERE code='${code}'`;
    db.query(sql1, (err, result) =>{
        if (result.length === 0){
            msg.text = "User with this code does not exist in the database";
            msg.type= "error";
            res.render('notification', {msg : msg});
        } else {
            sql2 = `UPDATE user SET password = '${password}' WHERE code='${code}'`; 
            db.query(sql2, (err, result) => {
                if(err) {
                    msg.text = err;
                    msg.type= "error";
                } else{
                    msg.text = "Password has been setup succesfully";
                    msg.type= "success";
                }
                res.render('notification', {msg : msg});
            });
        }
    });
});




app.get("/login", (req, res) => { 
	res.render("login");
});


app.post("/adminlogin", passport.authenticate('local', {
	successRedirect: '/dashboard',
	failureRedirect: 'adminlogin'
}));


app.get("/dashboard", (req, res) => {
	if (req.user === "matko"){
    getUsers( (users) => {
        getQuestions ( (questions) =>{
            res.render("dashboard", { questions : questions, users: users});
        }) ;
    });

	} else{
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
