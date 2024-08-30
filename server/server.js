// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Global variable to store connected WebSocket clients
let clients = [];

// Configuration constants
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 8080;
const SESSION_COOKIE_MAX_AGE = parseInt(process.env.SESSION_COOKIE_MAX_AGE, 10);
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10);

// Database connection
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// Middleware
app.use(express.static(path.join(__dirname, '../public')));

// Session middleware
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: SESSION_COOKIE_MAX_AGE }
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Utility functions
const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/chat');
    }
    next();
};

const ensureAuthenticated = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/signin');
};

// root Route
app.get('/', ensureAuthenticated, (req, res) => {
    res.redirect('/chat');
});

// Chat Route
app.get('/chat', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'chat.html'));
});

// SignIn Route
app.get('/signin', redirectIfLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'signin.html'));
});

// SignUp Route
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'signup.html'));
});

// Page Not found
app.get('/404', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', '404.html'));
});

// Block access to .html files directly
app.get('/*.html', (req, res) => {
    res.redirect('/404');
});

// Handle Sign-Up Process
app.post('/api/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(409).send('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await connection.query('INSERT INTO users (email, first_name, last_name, password_hash) VALUES (?, ?, ?, ?)', [email, firstName, lastName, hashedPassword]);

        connection.end();

        res.redirect('/signin');
    } catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
});

// Handle Sign-In Process
app.post('/api/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).send('Invalid email or password');
        }

        const user = rows[0];

        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).send('Invalid email or password');
        }

        req.session.isLoggedIn = true;
        req.session.username = email;

        connection.end();

        res.redirect('/chat');
    } catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
});

// Handle Logout Process
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        res.clearCookie('connect.sid');
        res.redirect('/signin');
    });
});

// WebSocket Handling
wss.on('connection', (ws) => {
    clients.push(ws);

    ws.on('message', (message) => {
        const messageText = message.toString();
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageText);
            }
        });
    });

    ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
    });
});

// Server Start
server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});

// Server Shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    clients.forEach(client => client.close());
    wss.close(() => process.exit());
});
