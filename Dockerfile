# Imagen base Node
FROM node:18

# Crear directorio de la app
WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Puerto expuesto
EXPOSE 8083

# Comando por defecto
CMD ["node", "src/app.js"]
