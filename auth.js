// middlewares/auth.js
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  module.exports = isAuthenticated;
  