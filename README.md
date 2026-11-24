# Poppins

Sistema web para organizar e enviar comunicados acadêmicos a estudantes de cursos EAD por WhatsApp ou SMS.

> **Escopo atual:** o Poppins é um painel administrativo de notificações manuais. Não é um chatbot conversacional, não consulta uma plataforma EAD automaticamente e não agenda lembretes. O coordenador, professor autorizado ou administrador redige o aviso e escolhe os estudantes matriculados que devem recebê-lo.

## Funcionalidades implementadas

- Login com token JWT e controle de acesso por cargo e instituição.
- Cadastro e gestão de instituições, cursos, usuários e estudantes.
- Autorização de professores para cursos específicos.
- Criação manual de avisos de prazo, prova ou assunto acadêmico.
- Envio individual em lote para estudantes selecionados com matrícula ativa.
- WhatsApp pela Meta Cloud API e opção de SMS pelo Twilio. Se o WhatsApp falhar, o SMS é usado como contingência quando suas credenciais estiverem configuradas.
- Histórico de notificações, registros de falhas e atualização de status pelos webhooks dos provedores.
- Importação de estudantes e matrículas por CSV.
- Validação de telefone e verificações simples para evitar que CPF, e-mail ou telefone sejam incluídos no texto do aviso.

## Tecnologias e linguagens

| Camada | Tecnologias |
| --- | --- |
| Linguagens | JavaScript (ES modules), JSX, HTML e CSS; SQL para o esquema do banco |
| Backend | Node.js 20+, Express 4, `pg`, JWT e `bcryptjs` |
| Frontend | React 18, Vite 6 e `lucide-react` |
| Banco de dados | PostgreSQL 15+ |
| Mensageria | WhatsApp Cloud API da Meta e SMS pelo Twilio |
| Segurança HTTP | Helmet, CORS configurável e validação de assinatura dos webhooks |
| Testes | `node:test` para testes unitários do backend |

O código atual não usa TypeScript, Python, Vue, MongoDB, Firebase Cloud Messaging (FCM) nem uma integração automática com AVA. Essas tecnologias aparecem como alternativas ou propostas no planejamento acadêmico, não como dependências desta implementação.

## Requisitos

- Node.js 20 ou superior e npm.
- PostgreSQL 15 ou superior, em execução.
- Credenciais de um provedor de mensagens para fazer envios reais. Sem elas, é possível iniciar o painel e executar os testes, mas não enviar mensagens.

## Executar localmente

Abra o PowerShell na pasta raiz do projeto (a pasta que contem este `README.md`).

### 1. Configurar o backend

Crie um banco PostgreSQL chamado `poppins` (ou ajuste a URL de conexão) e, no PowerShell:

```powershell
cd backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edite `backend/.env` com os dados do banco e uma chave `JWT_SECRET` aleatória com pelo menos 32 caracteres. Consulte [`.env.example`](backend/.env.example) para a lista completa de opções. O arquivo `.env` contém configurações locais e não deve ser enviado ao Git.

Em seguida, aplique o esquema e crie a conta administrativa:

```powershell
npm run db:schema
npm run create-admin -- "Nome do Administrador" admin@exemplo.com "SuaSenhaComPeloMenos10Caracteres"
npm run dev
```

O comando `create-admin` aceita opcionalmente um quarto argumento com o UUID da instituição: `npm run create-admin -- "Nome" email senha-forte id-da-instituicao`.

### 2. Executar o frontend

Abra outro terminal PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`. Por padrão, o frontend chama a API em `http://localhost:3000/api`; altere `VITE_API_URL` se necessário. O endpoint `GET http://localhost:3000/health` verifica se a API está respondendo.

## Testes e build

Testes unitários do backend:

```powershell
cd backend
npm test
```

Build de produção do frontend:

```powershell
cd frontend
npm run build
```

## Configuração de integrações

As variáveis são lidas pelo backend a partir de `backend/.env`.

- **Obrigatórias para a API:** `DATABASE_URL` e `JWT_SECRET` (mínimo de 32 caracteres).
- **Opcionais com padrões locais:** `PORT` (3000), `JWT_EXPIRES_IN` (8h), `CORS_ORIGIN` (`http://localhost:5173`) e `DEFAULT_PHONE_REGION` (`BR`).
- **WhatsApp:** `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` e, para receber status/verificar o webhook, `META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN`. `META_API_VERSION` usa `v21.0` por padrão.
- **SMS/Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_FROM_NUMBER`. `PUBLIC_API_URL` deve apontar para uma URL pública HTTPS da API ao configurar callbacks de status.

Configure as URLs dos webhooks no painel de cada provedor e use HTTPS fora do ambiente local. Credenciais de produção não devem ser incluídas em issues, documentação ou código.

## Documentação complementar

- [Escopo, requisitos e status](docs/escopo-e-status.md): compara a proposta acadêmica com o que o código realmente implementa.
- [Referência da API](docs/api.md): endpoints, autenticação, permissões e formato da importação CSV.

## Demonstração

Assista à demonstração do projeto no YouTube: https://www.youtube.com/watch?v=0n7OwWISGL8

## Limitações conhecidas

- Os envios são disparados manualmente e processados de forma síncrona; não há fila durável, agendador ou política de retentativa controlada. A contingência imediata de WhatsApp para SMS é a única tentativa por canal alternativo.
- Não existe conector com Moodle ou outra plataforma EAD, nem sincronização automática de calendário, prazos ou matrículas.
- As regras de detecção de dados pessoais em mensagens são verificações heurísticas de padrões comuns, não uma garantia de conformidade legal ou de privacidade.
- Os objetivos de entrega em até 10 segundos e disponibilidade de 99% descritos no planejamento ainda não foram medidos nem são garantidos por esta implementação.
- Os testes existentes cobrem regras de conteúdo; não há, neste momento, uma suíte abrangente de testes de API, integração com provedores ou interface.

Consulte [Escopo, requisitos e status](docs/escopo-e-status.md) para o detalhamento do que está pronto e do que permanece planejado.

<sub>Projeto desenvolvido exclusivamente por Nanhany.</sub>
