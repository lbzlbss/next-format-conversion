import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail } from '../../../../lib/db/users.js';
import { isDatabaseConfigured } from '../../../../lib/db/client.js';
import { ApiError, toErrorResponse } from '../../_lib/guard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password) {
  if (password.length < 8) {
    throw new ApiError('INVALID_PASSWORD', '密码至少 8 位', 400);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ApiError(
      'INVALID_PASSWORD',
      '密码需同时包含字母与数字',
      400,
    );
  }
}

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
export async function POST(request) {
  try {
    if (!isDatabaseConfigured()) {
      throw new ApiError(
        'DB_NOT_CONFIGURED',
        '数据库未配置，暂无法注册',
        503,
      );
    }

    const body = await request.json();
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? '');
    const name = body?.name ? String(body.name).trim() : null;

    if (!email || !EMAIL_RE.test(email)) {
      throw new ApiError('INVALID_EMAIL', '邮箱格式不正确', 400);
    }
    validatePassword(password);

    const existing = await findUserByEmail(email);
    if (existing) {
      throw new ApiError('EMAIL_EXISTS', '该邮箱已注册', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, name });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
