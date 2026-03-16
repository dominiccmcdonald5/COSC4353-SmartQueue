const { stringify } = require('qs');
const pool = require('./database.js');
const nodemailer = require('nodemailer');
const {uploadToAzureBlobFromServer} = require('./azure.js');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { get } = require('http');



/*
const handleSignup = async (req, res) => {
    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const { accountType, email, username, password, image } = parsedBody;

            if (!accountType || !email || !username || !password) {
                throw new Error('Missing required fields');
            }

            const validAccountTypes = ['user', 'artist'];
            if (!validAccountTypes.includes(accountType)) {
                throw new Error('Invalid account type');
            }
            const imageMatches = image.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!imageMatches) {
                return res.writeHead(400, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({
                        success: false,
                        message: 'Invalid image file format'
                    }));
            }

            const fileTypeImage = imageMatches[1]; // jpeg, png, etc.
            const base64DataImage = imageMatches[2];
            const bufferImage = Buffer.from(base64DataImage, 'base64');

            // Generate filename
            const fileNameImage = `${username}-${Date.now()}.${fileTypeImage}`;

            // Upload to Azure (or any storage service)
            const imageUrl = await uploadToAzureBlobFromServer(bufferImage, fileNameImage);

            const [result] = await pool.promise().query(
                `INSERT INTO ?? (email, username, password, image_url, created_at) VALUES (?, ?, ?, ?, NOW())`,
                [accountType, email, username, password, imageUrl]
            );

            if (accountType === 'user') {

            const [findUserId] = await pool.promise().query(
                `SELECT user_id FROM user WHERE username = ?`, [username]);


            const [createLikeAlbum] = await pool.promise().query(
                `INSERT INTO playlist (name, user_id, image_url, created_at) VALUES (?, ?, ?, NOW())`, [`Liked Songs`, findUserId[0].user_id, `https://musiccontainer.blob.core.windows.net/mp3/liked_image.png`]
            )
        }
            
            
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, message: 'Signup Success' }));
                return;

        } catch (err) {
            console.error('Error during signup:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message || 'Signup Failed' }));
        }
    });
};

const handleLogin = async (req, res) => {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const { username, password } = parsedBody;

            if (!username || !password) {
                throw new Error('Missing required fields');
            }

            // Check in 'user' table
            const [user_check] = await pool.promise().query(
                `SELECT user_id, username, image_url FROM user WHERE username = ? AND password = ?`, [username, password]
            );
            console.log('User Check:', user_check);

            if (user_check.length > 0) {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    userId: user_check[0].user_id,
                    userName: user_check[0].username,
                    userImage: user_check[0].image_url,
                    accountType: 'user',
                    message: "User Account"
                }));
                return;
            }

            // Check in 'artist' table
            const [artist_check] = await pool.promise().query(
                `SELECT artist_id, username, image_url FROM artist WHERE username = ? AND password = ?`, [username, password]
            );
            if (artist_check.length > 0) {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    userId: artist_check[0].artist_id,
                    userName: artist_check[0].username,
                    userImage: artist_check[0].image_url,
                    accountType: 'artist',
                    message: "Artist Account"
                }));
                return;
            }

            // Check in 'admin' table
            const [admin_check] = await pool.promise().query(
                `SELECT admin_id, username, image_url FROM admin WHERE username = ? AND password = ?`, [username, password]
            );
            if (admin_check.length > 0) {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    userId: admin_check[0].admin_id,
                    userName: admin_check[0].username,
                    userImage: admin_check[0].image_url,
                    accountType: 'admin',
                    message: "Admin Account"
                }));
                return;
            }

            // If the user is not found in any of the tables
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Account not found"
            }));
        }
        catch (err) {
            console.error('Error during login:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message || 'Login Failed' }));
        }
    });
};
*/

module.exports = {
};
