CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS instituicoes (
  id_instituicao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_instituicao TEXT NOT NULL,
  url_plataforma TEXT,
  tipo_integracao TEXT NOT NULL DEFAULT 'manual' CHECK (tipo_integracao IN ('api','arquivo','manual')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  cargo TEXT NOT NULL CHECK (cargo IN ('admin','coordenador','professor')),
  id_instituicao UUID REFERENCES instituicoes(id_instituicao),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursos (
  id_curso UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_curso TEXT NOT NULL,
  id_instituicao UUID NOT NULL REFERENCES instituicoes(id_instituicao),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome_curso, id_instituicao)
);

CREATE TABLE IF NOT EXISTS autorizacoes_curso (
  id_usuario UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_curso UUID NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
  autorizado_por UUID REFERENCES usuarios(id_usuario),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_usuario, id_curso)
);

CREATE TABLE IF NOT EXISTS alunos (
  id_aluno UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT NOT NULL,
  status_matricula TEXT NOT NULL DEFAULT 'ativo' CHECK (status_matricula IN ('ativo','trancado','concluido')),
  id_instituicao UUID NOT NULL REFERENCES instituicoes(id_instituicao),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, id_instituicao)
);

CREATE TABLE IF NOT EXISTS matriculas (
  id_aluno UUID NOT NULL REFERENCES alunos(id_aluno) ON DELETE CASCADE,
  id_curso UUID NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','trancado','concluido')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_aluno, id_curso)
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id_notificacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('prazo','prova','aviso')),
  data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  canal_utilizado TEXT NOT NULL CHECK (canal_utilizado IN ('whatsapp','sms')),
  id_usuario UUID NOT NULL REFERENCES usuarios(id_usuario),
  id_curso UUID NOT NULL REFERENCES cursos(id_curso),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entregas_notificacao (
  id_entrega UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_notificacao UUID NOT NULL REFERENCES notificacoes(id_notificacao) ON DELETE CASCADE,
  id_aluno UUID NOT NULL REFERENCES alunos(id_aluno),
  status_entrega TEXT NOT NULL CHECK (status_entrega IN ('pendente','enviada','entregue','falha','limite_excedido')),
  canal_utilizado TEXT NOT NULL CHECK (canal_utilizado IN ('whatsapp','sms')),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo_falha TEXT,
  provider_message_id TEXT,
  UNIQUE (id_notificacao, id_aluno)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGSERIAL PRIMARY KEY,
  id_usuario UUID REFERENCES usuarios(id_usuario),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alunos_instituicao ON alunos(id_instituicao);
CREATE INDEX IF NOT EXISTS idx_cursos_instituicao ON cursos(id_instituicao);
CREATE INDEX IF NOT EXISTS idx_notificacoes_data ON notificacoes(data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_status ON entregas_notificacao(status_entrega, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(criado_em DESC);
