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

// --- NOVA INTERFACE (para o payload do JWT) ---
// Note que roleId e clinicId podem ser nulos
interface UserPayload {
  userId: string;
  roleId: string | null;
  clinicId: string | null;
  accountId: string; // Todos agora pertencem a uma conta
}

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        clinic: {
          select: { accountId: true, id: true, name: true, status: true },
        },
        ownedAccount: { select: { id: true } },
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

    // --- LÓGICA PARA DESCOBRIR O ID DA CONTA ---
    let accountId: string;

    if (user.clinicId && user.clinic) {
      accountId = user.clinic.accountId;
    } else if (user.ownedAccount) {
      accountId = user.ownedAccount.id;
    } else {
      console.error(`Usuário ${user.id} não é nem dono nem funcionário.`);
      throw {
        code: "UNAUTHORIZED",
        message: "Configuração de usuário inválida.",
      };
    }

    // Monta payload do token
    const payload: UserPayload = {
      userId: user.id,
      roleId: user.roleId,
      clinicId: user.clinicId,
      accountId: accountId,
    };

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    const { passwordHash, clinic, ownedAccount, ...userBase } = user;

    const userToReturn = {
      ...userBase,
      accountId: accountId,
    };

    return { user: userToReturn, token };
  }

  static async register(data: RegisterInput) {
    const { email, taxId, password, fullName, clinicName, isProfessional } =
      data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw { code: "CONFLICT", message: "Este email já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({ where: { taxId } });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          isProfessional: isProfessional,
          scheduleStartHour: isProfessional ? "08:00" : null,
          scheduleEndHour: isProfessional ? "18:00" : null,
          appointmentDuration: isProfessional ? 60 : null,
          workingDays: isProfessional
            ? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
            : [],
        },
      });

      const newAccount = await tx.account.create({
        data: { ownerId: newUser.id },
      });

      const newClinic = await tx.clinic.create({
        data: {
          name: clinicName,
          taxId: taxId,
          status: "ACTIVE",
          accountId: newAccount.id,
        },
      });

      const adminRole = await tx.role.create({
        data: {
          name: "Administrador",
          type: "ADMIN",
          description: "Acesso total ao sistema da clínica",
          isSuperAdmin: true,
          clinicId: newClinic.id,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: {
          roleId: adminRole.id,
        },
      });

      return { newUser: updatedUser, newAccount };
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    const payload: UserPayload = {
      userId: result.newUser.id,
      roleId: null,
      clinicId: null,
      accountId: result.newAccount.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    const { passwordHash: _, ...userBase } = result.newUser;

    const userToReturn = {
      ...userBase,
      accountId: result.newAccount.id,
    };

    return {
      user: userToReturn,
      account: result.newAccount,
      token,
    };
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

      // --- MUDANÇA AQUI: Removido "onboarding@resend.dev" ---
      // Usando o domínio de produção verificado
      await resend.emails.send({
        from: "Belliun <nao-responda@belliun.com.br>",
        to: user.email,
        subject: "Redefinição de Senha - Belliun",
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
