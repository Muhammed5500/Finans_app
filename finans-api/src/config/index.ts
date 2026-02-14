import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};

// Re-export market configs
export * from './crypto';
export * from './bist';
