const localStrategy = require('passport-local').Strategy;

function initializeStrategy(passport) {
	const authenticateUser = async (username, password, done) => {
		if (username == "matko" && password == "Animiranisir49627"){
			return done(null, "matko");
		}
		return done(null,false);
	}
	passport.use(new localStrategy({usernameField: 'username' }, authenticateUser))
	passport.serializeUser((user, done) => done(null, 1));
	passport.deserializeUser((id, done) => {
		return done(null, "matko");	
	});
}



module.exports = initializeStrategy;
