import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database/pool.js';

export async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    const result = await pool.query('SELECT id_usuario,nome,email,senha_hash,cargo,id_instituicao,ativo FROM usuarios WHERE lower(email)=lower($1)', [email || '']);
    const user = result.rows[0];
    if (!user || !user.ativo || !(await bcrypt.compare(senha || '', user.senha_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
    const token = jwt.sign({ sub: user.id_usuario, nome: user.nome, email: user.email, cargo: user.cargo, id_instituicao: user.id_instituicao }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user: { id: user.id_usuario, nome: user.nome, email: user.email, cargo: user.cargo, id_instituicao: user.id_instituicao } });
  } catch (error) { next(error); }
}
