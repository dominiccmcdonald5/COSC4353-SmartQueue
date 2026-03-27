require('dotenv').config()
// Connects .env database information to database.js

const MYSQL = require('mysql2')
// MySQL package for Node.js
console.log(process.env.DB_DATABASE);

const pool = MYSQL.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: true // This is important for Heroku deployment
    }
});
// Creates a connection pool to the MySQL database using the credentials from .env

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err)
        return
    }
    console.log('Connected to the database')
    connection.release() // Release the connection back to the pool
});

module.exports = pool;
// Exports the connection pool for use in other modules