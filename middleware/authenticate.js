const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'nmfjkenjfnejnf'; // Secret key từ môi trường

// Middleware để xác thực JWT
exports.authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Lấy token từ header Authorization
  if (!token) {
    return res.status(401).json({ message: 'Token không được cung cấp!' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token không hợp lệ!' });
    }
    
    req.user = user; // Lưu thông tin user vào request
    next(); // Chuyển sang middleware/controller tiếp theo
  });
};
