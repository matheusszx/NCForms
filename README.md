# NCForms

Alternativa self-hosted ao Google Forms: crie formulários com vários tipos de pergunta, compartilhe por link público e veja as respostas uma a uma.

- **Frontend:** Angular 21 (standalone + signals) + Tailwind CSS 4
- **Backend:** Spring Boot 4.1 (Java 17) + Spring Security (JWT) + Spring Data JPA + Flyway
- **Banco:** PostgreSQL 16
- **Deploy:** Docker Compose (Postgres + API + Nginx servindo o Angular e fazendo proxy de `/api`)

## Funcionalidades

- Contas de criadores (login com e-mail e senha); cada usuário vê apenas os próprios formulários.
- Tela inicial com botão de novo formulário e lista de todos os formulários (status, nº de respostas, busca).
- Editor com título/descrição e campos ilimitados, reordenáveis por arrastar e soltar:
  resposta curta, parágrafo, múltipla escolha, caixas de seleção, lista suspensa, escala linear,
  e-mail, número, data e títulos de seção. Qualquer pergunta pode ser **obrigatória**.
- Configurações por tipo: texto de exemplo, limite de caracteres, mínimo/máximo numérico,
  mínimo/máximo de seleções, faixa e rótulos da escala.
- Pré-visualização idêntica ao que o respondente verá.
- Publicação com link público `/f/{código}` (sem login para responder); formulário pode ser fechado e reaberto.
- Validação no navegador **e** no servidor (obrigatórios, formatos, limites).
- Resultados: lista de respostas e visualização individual com navegação anterior/próxima.
- Editar um formulário que já tem respostas não perde dados: perguntas/opções removidas são arquivadas
  e continuam aparecendo nas respostas antigas.

## Instalação no servidor (Docker Compose)

Pré-requisitos: Docker e Docker Compose.

```bash
git clone <repo> ncforms && cd ncforms
cp .env.example .env
# edite .env: defina DB_PASSWORD e um JWT_SECRET longo (ex.: openssl rand -base64 48)
docker compose up -d --build
```

O app fica disponível em `http://<servidor>:${APP_PORT}` (padrão porta 80).

1. Acesse `/register` e crie sua conta.
2. Se não quiser que outras pessoas criem contas, defina `APP_REGISTRATION_ENABLED=false` no `.env`
   e rode `docker compose up -d` novamente.

### HTTPS

Coloque um proxy reverso com TLS na frente (Caddy, Traefik ou Nginx com Let's Encrypt) apontando para a
porta do serviço `frontend`. Exemplo com Caddy (`Caddyfile`):

```
forms.seudominio.com {
    reverse_proxy localhost:80
}
```

### Backup e restauração

```bash
docker compose exec postgres pg_dump -U ncforms ncforms > backup.sql
docker compose exec -T postgres psql -U ncforms ncforms < backup.sql
```

Os dados ficam no volume Docker `pgdata`.

### Atualização

```bash
git pull
docker compose up -d --build
```

As migrações do banco (Flyway) rodam automaticamente na inicialização do backend.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_PASSWORD` | — (obrigatória) | Senha do Postgres |
| `JWT_SECRET` | — (obrigatória) | Segredo para assinar tokens (mín. 32 caracteres) |
| `JWT_EXPIRATION` | `PT8H` | Duração da sessão (ISO-8601) |
| `APP_REGISTRATION_ENABLED` | `true` | Permite criar novas contas |
| `APP_PORT` | `80` | Porta HTTP publicada |
| `DB_PORT` | `5432` | Porta do Postgres exposta só em `127.0.0.1` |

## Desenvolvimento

Pré-requisitos: JDK 17+, Node 22.12+ e Docker.

```bash
# 1. Banco
docker compose up -d postgres        # usa DB_PASSWORD do .env

# 2. Backend (http://localhost:8080) — a senha precisa bater com a do .env
cd backend
DB_PASSWORD=<senha-do-.env> ./mvnw spring-boot:run      # Windows: mvnw.cmd

# 3. Frontend (http://localhost:4200, com proxy de /api para :8080)
cd frontend
npm install
npm start
```

> O projeto inclui `frontend/.npmrc` com `legacy-peer-deps=true` para contornar um bug de
> resolução de dependências do npm 11.3.

### Testes

```bash
cd backend && ./mvnw test        # unitários + integração (Testcontainers; requer Docker)
cd frontend && npx ng test --watch=false
```

Os testes de integração do backend são ignorados automaticamente quando o Docker não está disponível.

## API

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | — | Cria conta / entra (retorna JWT) |
| GET | `/api/auth/config` | — | Se o cadastro está habilitado |
| GET | `/api/auth/me` | ✔ | Usuário atual |
| GET · POST | `/api/forms` | ✔ | Lista / cria formulário |
| GET · PUT · DELETE | `/api/forms/{id}` | ✔ | Detalhe / salva estrutura completa / exclui |
| POST | `/api/forms/{id}/publish` · `/close` | ✔ | Publica (ou reabre) / fecha |
| GET | `/api/forms/{id}/responses?page&size` | ✔ | Respostas paginadas (mais recentes primeiro) |
| GET · DELETE | `/api/forms/{id}/responses/{rid}` | ✔ | Resposta individual / exclui |
| GET | `/api/public/forms/{slug}` | — | Formulário publicado (404 rascunho, 410 fechado) |
| POST | `/api/public/forms/{slug}/responses` | — | Envia resposta (`{"answers": {"<fieldId>": valor}}`) |

Valores das respostas: texto/e-mail/data (`"2024-12-31"`) como string, número e escala como número,
múltipla escolha/lista como id da opção e caixas de seleção como array de ids.

## Estrutura

```
backend/   Spring Boot — pacotes auth, form, response, publicapi, common, config
frontend/  Angular — core (API, auth, modelos), features (auth, dashboard, builder, results,
           public-form), shared (renderizador de formulário, componentes de UI)
docker-compose.yml, .env.example
```
