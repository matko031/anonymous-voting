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


let currentVoting;


const runQuery = (sql, values) => {
    return new Promise( (resolve, reject) => {
        db.query(sql, values, (err, res) => {
            if (err) reject(err);
            else resolve (res);
        });
    });
};


const getUsers= async () => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT * FROM user";
        runQuery(sql).then( (res) => resolve(res) );
    });
};


const getQuestions = async () => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT * FROM question";
        runQuery(sql).then( (res) => resolve(res) );
    });
};

const getQuestionByKey = async (key, value) => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT * FROM question WHERE ??=?";
        const sqlValues = [ key, value ];
        runQuery(sql, sqlValues).then( res =>  resolve(res)  );
    });
};


const getAnswersByQuestionId = async (question_id) => {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT answer_text, answer_id FROM answer WHERE question_id = ?";
        const sqlValues = [ question_id ];
        runQuery(sql, sqlValues).then( (res) => resolve(res) );
    });
};

const getUserByKey = async (key, value)=> {
    return new Promise ( (resolve, reject) => {
        const sql = "SELECT * FROM user WHERE ?? = ? ";
        const sqlValues = [ key, value ];
        runQuery(sql, sqlValues).then( res =>  resolve(res) );
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


const checkAdmin= (req, res, next) => {
    if (!req.isAuthenticated() || req.user.type !== 'admin'){
        return res.redirect('/'); 
    }else  {
        return next();
    }
};

initializePassport(passport, getUserByKey);


//Set view engine to ejs
app.set("view engine", "ejs");

//Tell Express where we keep our index.ejs
app.set("views", __dirname + "/views");

// Specify static dir
app.use( express.static( "public" ) );
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


app.use((req, res, next) => {
    const admin = req.user ? req.user.type === 'admin' : false;
   res.locals = {
       user : req.user,
       isAuthenticated : req.isAuthenticated(),
       isAdmin: admin
   };
   next();
});




app.get("/", async (req, res) => { 
    res.render("index" );
});

app.get("/vote", checkAuthenticated, async (req, res) => {
    let question, question_text, answers;
    if(currentVoting){
        question = await getQuestionByKey( 'question_id', currentVoting );
        question_text = question[0].question_text;
        answers = await getAnswersByQuestionId(currentVoting).then ( (answers) => {return answers;});
    }
    res.render("vote", {question: question_text, question_id: currentVoting, answers : answers}); 
});

app.post("/vote", checkAuthenticated, async (req, res) => {
	const code = req.body.code;
	const vote = req.body.vote;
    const user = req.user;
    const question_id = req.body.question_id;

    let sql;
    let sqlValues;
    msg = {};
    
    if ( question_id != currentVoting){
        msg.text = "The voting position has changed after you have opened the voting page. Please go back to the homepage and vote again";
        msg.type = 'warning';
    } else{
        const user_id = user.user_id; 
        sql = "SELECT user_id FROM voted WHERE user_id= ? AND question_id= ?";
        sqlValues = [user_id, question_id];
        const userIdInVoted = await runQuery(sql, sqlValues);
        
        sql = "SELECT voters FROM question WHERE question_id= ?";
        sqlValues = [question_id];
        let voters = await runQuery(sql, sqlValues);
        voters = voters[0].voters;


        if (voters == 'full' && user.type != 'full' && user.type != 'admin'){
            msg.text = "This voting is only for full members";
            msg.type = 'warning';
        }else {
            if(userIdInVoted.length === 0){
                sql = "INSERT INTO voted VALUES( ? , ? )";
                sqlValues = [user_id, currentVoting];
                const q1 = runQuery(sql, sqlValues);
                sql = "INSERT INTO vote (answer_id) VALUES(?)";
                sqlValues = [ vote ];
                const q2 = runQuery(sql, sqlValues);
                
                await Promise.all( [q1, q2] ).then( values =>{
                    msg.text = "Your vote has been submitted sucessfully";
                    msg.type = 'success';
                }).catch( err => msg = {text: "There has been an error while saving your vote in the database: "+ err, type:"error"});
            } else{
                msg.text = "You have already voted on this question"; 
                msg.type = 'warning';
            }
        }
    }
    res.render("notification", {msg: msg});
});


app.get("/results", async (req, res) => {
    const sql = "SELECT question_text, answer_text, COUNT(*) AS votes FROM vote INNER JOIN answer ON vote.answer_id=answer.answer_id INNER JOIN question ON answer.question_id = question.question_id WHERE question.shown=1 GROUP BY vote.answer_id";
    const results = await runQuery(sql);
    console.log(results);

    const sql2 = "SELECT COUNT(*) as count FROM user WHERE type='full'";
    let fullMembersCount = await runQuery(sql2);
    fullMembersCount = fullMembersCount[0].count+1; // +1 because Matko is admin, but also a full member TODO: separate full/baby status and admin/normal status
    voting_results = {};
    results.forEach( elem =>{
        if (! voting_results.hasOwnProperty(elem.question_text)){
            voting_results[elem.question_text] = {votes: {}, result:""}; 
        }
        voting_results[elem.question_text]['votes'][elem.answer_text] = elem.votes;
    });
    Object.values(voting_results).forEach ( q => {
        let withdraw = q.votes.withdraw ? q.votes.withdraw : 0;
        let votersCount = fullMembersCount - withdraw;

        let maxKey = Object.keys(q.votes).sort(function (a, b) {
          return q.votes[b] - q.votes[a];
        })[0];
        let maxVotes = q.votes[maxKey];
        if ( maxVotes >fullMembersCount/2 ) q.result = maxKey;
    });
    console.log(voting_results);
    res.render('results', {usersVoting: fullMembersCount, results: voting_results});
});



app.get("/register", checkNotAuthenticated, (req, res) => { 
	res.render("register");
});



app.post("/register", checkNotAuthenticated, async (req, res) => {
    const code = req.body.code;
    const password = req.body.password;

    const msg = {};

    const user = await getUserByKey('code', code).then( (user) => {return user;});
    if (user.length === 0){
        msg.text = "User with this code does not exist in the database";
        msg.type= "error";
    } else {
        const hashed_password = await bcrypt.hash(password, 10);
        const sql = "UPDATE user SET password = ? WHERE code= ? "; 
        const sqlValues = [hashed_password, code];
        await runQuery(sql, sqlValues).then( result => {
            msg.text = "Password has been setup succesfully";
            msg.type= "success";
        }).catch( err => {
                msg.text = err;
                msg.type= "error";
        });
    }
    res.render('notification', {msg : msg});
});




app.get("/login",checkNotAuthenticated, (req, res) => { 
	res.render("login");
});


app.post("/login",checkNotAuthenticated, passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login',
    failureFlash: true
}));


app.get('/logout',checkAuthenticated, (req, res) => {
    req.logOut();
    res.redirect('/');
});


app.get("/dashboard", checkAdmin, async (req, res) => {
    const questions = await getQuestions();
    const questionsWithAnswers = await Promise.all(
        questions.map(async q => {
            return getAnswersByQuestionId (q.question_id).then( answers => {
                q.answers=answers;
                return q;
            });
        }));

    const sql = "SELECT * FROM voted WHERE question_id = ?";
    const sqlValues = [ currentVoting ];
    usersVoted = runQuery(sql, sqlValues);

    Promise.all([usersVoted, getUsers(), getQuestionByKey('question_id', currentVoting)]).then( values => {
        const votedUsers = values[0].map ( u => u.user_id );
        const currentQuestion = values[2][0];
        res.render("dashboard", { currentQuestion: currentQuestion, questions : questionsWithAnswers, users: values[1], voted: votedUsers });
    }).catch( err => console.log(err));
	} 
);


app.post("/addUser", checkAdmin, (req, res) => {
    const username = req.body.username;
    const type = req.body.type;
    const code = uniqid();
    const sql = "INSERT INTO user (username, code, type) VALUES (?, ?, ?)";
    const sqlValues = [ username, code, type ];
    runQuery(sql, sqlValues);
    res.redirect('/dashboard');
});


app.post("/editUser", checkAdmin, (req, res) => {
    const uid = req.body.user_id;
    const username = req.body.username;
    const type = req.body.type;

    const sql = "UPDATE user SET username = ?, type = ? WHERE user_id = ?";
    const sqlValues = [ username, type, uid];
    runQuery(sql, sqlValues).then( result => res.redirect("/dashboard"));
});




app.post("/deleteUser", checkAdmin, async (req, res) => {
    const uid = req.body.user_id;

    const sql = "DELETE FROM user WHERE user_id= ?";
    const sqlValues = [ uid];
    await runQuery(sql, sqlValues);
    res.status(204).send();
});




app.post("/addQuestion", checkAdmin, async (req, res) => {
    const q= req.body.question;
    const voters = req.body.voters;
    const qtype = req.body.questionType;

    let answers = [];
    switch (qtype){
    case('proposal'):
        answers = ['accept', 'reject', 'abstain', 'withdraw'];
        break;
    case('yes/no'):
        answers = ['yes', 'no'];
        break;
    case('LGA_candidate'):
        answers = ['blank', 'withdraw'];
        break;
    }

    const sql = "INSERT INTO question (question_text, voters) VALUES (?, ?)";
    const sqlValues = [ q, voters ];
    const q_id = await runQuery(sql, sqlValues)
        .then( result => {return result.insertId;})
        .catch ( err => res.render("notification", {msg: {type:"error", text:err}} ));
    answers.forEach( answer => {
        let sql2 = "INSERT INTO answer (answer_text, question_id) VALUES (?, ?)";
        const sqlValues2 = [ answer, q_id];
        runQuery(sql2, sqlValues2);
    });
    res.redirect('/dashboard');                    
});



app.post("/editQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.question_id;
    const qtext= req.body.qtext;
    const voters = req.body.voters;
    const newAnswers = req.body.answers.split(',');

    const sql = "UPDATE question SET question_text=?, voters=? WHERE question_id=?";
    const sqlValues = [ qtext, voters, qid];
    runQuery(sql, sqlValues);

    const oldAnswers = await getAnswersByQuestionId(qid);
    const oldAnswersText = oldAnswers.map( oa => oa.answer_text );

    const answersToDelete = oldAnswers.filter ( oa => ! newAnswers.includes(oa.answer_text) );
    const answersToAdd= newAnswers.filter ( na => ! oldAnswersText.includes(na) );
    
    const p1 = answersToDelete.map( a => {
        let sql = "DELETE FROM answer WHERE answer_id= ? "; 
        const sqlValues = [ a.answer_id ];
        return runQuery(sql, sqlValues);
    }); 

    const p2 = answersToAdd.map( a => {
        let sql = "INSERT INTO answer(answer_text, question_id) VALUES( ?, ?)";
        const sqlValues = [ a, qid];
        return runQuery(sql, sqlValues);
    }); 

    Promise.all(p1+p2).then( result => res.redirect("/dashboard")).catch( err => console.log(err));
});


app.post("/deleteQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.question_id;

    const sql1 = "DELETE FROM question WHERE question_id= ? ";
    const sqlValues = [ qid ];
    await runQuery(sql1, sqlValues);
    res.status(204).send();
});


app.post("/updateShownQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.qid;
    const shown = req.body.shown;
    const sql = "UPDATE question SET shown=? WHERE question_id = ?";
    const sqlValues = [ shown, qid ];
    await runQuery(sql, sqlValues);
    res.status(204).send();
});



app.post("/changeCurrentVoting", checkAdmin, (req, res) => {
    currentVoting = req.body.currentVoting;
    res.redirect("/dashboard");
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
