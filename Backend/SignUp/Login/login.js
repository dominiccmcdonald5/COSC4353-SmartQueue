const { allMockData } = require('../../mockData');

const handleLogin = async (req, res) => {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const { email, password } = parsedBody;
            const userIdentifier = email ? email.trim() : '';

            if (!userIdentifier || !password) {
                throw new Error('Missing required fields');
            }

            const userCheck = allMockData.USER.find(
                (item) => item.email.toLowerCase() === userIdentifier.toLowerCase() && item.password === password
            );

            if (userCheck) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    userId: userCheck.userID,
                    userName: `${userCheck.firstName} ${userCheck.lastName}`,
                    email: userCheck.email,
                    accountType: 'user',
                    message: "User Account"
                }));
                return;
            }

            const adminCheck = allMockData.ADMIN.find(
                (item) => item.user === userIdentifier && item.password === password
            );

            if (adminCheck) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    userName: adminCheck.user,
                    accountType: 'admin',
                    message: "Admin Account"
                }));
                return;
            }

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "User not found"
            }));
        }
        catch (err) {
            console.error('Error during login:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message || 'Login Failed' }));
        }
    });
};

module.exports = {
    handleLogin,
};