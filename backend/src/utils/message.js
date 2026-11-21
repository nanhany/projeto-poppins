const sensitivePatterns = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\s().-]*){10,}/
];

export function validateAcademicMessage(title, message, category) {
  if (!['prazo', 'prova', 'aviso'].includes(category)) return 'Categoria inválida.';
  if (typeof title !== 'string' || typeof message !== 'string' || !title.trim() || !message.trim()) return 'Título e mensagem são obrigatórios.';
  if (title.length > 120 || message.length > 1500) return 'Título ou mensagem excede o limite permitido.';
  if (sensitivePatterns.some((pattern) => pattern.test(`${title}\n${message}`))) {
    return 'A mensagem parece conter dado pessoal sensível ou identificador. Revise o texto.';
  }
  return null;
}
