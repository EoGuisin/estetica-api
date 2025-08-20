// src/services/auth.service.ts
import { prisma } from "../lib/prisma";
import { LoginInput } from "../schemas/auth.schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    // 1. Encontrar o usuário e INCLUIR os dados da clínica relacionada
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinic: true, // A MÁGICA ACONTECE AQUI!
      },
    });

    if (!user) {
      throw new Error("Email ou senha inválidos.");
    }

    // 2. Verificar a senha
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Email ou senha inválidos.");
    }

    // 3. Gerar o token JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("Chave secreta JWT não configurada.");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        roleId: user.roleId,
        clinicId: user.clinicId,
      },
      secret,
      { expiresIn: "7d" }
    );

    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }
}
