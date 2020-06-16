require('dotenv').config({ path: __dirname + '/.env' })

const express = require('express')

const app = express()
const bcrypt = require('bcrypt')
const session = require('express-session')
const flash = require('express-flash')
const mysql = require('mysql')
const util = require('util')
const methodOverride = require('method-override')
const passport = require('passport')
const initializePassport = require('./passport-config')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

app.set('views', './views');
app.set('view engine', 'ejs')
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }))
app.use(bodyParser.urlencoded({ extended: false }))

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))

app.use(flash());
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'));

const host = process.env.HOST;
const username = process.env.MYSQLUSR;
const password = process.env.PASSWORD;
const database = process.env.DATABASE;

var connection = mysql.createConnection({
    host: host,
    user: username,
    password: password,
    database: database
});


initializePassport(
    passport,
    email => getByEmail(email),
    id => getTheId(id),
)

const query = util.promisify(connection.query).bind(connection);


async function getByEmail(email) {

    const rows = await query('SELECT * FROM users WHERE email = ?', [email])
    return rows[0]
}

async function getTheId(id) {
    const rows = await query('SELECT *FROM users WHERE user_id = ?', [id])
    return rows[0]

}



app.get('/', checkNotAuthenticated, (req, res) => {
    res.redirect('login')
})

app.get('/login', checkNotAuthenticated, (req, res) => {

    res.render('login.ejs', { message: req.flash('error'), reqSuccess: req.flash('reqSuccess') })
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}
))

app.get('/register', checkNotAuthenticated, (req, res) => {

    res.render('register.ejs', { message: req.flash('error'), reqSuccess: req.flash('reqSuccess') })
})
app.post('/register', checkNotAuthenticated, async (req, res) => {

    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const username = req.body.name;
        const email = req.body.email;
        const emailCheckQuery = "SELECT * FROM users WHERE email = ?"
        const usernameCheckQuery = "SELECT * FROM users WHERE username = ?"
        const registerQuery = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)"
        connection.query(emailCheckQuery, [email], (err, rows, fields) => {
            if (err) {
                console.log('Failed to check if email already exists ' + err)
            }
            else if (rows.length > 0) {

                res.render('register', { message: 'Email is already registered.', reqSuccess: '' })
            }
            else {
                console.log('Email OK')
            }
        })

        connection.query(usernameCheckQuery, [username], (err, rows, fields) => {
            if (err) {
                console.log('Failed to check if username already exists ' + err)
            }
            else if (rows.length > 0) {
                res.render('register', { message: 'Username is already taken.', reqSuccess: '' })
            }
            else if (/\s/.test(username)) {
                res.render('register', { message: 'Username cannot contain spaces.', reqSuccess: '' })
            }
            else {
                console.log('Username OK')
            }
        })

        connection.query(registerQuery, [username, email, hashedPassword], (err, rows, fields) => {
            if (err) {
                console.log('Failed to register ' + err)
            }
             
            res.render('login', { message: '', reqSuccess: 'Registration successfull! Login using your credentials.' })
        })


    } catch (err) {
        console.log("Try block err" + err)
        res.redirect('login')
    }
})

