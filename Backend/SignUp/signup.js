const { allMockData, persistMockData } = require('../mockData');

const handleSignup = async (req, res) => {
    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const { firstName, lastName, email, password } = parsedBody;

            if (!firstName || !lastName || !email || !password) {
                throw new Error('Missing required fields');
            }

            const normalizedEmail = email.trim();
            const existingUser = allMockData.USER.find(
                (user) => user.email.toLowerCase() === normalizedEmail.toLowerCase()
            );

            if (existingUser) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Email already exists' }));
                return;
            }

            const nextUserId = allMockData.USER.length > 0
                ? Math.max(...allMockData.USER.map((user) => user.userID)) + 1
                : 1;

            const newUser = {
                userID: nextUserId,
                firstName,
                lastName,
                email: normalizedEmail,
                password,
                passStatus: 'None',
                createdAt: new Date().toISOString(),
            };

            allMockData.USER.push(newUser);
            persistMockData(allMockData);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Signup Success',
                user: newUser,
            }));
            return;

        } catch (err) {
            console.error('Error during signup:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message || 'Signup Failed' }));
        }
    });
};

module.exports = {
    handleSignup,
};