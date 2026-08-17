function authMiddleware(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function ownerMiddleware(req, res, next) {
  const config = require('../../../config.json');
  if (req.session && req.session.user && config.ownerIds.includes(req.session.user.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Not authorized' });
}

module.exports = { authMiddleware, ownerMiddleware };
