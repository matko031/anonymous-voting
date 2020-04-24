const session = require("express-session");
const express= require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const passport = require('passport');


const initializePassport = require('./passport-config');
initializePassport(passport);

const codes_file = fs.readFileSync('codes', 'utf8');
const lines = codes_file.split('\n');

const electorate = {}
lines.forEach( (line) => {  
	temp = line.split(',');
	electorate[temp[1]] = temp[0];
})

	

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
}))
app.use(passport.initialize());
app.use(passport.session());

currentVoting = "president";




const getAllPositions = (next) => {
    fs.readdir('candidates', (err, files) => {
        if(err) {
            next([]);
        } else {
            next(files);
        }
    });
};


const getCandidatesForPosition = (position, next) => {
    let itemsProcessed = 0;
    fs.readFile('candidates/'+position, 'utf8', (err, data) => {
        cands = [];
        if (!err){
            cands = data.split('\n').filter( (elem) => elem != '');
        }
        next(cands);
    });
}



const getAllVotedForPosition = (position, next) => {

    const votedFile = 'voted/' + position;
    fs.readFile(votedFile, 'utf8', (err, data) => {
        if (err) {
            if (err.code === "ENOENT"){
                error = "";
                fs.appendFile(votedFile, '', (err) => {
                    next([]);
                });
            }
        } else {
            next(data.split('\n').filter( elem => elem != ''));
        }
    });
};



const getAllVotesForPosition = (position, nextStep) => {

    const votesFile = 'votes/' + position;
    fs.readFile(votesFile, 'utf8', (err, data) => {
        if (err) {
            error = err;
            if (err.code === "ENOENT"){
                error = "";
                fs.appendFile(votesFile, '', (err) => {
                    nextStep([]);
                });
            }
        } else {
            nextStep(data.split('\n').filter( elem => elem != ''));
        }
    });
};



app.get("/", (req, res) => { 
    getCandidatesForPosition (currentVoting, (candidates) => {
        res.render("index", {name: currentVoting, candidates : candidates});
    });
});



app.post("/vote", (req, res) => {
	const code = req.body.code;
	const vote = req.body.vote;
	const position = req.body.position;
    const person = electorate[code];

    const votedFile = 'voted/' + currentVoting;
    const votesFile = 'votes/' + currentVoting;
    
    error = "";
    if (position !== currentVoting) {
        error = "The voting position has changed after you have opened the voting page. Please go back to the homepage and vote again";
        res.render("done", {err: error});
    } else if (! electorate.hasOwnProperty(code)){
        error = "The code you have typed does not exist";
        res.render("done", {err: error});
    } else {

        getAllVotedForPosition( currentVoting, (voted) => {
            if ( ! voted.includes(person) ){
                voted.push(person);
                shuffle(voted);
                fs.writeFile(votedFile, voted.join('\n'), (err) => error = err);

                getAllVotesForPosition( currentVoting, (votes) =>{
                    votes.push(vote);
                    shuffle(votes);
                    fs.writeFile(votesFile, votes.join('\n'), (err) => error = err)
                });
            } else {
                error = 'You have already voted';
            }
            res.render("done", {err: error});
        });
    }
});



app.get("/adminlogin", (req, res) => { 
	res.render("login")
});


app.post("/adminlogin", passport.authenticate('local', {
	successRedirect: '/dashboard',
	failureRedirect: 'adminlogin'
}))



app.get("/dashboard", (req, res) => {
//	if (req.user === "matko"){

        getAllPositions( (allPositions) => {
            res.render("dashboard", {candidates:allPositions});
        });
//	} else{
//		res.redirect("/");
//	}

})


app.post("/addCandidate", (req, res) => {
	if (req.user === "matko"){
        Object.keys(req.body).forEach( (position) => {
            fs.appendFile('candidates/'+position, req.body[position]+'\n', (err) => {if(err) console.log(err);} );
        })
        res.redirect("/");
    }
});



app.post("/changeCurrentVoting", (req, res) => {
	//if (req.user === "matko"){
        if('currentVoting' in req.body){
            currentVoting = req.body.currentVoting;
        }
        res.redirect("/dashboard");
   // } else {
   //     res.redirect("/");
   // }
});

app.get("/results", (req, res) => {

    results  = [];
    getAllPositions((positions) => {
        positionsProcessed = 0;
        positions.forEach( (position, index, array) => {
            getAllVotedForPosition(position, (voted) => {
                getAllVotesForPosition(position, (votes) => {
                    positionsProcessed++;
                    results.push( {position: position, voted: voted, votes:votes} );
                    if (positionsProcessed === array.length){
                        res.render("results", {results: results}); 
                    }
                }); 
            }) 
        });
    });
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
    console.log(`Server running on port ${PORT}`)
});
