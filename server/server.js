const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

// Load environment variables from .env file
require('dotenv').config();

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

app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: SESSION_COOKIE_MAX_AGE }
}));

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

// Block access to .html and .js files
app.get(/.*\.(html|js)$/, (req, res) => {
    res.redirect('/404');
});

// Handle Sign-Up Process
app.post('/api/signup', async (req, res) => {

    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        return res.status(400).send('Fields cannot be empty');
    }

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length > 0) {
            return res.status(409).send('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await connection.query(
            'INSERT INTO users (email, first_name, last_name, password_hash) VALUES (?, ?, ?, ?)',
            [email, firstName, lastName, hashedPassword]
        );

        connection.end();

        res.redirect('/signin?message=Account created successfully');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
});

// Handle Sign-In Process
app.post('/api/signin', async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Fields cannot be empty');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [activeSession] = await connection.query(
            'SELECT * FROM sessions WHERE email = ? AND expires_at > NOW()',
            [email]
        );

        if (activeSession.length > 0) {
            return res.status(403).send('You are already signed in from another device.');
        }

        const [rows] = await connection.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).send('Invalid email or password');
        }

        const user = rows[0];

        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).send('Invalid email or password');
        }

        const sessionCookie = req.session.id;
        const expiresAt = new Date(Date.now() + SESSION_COOKIE_MAX_AGE);

        await connection.query(
            'INSERT INTO sessions (email, cookie, expires_at) VALUES (?, ?, ?)',
            [email, sessionCookie, expiresAt]
        );

        req.session.isLoggedIn = true;
        req.session.username = email;

        connection.end();

        res.redirect('/chat');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
});

