import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  jwtSecret: process.env.JWT_SECRET || 'bangbet-super-secret-jwt-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bangbet',
    user: process.env.DB_USER || 'bangbet',
    password: process.env.DB_PASSWORD || 'BangBet_DB_2026!',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  africastalking: {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || '',
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'bangbet-whatsapp-verify',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
