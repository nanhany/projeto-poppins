import 'dotenv/config';
import { pool } from '../database/pool.js';

const institutionName = 'Senac';
const courseNames = [
  'Administração',
  'Pedagogia',
  'Sistemas de Informação',
  'Direito',
  'Análise e Desenvolvimento de Sistemas',
];

const client = await pool.connect();
let transactionStarted = false;

try {
  await client.query('BEGIN');
  transactionStarted = true;

  let institution = await client.query(
    'SELECT id_instituicao FROM instituicoes WHERE lower(nome_instituicao)=lower($1) ORDER BY criado_em LIMIT 1',
    [institutionName],
  );

  if (!institution.rowCount) {
    institution = await client.query(
      "INSERT INTO instituicoes(nome_instituicao,tipo_integracao) VALUES($1,'manual') RETURNING id_instituicao",
      [institutionName],
    );
  }

  const institutionId = institution.rows[0].id_instituicao;
  const createdCourses = [];

  for (const courseName of courseNames) {
    const result = await client.query(
      'INSERT INTO cursos(nome_curso,id_instituicao) VALUES($1,$2) ON CONFLICT (nome_curso,id_instituicao) DO NOTHING RETURNING nome_curso',
      [courseName, institutionId],
    );
    if (result.rowCount) createdCourses.push(result.rows[0].nome_curso);
  }

  await client.query('COMMIT');
  transactionStarted = false;
  console.log(`Dados de demonstração aplicados. Cursos novos: ${createdCourses.length}.`);
} catch (error) {
  if (transactionStarted) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Não foi possível reverter a transação:', rollbackError.message);
    }
  }
  console.error('Não foi possível aplicar os dados de demonstração:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
