import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { config } from '../../config';
import { AppError } from '../../utils/errors';

interface AuthPayload {
  id: string;
  email: string;
  name: string | null;
}

interface AuthResult {
  user: AuthPayload;
  token: string;
}

function signToken(user: AuthPayload): string {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'This email is already registered', 'DUPLICATE_EMAIL');
  }

  const hashed = await bcrypt.hash(password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: { email, password: hashed, name: name || null },
  });

  const payload: AuthPayload = { id: user.id, email: user.email, name: user.name };
  const token = signToken(payload);

  return { user: payload, token };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const payload: AuthPayload = { id: user.id, email: user.email, name: user.name };
  const token = signToken(payload);

  return { user: payload, token };
}

export function verifyToken(token: string): AuthPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    return { id: decoded.id, email: decoded.email, name: null };
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }
}

export async function getMe(userId: string): Promise<AuthPayload> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
  }
  return { id: user.id, email: user.email, name: user.name };
}
