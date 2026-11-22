# Dados de demonstração

Depois de configurar o `backend/.env` e aplicar o esquema com `npm run db:schema`, execute no diretório `backend`:

```powershell
npm run db:seed-demo
```

O comando cria a instituição Senac, se ainda não existir, e adiciona Administração, Pedagogia, Sistemas de Informação, Direito e Análise e Desenvolvimento de Sistemas. Pode ser executado novamente: cursos já existentes não são duplicados.

Esse seed é opcional e não cria alunos nem matrículas.
