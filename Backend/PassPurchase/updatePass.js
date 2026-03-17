const { allMockData, persistMockData } = require('../mockData');

const VALID_PASS_STATUSES = ['Gold', 'Silver', 'None'];

const updateUserPassStatus = async (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      const userID = Number(parsedBody.userID);
      const rawPassStatus = String(parsedBody.passStatus || '').trim();
      const normalizedPassStatus = rawPassStatus.toLowerCase();
      const passStatus =
        normalizedPassStatus === 'gold'
          ? 'Gold'
          : normalizedPassStatus === 'silver'
            ? 'Silver'
            : normalizedPassStatus === 'none'
              ? 'None'
              : rawPassStatus;

      if (!Number.isInteger(userID) || userID <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Valid userID is required' }));
        return;
      }

      if (!VALID_PASS_STATUSES.includes(passStatus)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            message: 'passStatus must be one of Gold, Silver, None',
          })
        );
        return;
      }

      const user = allMockData.USER.find((item) => item.userID === userID);

      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'User not found' }));
        return;
      }

      user.passStatus = passStatus;
      persistMockData(allMockData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Pass status updated successfully',
          userID: user.userID,
          passStatus: user.passStatus,
        })
      );
    } catch (err) {
      console.error('Error updating pass status:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: err.message || 'Failed to update pass status',
        })
      );
    }
  });
};

module.exports = {
  updateUserPassStatus,
};
