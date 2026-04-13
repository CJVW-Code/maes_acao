FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de layer)
COPY package*.json ./
RUN npm install

# Copia código-fonte
# Copia código-fonte
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

EXPOSE 8001

CMD ["npm", "run", "dev"]
