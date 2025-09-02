// src/services/auth.service.ts
import { prisma } from "../lib/prisma";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../schemas/auth.schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinic: true,
      },
    });

    if (!user) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

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

  static async register(data: RegisterInput) {
    const { email, taxId, password, fullName, clinicName } = data;

    // 1. Verificar se o email ou CNPJ já existem
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Lançar um erro específico para conflito
      throw { code: "CONFLICT", message: "Este email já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({ where: { taxId } });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Criptografar a senha
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Criar a Clínica e o Usuário em uma única transação
    // Isso garante que se a criação do usuário falhar, a da clínica será desfeita.
    const result = await prisma.$transaction(async (tx) => {
      // Encontrar o ID da função 'Admin' ou 'Proprietário'
      // IMPORTANTE: Você precisa ter essa função cadastrada no seu banco!
      const adminRole = await tx.role.findFirst({
        where: { name: "admin" }, // ou o nome que você deu para o dono da clínica
      });

      if (!adminRole) {
        throw new Error(
          "Função de administrador não encontrada. Configure as funções no banco."
        );
      }

      // Criar a clínica
      const newClinic = await tx.clinic.create({
        data: {
          name: clinicName,
          taxId: taxId,
          // O status 'PENDING_PAYMENT' será o padrão definido no schema
        },
      });

      // Criar o usuário
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          clinicId: newClinic.id,
          roleId: adminRole.id,
        },
        include: {
          clinic: true,
        },
      });

      return newUser;
    });

    // 4. Gerar um token JWT para auto-login
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    const token = jwt.sign(
      { userId: result.id, roleId: result.roleId, clinicId: result.clinicId },
      secret,
      { expiresIn: "7d" }
    );

    // 5. Retornar os dados
    const { passwordHash: _, ...userWithoutPassword } = result;
    return { user: userWithoutPassword, token };
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const { email } = data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // Expira em 1 hora

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      await resend.emails.send({
        from: "Acme <onboarding@resend.dev>",
        to: user.email,
        subject: "Redefinição de Senha - AURA",
        html: `<p>Olá ${user.fullName},</p><p>Você solicitou a redefinição de sua senha. Clique no link abaixo para criar uma nova senha:</p><a href="${resetLink}">Redefinir Senha</a><p>Se você não solicitou isso, por favor, ignore este email.</p>`,
      });
    }
    return {
      message:
        "Se um usuário com este email existir, um link de redefinição foi enviado.",
    };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const { token, password } = data;

    // 1. Encontrar o token no banco
    const savedToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!savedToken) {
      throw { code: "NOT_FOUND", message: "Token inválido ou expirado." };
    }

    // 2. Verificar se o token expirou
    if (new Date() > savedToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { id: savedToken.id } });
      throw {
        code: "GONE",
        message: "Token expirado. Por favor, solicite um novo.",
      };
    }

    // 3. Criptografar a nova senha
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Atualizar a senha do usuário e deletar o token em uma transação
    await prisma.$transaction([
      prisma.user.update({
        where: { id: savedToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: savedToken.id },
      }),
    ]);

    return { message: "Senha redefinida com sucesso!" };
  }
}
