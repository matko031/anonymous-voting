const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

async function initializeStrategy(passport, getUserByUsername, getUserById) {
	const authenticateUser = async (username, password, done) => {
        const user = await getUserByUsername(username);
        if (typeof user === 'undefined') { 
            return done(null, false, {message: "No user with that email"});
        }
        
        try {
            if(await bcrypt.compare(password, user.password)){
                return done( null, user);
            } else {
                return done( null, false, {message: 'Password incorrect'}); 
            }
        } catch (e) {
            return done(e); 
        }
            
	};

	passport.use(new localStrategy({usernameField: 'username' }, authenticateUser));
	passport.serializeUser((user, done) => done(null, user.user_id));
	passport.deserializeUser(async(id, done) => {
        const user = await getUserById(id);
		return done(null, user);	
	});
}



module.exports = initializeStrategy;
