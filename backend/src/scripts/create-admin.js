import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../database/pool.js';

const [nome, email, senha, idInstituicao = null] = process.argv.slice(2);
if (!nome || !email || !senha || senha.length < 10) {
  console.error('Uso: npm run create-admin -- "Nome" email senha-forte [id-instituicao]');
  process.exitCode = 1;
} else {
  try {
    const result = await pool.query(`INSERT INTO usuarios(nome,email,senha_hash,cargo,id_instituicao)
      VALUES($1,$2,$3,'admin',$4) RETURNING id_usuario,email`, [nome, email, await bcrypt.hash(senha, 12), idInstituicao]);
    console.log(`Administrador criado: ${result.rows[0].email} (${result.rows[0].id_usuario})`);
  } catch (error) {
    console.error('Não foi possível criar o administrador:', error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
