FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de layer)
COPY package*.json ./
RUN npm install

# Copia código-fonte
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
