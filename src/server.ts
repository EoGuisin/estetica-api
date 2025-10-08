import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

app.listen({
  host: '0.0.0.0', 
  port: PORT,
}).then(() => {
  console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
});