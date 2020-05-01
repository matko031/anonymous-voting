const localStrategy = require('passport-local').Strategy;

function initializeStrategy(passport) {
	const authenticateUser = async (username, password, done) => {
        const user = getUserByUsername(username);
        if (user == null) { 
            return done(null, false, {message: "No user with that email"});
        } else{

        }
	};
	passport.use(new localStrategy({usernameField: 'username' }, authenticateUser));
	passport.serializeUser((user, done) => done(null, 1));
	passport.deserializeUser((id, done) => {
		return done(null, "matko");	
	});
}



module.exports = initializeStrategy;
