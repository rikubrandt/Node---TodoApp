require('dotenv').config({path: __dirname + '/.env'})
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
var mysql = require('mysql');

const host = process.env.HOST;
	const username = process.env.MYSQLUSR;
	const password = process.env.PASSWORD;
	const database = process.env.DATABASE;

var connection = mysql.createConnection({
	host     : host,
	user     : username,
	password : password,
	database : database
});
function initialize(passport, getByEmail, getById) {
    
  const authenticateUser = async (email, password, done) => {
    

    const user = await getByEmail(email)
   
    console.log(user + ' uuserin tullostus configis')
    
    
    if (user == null) {
        
      return done(null, false, { message: 'No user with that email, register by clicking sign up.' })
    }

    try {
        
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user)
      } else {
        return done(null, false, { message: 'Password incorrect.' })
      }
    } catch (e) {
      return done(e) 
    }
  }
  
  

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.user_id))

  

  passport.deserializeUser(function(id, done) {
		connection.query("SELECT * from users WHERE user_id = "+id,function(err,rows){	
			done(err, rows[0]);
		});
    });
}

module.exports = initialize