app.post('/updateEmail', async (req, res) => {
    try {
        const newEmail = req.body.email;
        const currentUser = req.user.username;
        const emailCheckQuery = "SELECT * FROM users WHERE email = ?"
        const emailUpdateQuery = "UPDATE users SET email = ? WHERE username = ?"
        connection.query(emailCheckQuery, [newEmail], (err, rows, fields) => {
            if(err) {
                console.log("Error checking email " + err)
            }
            else if(rows.length>0) { 
                req.flash('duplicateEmail', 'That email is already to another account.')
                res.redirect('profile')
            }
            else {
                console.log("Changing email")
                connection.query(emailUpdateQuery, [newEmail, currentUser], (err, rows, fields) => {
                    if(err) {
                        console.log("Error updating email " + err)
                    }
                    req.flash('successEmail', 'Email changed successfully.')
                    res.redirect('profile')
                })
            }
        })
    } catch {
        res.redirect('profile')
    }
})
app.post('/updatePassword', async (req, res) => {
    //NEeds popup
    try {
        const oldPass = req.body.oldPassword;
        const newPass = req.body.newPassword;
        const newPass2 = req.body.reNewPassword

        const currentUser = req.user.username;
        if (await bcrypt.compare(oldPass, req.user.password)) {
            if (newPass == newPass2) {
                const hashedPass = await bcrypt.hash(newPass, 10)
                connection.query('UPDATE users SET password = ? WHERE username = ?', [hashedPass, currentUser])
                res.redirect(req.flash('successPassword', 'Password changed successfully.'), '/profile')
            }
            else {
                res.redirect(req.flash('notMatch', 'New password have to match.'), '/profile')
            }


        }
        else {
            res.redirect(req.flash('wrongOldPass', 'Old password incorrect.'), '/profile')
        }
        res.redirect('/profile')
    } catch {
        res.redirect('/profile')
    }
})

app.get('/profile', checkAuthenticated, (req, res) => {

    res.render('profile.ejs', { name: req.user.username, email: req.user.email, successPassword: req.flash('successPassword'), notMatch: req.flash('notMatch'), wrongOldPass: req.flash('wrongOldPass'), successEmail: req.flash('successEmail'), duplicateEmail: req.flash('duplicateEmail') })
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { name: req.user.username })
})

app.get('/get_todos', checkAuthenticated, (req, res) => {
    const user_id = req.user.user_id
    const queryString = "SELECT * FROM todos WHERE complete = '0' AND todo_user_id = ?"
    connection.query(queryString, [user_id], (err, rows, fields) => {
        if (err) {
            console.log("Failed to query @ /get_todos + " + err)
        }
        console.log("Getting data from database @get_todos")
        res.json(rows)
    })
})
app.post('/add_todo', (req, res) => {
    const todo = req.body.add_todo_input
    const username = req.user.user_id
    console.log(req.body.add_todo_input)
    const queryString = "INSERT INTO todos (todo_user_id, task, complete) VALUES (?, ?, ?)"
    connection.query(queryString, [username, todo, 0], (err, rows, fields) => {
        if (err) {
            console.log("Failed to insert @ /add_todos + " + err)
        }
        console.log("@/add_todos success")
        res.redirect('/dashboard')
    })
})

app.post('/complete_todo/:id', checkAuthenticated, (req, res) => {
    const todo_id = req.params.id
    const queryString = "UPDATE todos SET complete = '1', date_complete = ? WHERE todo_id = ?"

    connection.query(queryString, [new Date(), todo_id], (err, rows, fields) => {
        if (err) {
            console.log("Failed to complete todo" + err)
        }
        else {
        console.log("Todo complete_todo success")
        res.redirect('/dashboard')
        }
    })
})

app.get('/taskhistory', checkAuthenticated, (req, res) => {
    res.render('taskhistory.ejs', { name: req.user.username })
})

app.get('/get_taskhistory', checkAuthenticated, (req, res) => {
    const user_id = req.user.user_id
    const queryString = "SELECT * FROM todos WHERE complete = '1' AND todo_user_id = ?"
    connection.query(queryString, [user_id], (err, rows, fields) => {
        if (err) {
            console.log("Failed to query @ /get_taskhistory + " + err)
        }
        console.log("Getting data from database @get_taskhistory")
        res.json(rows)
    })
})

app.post('/uncomplete_todo/:id', checkAuthenticated, (req, res) => {
    const todo_id = req.params.id
    const queryString = "UPDATE todos SET complete = '0' WHERE todo_id = ?"

    connection.query(queryString, [todo_id], (err, rows, fields) => {
        if (err) {
            console.log("Failed to uncomplete todo")
        }
        console.log("Todo uncomplete_todo success")
        res.redirect('/taskhistory')
    })
})

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }


    res.redirect('/login')

}

function checkNotAuthenticated(req, res, next) {

    if (req.isAuthenticated()) {
        return res.redirect('/dashboard')
    }
    next()
}
app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
})



app.listen(5000)
