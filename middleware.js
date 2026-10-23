// Verify signed tokens before allowing access to protected API routes.
import jwt from 'jsonwebtoken';

// Read the Bearer token and attach its verified user details to the request.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first.' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}

// This guard is used when a route must be restricted to administrators.
export function adminOnly(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}
