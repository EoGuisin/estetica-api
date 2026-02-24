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

interface UserPayload {
  userId: string;
  roleId: string | null;
  clinicId: string | null;
  accountId: string;
}

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        // CORREÇÃO 1: Mudamos de 'clinic' para 'clinics' (Array)
        clinics: {
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

    // --- CORREÇÃO 2: Lógica para descobrir a Conta ---
    let accountId: string;

    if (user.ownedAccount) {
      // Se é dono, usa a conta dele
      accountId = user.ownedAccount.id;
    } else if (user.clinics && user.clinics.length > 0) {
      // Se é funcionário, pega a conta da primeira clínica vinculada
      accountId = user.clinics[0].accountId;
    } else {
      // Caso raro: Usuário existe mas não tem conta nem clínica (erro de dados)
      throw {
        code: "UNAUTHORIZED",
        message: "Usuário sem vínculo com nenhuma conta.",
      };
    }

    // Define um clinicId "padrão" para o token
    const defaultClinicId =
      user.clinics && user.clinics.length > 0 ? user.clinics[0].id : null;

    const payload: UserPayload = {
      userId: user.id,
      roleId: user.roleId,
      clinicId: defaultClinicId,
      accountId: accountId,
    };

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    // Remove dados sensíveis
    const { passwordHash, clinics, ownedAccount, ...userBase } = user;

    const userToReturn = {
      ...userBase,
      accountId: accountId,
      clinics: clinics,
      ownedAccount: ownedAccount,
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
      // 1. Cria usuário
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

      // 2. Cria conta
      const newAccount = await tx.account.create({
        data: { ownerId: newUser.id },
      });

      // 3. Cria clínica vinculada à conta
      const newClinic = await tx.clinic.create({
        data: {
          name: clinicName,
          taxId: taxId,
          status: "ACTIVE",
          accountId: newAccount.id,
        },
      });

      // 4. Cria papel de Admin
      const adminRole = await tx.role.create({
        data: {
          name: "Administrador",
          type: "ADMIN",
          description: "Acesso total ao sistema da clínica",
          isSuperAdmin: true,
          clinicId: newClinic.id,
        },
      });

      // 5. Atualiza usuário: define papel E VINCULA À CLÍNICA (N:N)
      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: {
          roleId: adminRole.id,
          // CORREÇÃO 3: Connect usando a nova sintaxe N:N
          clinics: {
            connect: { id: newClinic.id },
          },
        },
      });

      return { newUser: updatedUser, newAccount, newClinic };
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    const payload: UserPayload = {
      userId: result.newUser.id,
      roleId: result.newUser.roleId,
      clinicId: result.newClinic.id,
      accountId: result.newAccount.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    const { passwordHash: _, ...userBase } = result.newUser;

    const userToReturn = {
      ...userBase,
      accountId: result.newAccount.id,
      ownedAccount: { id: result.newAccount.id },
      clinics: [
        {
          id: result.newClinic.id,
          name: result.newClinic.name,
          status: result.newClinic.status,
          accountId: result.newAccount.id,
        },
      ],
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
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      const { error } = await resend.emails.send({
        from: "Belliun <nao-responda@belliun.com.br>",
        to: user.email,
        subject: "Redefinição de Senha - Belliun",
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333; background-color: #f4f4f5; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #000; font-size: 24px; font-weight: bold; margin: 0;">Belliun</h1>
              </div>

              <p style="font-size: 16px; margin-bottom: 20px;">Olá, <strong>${
                user.fullName
              }</strong>.</p>
              
              <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
                Recebemos uma solicitação para redefinir a senha da sua conta. Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha:
              </p>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${resetLink}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Redefinir Minha Senha
                </a>
              </div>

              <p style="font-size: 14px; color: #888; margin-bottom: 10px;">
                Este link expira em <strong>1 hora</strong>.
              </p>
              <p style="font-size: 14px; color: #888; margin-bottom: 0;">
                Se você não fez essa solicitação, pode ignorar este e-mail com segurança. Sua senha permanecerá a mesma.
              </p>

              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 40px 0 20px 0;" />

              <div style="text-align: center; font-size: 12px; color: #999;">
                <p style="margin: 0;">© ${new Date().getFullYear()} Belliun. Todos os direitos reservados.</p>
              </div>

            </div>
          </div>
        `,
      });

      if (error) {
        console.error("ERRO RESEND:", error);
        throw new Error(`Falha ao enviar email: ${error.message}`);
      }
    }

    return {
      message:
        "Se um usuário com este email existir, um link de redefinição foi enviado.",
    };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const { token, password } = data;

    const savedToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!savedToken) {
      throw { code: "NOT_FOUND", message: "Token inválido ou expirado." };
    }

    if (new Date() > savedToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { id: savedToken.id } });
      throw {
        code: "GONE",
        message: "Token expirado. Por favor, solicite um novo.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

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
