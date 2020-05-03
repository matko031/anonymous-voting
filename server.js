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
        const sql = `SELECT question_text FROM question WHERE ${key}="${value}"`;
        runQuery(sql).then( res =>  resolve(res)  );
    });
};


const getAnswersByQuestionId = async (question_id) => {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT answer_text, answer_id FROM answer WHERE question_id = ${question_id}`;
        runQuery(sql).then( (res) => resolve(res) );
    });
};

const getUserByKey = async (key, value)=> {
    return new Promise ( (resolve, reject) => {
        const sql = `SELECT * FROM user WHERE ${key}="${value}"`;
        runQuery(sql).then( res =>  resolve(res) );
    });
};


const checkAuthenticated = (req, res, next) => {
    //if (req.isAuthenticated()){
        return next();
    //}else  {
    //    return res.redirect('/'); 
    //}
};



const checkAdmin= (req, res, next) => {
    //if (!req.isAuthenticated() || req.user.admin !== 1){
    //    return res.redirect('/'); 
    //}else  {
        return next();
   // }
};



const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()){
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

app.get("/vote", checkAuthenticated, async (req, res) => {
    const question = await getQuestionByKey( 'question_id', currentVoting );
    const answers = await getAnswersByQuestionId(currentVoting).then ( (answers) => {return answers;});
    res.render("vote", {question: question[0].question_text, question_id: currentVoting, answers : answers}); 
});

app.post("/vote", checkAuthenticated, async (req, res) => {
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
    const sql = "SELECT question_text, answer_text, COUNT(*) AS votes FROM vote INNER JOIN answer ON vote.answer_id=answer.answer_id INNER JOIN question ON answer.question_id = question.question_id WHERE question.shown=1 GROUP BY vote.answer_id";
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



app.get("/register", checkNotAuthenticated, (req, res) => { 
	res.render("register");
});



app.post("/register", checkNotAuthenticated, async (req, res) => {
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




app.get("/login",checkNotAuthenticated, (req, res) => { 
	res.render("login");
});


app.post("/login",checkNotAuthenticated, passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login',
    failureFlash: true
}));


app.post('/logout',checkAuthenticated, (req, res) => {
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

    const sql = `SELECT * FROM voted WHERE question_id = "${currentVoting}"`;
    usersVoted = runQuery(sql);

    Promise.all([usersVoted, getUsers()]).then( values => {
        const votedUsers = values[0].map ( u => u.user_id );
        res.render("dashboard", { questions : questionsWithAnswers, users: values[1], voted: votedUsers });
    }).catch( err => console.log(err));
	} 
);


app.post("/addUser", checkAdmin, (req, res) => {
    const username = req.body.username;
    const code = uniqid();
    const sql = `INSERT INTO user (username, code) VALUES ('${username}', '${code}')`;
    db.query(sql, (err, result) => {
        res.redirect('/dashboard');
    });
});


app.post("/editUser", checkAdmin, (req, res) => {
    const uid = req.body.user_id;
    const username = req.body.username;
    const admin = req.body.username == 1 ? 1 : 0;

    console.log(uid, username, admin);
    const sql = `UPDATE user SET username = '${username}', admin = '${admin}' WHERE user_id = "${uid}"`;
    runQuery(sql).then( result => res.redirect("/dashboard"));
});




app.post("/deleteUser", checkAdmin, async (req, res) => {
    const uid = req.body.user_id;

    const sql = `DELETE FROM user WHERE user_id='${uid}'`;
    await runQuery(sql);
    res.status(204).send();
});




app.post("/addQuestion", checkAdmin, async (req, res) => {
    const q= req.body.question;
    const qtype = req.body.questionType;
    let answers = [];
    switch (qtype){
    case('proposal'):
        answers = ['accept', 'reject', 'abstain', 'withdraw'];
        break;
    case('yes/no'):
        answers = ['yes', 'no'];
        break;
    }

    const sql = `INSERT INTO question (question_text) VALUES ('${q}')`;
    const q_id = await runQuery(sql)
        .then( result => {return result.insertId;})
        .catch ( err => res.render("notification", {msg: {type:"error", text:err}} ));
    console.log(answers);
    answers.forEach( answer => {
        let sql2 = `INSERT INTO answer (answer_text, question_id) VALUES ('${answer}', ${q_id})`;
        runQuery(sql2);
    });
    res.redirect('/dashboard');                    
});



app.post("/editQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.question_id;
    const qtext= req.body.qtext;
    const newAnswers = req.body.answers.split(',');

    const sql = `UPDATE question SET question_text='${qtext}' WHERE question_id=${qid}`;
    runQuery(sql);

    const oldAnswers = await getAnswersByQuestionId(qid);
    const oldAnswersText = oldAnswers.map( oa => oa.answer_text );

    const answersToDelete = oldAnswers.filter ( oa => ! newAnswers.includes(oa.answer_text) );
    const answersToAdd= newAnswers.filter ( na => ! oldAnswersText.includes(na) );
    
    const p1 = answersToDelete.map( a => {
        let sql = `DELETE FROM answer WHERE answer_id='${a.answer_id}'`; 
        return runQuery(sql);
    }); 

    const p2 = answersToAdd.map( a => {
        let sql = `INSERT INTO answer(answer_text, question_id) VALUES("${a}", "${qid}")`;
        return runQuery(sql);
    }); 

    Promise.all(p1+p2).then( result => res.redirect("/dashboard")).catch( err => console.log(err));
});


app.post("/deleteQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.question_id;

    const sql1 = `DELETE FROM question WHERE question_id='${qid}'`;
    await runQuery(sql1);
    res.status(204).send();
});


app.post("/updateShownQuestion", checkAdmin, async (req, res) => {
    const qid = req.body.qid;
    const shown = req.body.shown;
    const sql = `UPDATE question SET shown="${shown}" WHERE question_id = "${qid}"`;
    await runQuery(sql);
    res.status(204).send();
});



app.post("/changeCurrentVoting", checkAdmin, (req, res) => {
    console.log(currentVoting);
    currentVoting = req.body.currentVoting;
    console.log(currentVoting);
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
