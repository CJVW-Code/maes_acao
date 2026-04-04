# Docker + Prisma — Walkthrough

Este documento descreve como configurar e usar o ambiente de desenvolvimento portátil.

## Configuração Inicial (Em outra máquina)

Se você estiver em um computador novo, siga estes passos:

1. **Instale o Docker Desktop** (Windows/Mac) ou Docker Engine (Linux).
2. **Copie os arquivos de exemplo** para criar seus arquivos de ambiente:
   - No terminal, na raiz do projeto:
     ```bash
     cp backend/.env.docker.example backend/.env.docker
     cp frontend/.env.docker.example frontend/.env.docker
     ```
3. **Preencha as chaves** no [backend/.env.docker](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/.env.docker) (OpenAI, Groq, Supabase Storage, etc.).
4. **Suba os containers**:
   ```bash
   docker compose up -d --build
   ```
   *O banco de dados será criado e o schema aplicado automaticamente pelo [init.sql](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/docker/init.sql).*

5. **Gere o Prisma Client**:
   ```bash
   docker compose exec backend npx prisma generate
   ```

---

## Arquivos Criados

### Docker
| Arquivo | Propósito |
|---------|-----------|
| [backend/Dockerfile](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/Dockerfile) | Container Node.js para o backend |
| [frontend/Dockerfile](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/Dockerfile) | Container Node.js para o frontend |
| [docker-compose.yml](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/docker-compose.yml) | Orquestra 3 serviços: `db` (PostgreSQL 17), `backend`, `frontend` |
| [docker/init.sql](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/docker/init.sql) | Schema completo v1.0 — roda automaticamente no primeiro `up` |

### Ambientes
| Arquivo | Uso |
|---------|-----|
| [backend/.env](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/.env) | Produção / Supabase (não alterado) |
| [backend/.env.docker](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/.env.docker) | Docker local — `DATABASE_URL` aponta para container `db` |
| [frontend/.env.docker](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/.env.docker) | Docker local — `VITE_API_URL=http://localhost:8001/api` |

### Prisma
| Arquivo | Propósito |
|---------|-----------|
| [prisma/schema.prisma](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/prisma/schema.prisma) | 5 enums + 11 models mapeados do SQL |
| [src/config/prisma.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/config/prisma.js) | Singleton do PrismaClient |

---

## Como Usar

### Subir o ambiente Docker
```bash
# Na raiz do projeto (defsul_maes/)
docker compose up -d          # Sobe tudo em background
docker compose logs -f        # Acompanha os logs
docker compose down           # Para tudo
docker compose down -v        # Para tudo E apaga o volume do banco (reset)
```

### Prisma no Docker
```bash
docker compose exec backend npx prisma studio    # GUI do banco na porta 5555
docker compose exec backend npx prisma db pull   # Puxa schema do banco → schema.prisma
```

### Prisma local (sem Docker)
```bash
cd backend
npx prisma generate       # Gera o client
npx prisma db push        # Empurra schema para o banco
npx prisma studio         # GUI do banco
```

### Usar Prisma nos Controllers
```javascript
import { prisma } from "../config/prisma.js";

// Exemplo: buscar caso por protocolo
const caso = await prisma.casos.findUnique({
  where: { protocolo: "MAE-2025-0001" },
  include: { partes: true, juridico: true, ia: true }
});
```

## Hot-Reload (HMR) no Docker

Para que as mudanças no código reflitam instantaneamente no navegador:

### Frontend (Vite)
Já configurei o [vite.config.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/vite.config.js) com `usePolling: true`. Isso é necessário no Windows para que o Docker detecte as mudanças de arquivo.

### Backend (Nodemon)
Se o backend não estiver reiniciando sozinho ao salvar, você pode ativar o modo legacy no [package.json](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/package.json):
```json
"dev": "nodemon --legacy-watch server.js"
```

---

## Status Final
- [x] **Docker**: Todos os containers rodando e saudáveis (`maes_db`, `maes_backend`, `maes_frontend`).
- [x] **Banco de Dados**: Schema v1.0 aplicado com sucesso via [init.sql](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/docker/init.sql).
- [x] **Prisma**: Configurado e verificado. O comando `prisma db pull` confirmou a introspecção de 12 models.

---

## Como Usar (Comandos Atuais)

### Subir o ambiente
```bash
docker compose up -d
```

### Verificar Logs
```bash
docker compose logs -f backend
```

### Prisma (Dentro do Docker)
```bash
docker compose exec backend npx prisma studio
```
