function adminMiddleware(req, res, next) {
  if (req.session && req.session.adminAuth) {
    return next();
  }
  return res.status(401).json({ error: 'Admin access required' });
}

module.exports = { adminMiddleware };