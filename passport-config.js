const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

async function initializeStrategy(passport, getUserByKey) {
	const authenticateUser = async (username, password, done) => {
        let user = await getUserByKey('username', username);
        console.log(user);
        user = user[0];
        if (typeof user === 'undefined') { 
            return done(null, false, {message: "No user with that username"});
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
        let user = await getUserByKey("user_id", id);
        user = user[0];
		return done(null, user);	
	});
}



module.exports = initializeStrategy;
