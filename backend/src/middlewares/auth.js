import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.cargo)
    ? next()
    : res.status(403).json({ error: 'Você não tem autorização para esta ação.' });
}
