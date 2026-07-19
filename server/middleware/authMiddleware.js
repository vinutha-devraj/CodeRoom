const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');
  
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }

  // Check if Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token format is invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'coderoom_secret_key_123');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
