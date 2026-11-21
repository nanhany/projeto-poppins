# Poppins

Sistema administrativo de notificações acadêmicas para plataformas EAD. O Poppins não é um chatbot: não interpreta mensagens de alunos nem gera conteúdo. Coordenadores e professores autorizados escrevem avisos acadêmicos e escolhem os alunos matriculados que devem recebê-los.

## Escopo implementado nesta base

- API Node.js/Express com autenticação JWT e autorização por cargo/instituição.
- PostgreSQL com instituições, usuários, cursos, alunos, matrículas, notificações, entregas e auditoria.
- Envio WhatsApp pela Meta Cloud API e SMS via Twilio, habilitados somente com credenciais configuradas.
- CSV de matrículas e alunos com cabeçalho documentado no endpoint de importação.
- Interface React para login, composição manual, seleção de curso e histórico.
- Registros de falhas e status de entrega por aluno.

## Requisitos

- Node.js 20+
- PostgreSQL 15+

## Desenvolvimento

1. Copie `backend/.env.example` para `backend/.env` e configure `DATABASE_URL`, `JWT_SECRET` e ao menos as variáveis do canal que pretende usar.
2. Crie um banco PostgreSQL e rode `backend/src/database/schema.sql`.
3. No diretório `backend`, execute `npm install`, crie o administrador inicial com `npm run create-admin -- "Nome" email senha-forte` e inicie com `npm run dev`.
4. No diretório `frontend`, execute `npm install` e `npm run dev`.

A interface usa `VITE_API_URL` (padrão `http://localhost:3000/api`). O primeiro usuário administrador deve ser criado diretamente no banco ou por um processo de provisionamento controlado; não há cadastro público.

## CSV de integração

`POST /api/integrations/csv` recebe `multipart/form-data`, campo `file`, e as colunas `nome,email,telefone,status_matricula,curso`. O curso deve existir na instituição do usuário. Matrículas ativas são criadas/atualizadas e os números são normalizados para E.164 quando possível.

## Segurança e configuração

- Nunca commite `.env` ou credenciais de provedores.
- Configure `GET/POST /webhooks/meta` na Meta e `POST /webhooks/twilio` no Twilio, com os respectivos segredos e `PUBLIC_API_URL`, para atualizar status de entrega.
- Restrições de dados sensíveis são validações determinísticas de padrões comuns (CPF, e-mail e telefone); isso não substitui revisão humana.
- O envio é síncrono no disparo da API. Para escala, alta disponibilidade e garantia de entrega em até 10 segundos, será necessário provisionar fila durável, workers, observabilidade, redundância e testes de carga no ambiente de destino.

## Rotas principais

- `POST /api/auth/login`
- `GET/POST /api/courses`, `GET/POST /api/students`, `GET/POST /api/institutions` (admin), `GET/POST /api/users` (admin)
- `POST /api/notifications` para criar e enviar notificação manual
- `GET /api/notifications` e `GET /api/logs`
- `POST /api/integrations/csv`

Todos os endpoints administrativos (exceto login) exigem `Authorization: Bearer <token>`. Professores só veem cursos e podem enviar avisos para cursos associados por um coordenador ou administrador em `POST /api/courses/:id/authorized-users`.

Os testes unitários determinísticos das regras de conteúdo ficam em `backend/src/utils/message.test.js` e podem ser executados com `npm test`.
