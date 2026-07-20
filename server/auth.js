import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const sign = (payload) => jwt.sign(payload, SECRET, { expiresIn: '7d' });
export const verify = (token) => {
  try { return jwt.verify(token, SECRET); } catch { return null; }
};
export const hash = (p) => bcrypt.hashSync(p, 10);
export const compare = (p, h) => bcrypt.compareSync(p, h);

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.user = token ? verify(token) : null;
  next();
}