// Handle user details retrieval
app.get('/api/user-details', ensureAuthenticated, async (req, res) => {
    const sessionCookie = req.session.id;

    if (!sessionCookie) {
        return res.status(404).send('User session not found');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [sessionRows] = await connection.query(
            'SELECT email FROM sessions WHERE cookie = ? AND expires_at > NOW()',
            [sessionCookie]
        );

        if (sessionRows.length === 0) {
            await connection.end();
            return res.status(404).send('Session expired or not found');
        }

        const email = sessionRows[0].email;

        const [userRows] = await connection.query(
            'SELECT first_name, last_name, email FROM users WHERE email = ?',
            [email]
        );

        await connection.end();

        if (userRows.length === 0) {
            return res.status(404).send('User not found');
        }

        const user = userRows[0];
        res.json({
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
});

// Handle user details update
app.put('/api/update-user-details', ensureAuthenticated, async (req, res) => {
    const sessionCookie = req.session.id;

    if (!sessionCookie) {
        return res.status(404).send('User session not found');
    }

    const { field, value } = req.body;

    if (!field || !value) {
        return res.status(400).send('Fields cannot be empty');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [sessionRows] = await connection.query(
            'SELECT email FROM sessions WHERE cookie = ? AND expires_at > NOW()',
            [sessionCookie]
        );

        if (sessionRows.length === 0) {
            await connection.end();
            return res.status(404).send('Session expired or not found');
        }

        const currentEmail = sessionRows[0].email;

        const updateFields = [];
        const queryParams = [];

        switch (field) {
            case 'firstName':
                updateFields.push('first_name = ?');
                queryParams.push(value);
                break;
            case 'lastName':
                updateFields.push('last_name = ?');
                queryParams.push(value);
                break;
            default:
                await connection.end();
                return res.status(400).send('Invalid field');
        }

        if (updateFields.length === 0) {
            await connection.end();
            return res.status(400).send('No valid fields to update');
        }

        queryParams.push(currentEmail);

        if (field === 'email') {
            return res.status(400).send('Cannot Update Email');
        }

        const sqlUpdate = `UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`;

        const [updateResult] = await connection.query(sqlUpdate, queryParams);

        if (updateResult.affectedRows === 0) {
            await connection.end();
            return res.status(404).send('User not found');
        }

        await connection.end();

        res.status(200).send('User details updated successfully');
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server error');
    }
});

// Handle Change Password Process
app.post('/api/change-password', async (req, res) => {

    const sessionCookie = req.session.id;

    if (!sessionCookie) {
        return res.status(404).send('User session not found');
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body;


    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).send('All fields are required');
    }

    if (newPassword !== confirmNewPassword) {
        return res.status(400).send('New passwords do not match');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [sessionRows] = await connection.query(
            'SELECT email FROM sessions WHERE cookie = ? AND expires_at > NOW()',
            [sessionCookie]
        );

        if (sessionRows.length === 0) {
            await connection.end();
            return res.status(404).send('Session expired or not found');
        }

        const currentEmail = sessionRows[0].email;

        const [rows] = await connection.query(
            'SELECT password_hash FROM users WHERE email = ?',
            [currentEmail]
        );

        if (rows.length === 0) {
            return res.status(404).send('User not found');
        }

        const { password_hash } = rows[0];

        const isMatch = await bcrypt.compare(currentPassword, password_hash);

        if (!isMatch) {
            return res.status(400).send('Current password is incorrect');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        await connection.query(
            'UPDATE users SET password_hash = ? WHERE email = ?',
            [hashedNewPassword, currentEmail]
        );

        connection.end();

        res.status(200).send('Password changed successfully');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
});

// Handle user account deletion
app.delete('/api/delete-account', ensureAuthenticated, async (req, res) => {
    const sessionCookie = req.session.id;

    if (!sessionCookie) {
        return res.status(404).send('User session not found');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [sessionRows] = await connection.query(
            'SELECT email FROM sessions WHERE cookie = ? AND expires_at > NOW()',
            [sessionCookie]
        );

        if (sessionRows.length === 0) {
            await connection.end();
            return res.status(404).send('Session expired');
        }

        const email = sessionRows[0].email;

        await connection.query(
            'DELETE FROM sessions WHERE email = ?',
            [email]
        );

        const [deleteUser] = await connection.query(
            'DELETE FROM users WHERE email = ?',
            [email]
        );

        if (deleteUser.affectedRows === 0) {
            await connection.end();
            return res.status(404).send('User not found or already deleted');
        }

        await connection.end();

        res.clearCookie('connect.sid');
        res.redirect('/signin?message=Account successfully deleted');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
});

// Handle Logout Process
app.post('/api/logout', (req, res) => {

    const email = req.session.username;

    req.session.destroy(async (err) => {
        if (err) {
            return res.status(500).send('Server error');
        }

        try {
            const connection = await mysql.createConnection(dbConfig);

            await connection.query(
                'DELETE FROM sessions WHERE email = ?',
                [email]
            );

            connection.end();
        } catch (err) {
            console.log(err);
            return res.status(500).send('Server error');
        }

        res.clearCookie('connect.sid');
        res.redirect('/signin?message=Logout Successfull');
    });
});


// Utility function to find the user's first name based on the session
async function findFirstName(sessionId) {

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [sessionRows] = await connection.query(
            'SELECT email FROM sessions WHERE cookie = ? AND expires_at > NOW()',
            [sessionId]
        );

        if (sessionRows.length === 0) {
            await connection.end();
            return res.status(404).send('Session expired');
        }

        const email = sessionRows[0].email;

        const [userRows] = await connection.query(
            'SELECT first_name FROM users WHERE email = ?',
            [email]
        );

        await connection.end();

        if (userRows.length === 0) {
            return res.status(404).send('User not found');
        }

        return userRows[0].first_name;

    } catch (err) {
        console.log(err);
        return res.status(500).send('Server error');
    }
}

wss.on('connection', async (ws, req) => {
    const session = req.headers.cookie.split('connect.sid=')[1];
    const cleanSession = session.replace('s%3A', '');
    const sessionId = cleanSession.split('.')[0];

    const firstName = await findFirstName(sessionId);

    if (!firstName) {
        ws.close();
        return;
    }

    clients.push(ws);

    ws.on('message', (message) => {
        const messageText = message.toString();

        const messageData = JSON.stringify({
            name: firstName,
            text: messageText,
        });

        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageData);
            }
        });
    });

    ws.on('close', () => {
        const messageData = JSON.stringify({
            type: 'system',
            text: 'Connection closed.',
        });

        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageData);
            }
        });

        clients = clients.filter((client) => client !== ws);
    });
});

// Server Start
server.listen(PORT, () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
});

// Server Shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');

    clients.forEach(client => client.close());

    try {
        const connection = await mysql.createConnection(dbConfig);

        await connection.query('DELETE FROM sessions');

        connection.end();
        console.log('All active sessions cleared.');
    } catch (err) {
        console.log('Error clearing sessions during shutdown:', err);
    }

    wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
});
