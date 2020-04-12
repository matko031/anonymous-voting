const app = require("express")();
const bodyParser = require("body-parser");

voted = [];
votes = [];

//Set view engine to ejs
app.set("view engine", "ejs");

//Tell Express where we keep our index.ejs
app.set("views", __dirname + "/views");

//Use body-parser
app.use(bodyParser.urlencoded({ extended: false }));

//Instead of sending Hello World, we render index.ejs
app.get("/", (req, res) => { res.render("index", { username: "Matko" }); });

app.post("/analyse", (req, res) => {
    console.log(req.body.code);
    voted.push(req.body.code);
    votes.push(req.body.vote);
    voted = shuffle(voted);
    votes = shuffle(votes);

    console.log(voted);
    console.log(votes)


    res.render("done");
})

app.get("/admin", (req, res) => {
    console.log(voted);
    console.log(votes);
    res.render("admin", { voted: voted, votes: votes }); });


function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
