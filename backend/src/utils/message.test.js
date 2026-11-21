import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAcademicMessage } from './message.js';

test('allows a manually written academic deadline notice', () => {
  assert.equal(validateAcademicMessage('Prazo da atividade', 'Envie a atividade até sexta-feira.', 'prazo'), null);
});

test('rejects categories outside the academic scope', () => {
  assert.equal(validateAcademicMessage('Olá', 'Texto', 'marketing'), 'Categoria inválida.');
});

test('requires a title and message', () => {
  assert.equal(validateAcademicMessage('', 'Texto', 'aviso'), 'Título e mensagem são obrigatórios.');
});

test('blocks common personal identifiers in message content', () => {
  assert.match(validateAcademicMessage('Aviso', 'CPF 123.456.789-00', 'aviso'), /dado pessoal/);
  assert.match(validateAcademicMessage('Aviso', 'Escreva para aluno@exemplo.com', 'aviso'), /dado pessoal/);
});
