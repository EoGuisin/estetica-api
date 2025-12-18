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

    // --- MUDANÇA AQUI ---
    // Buscamos o usuário e suas *potenciais* relações (de Dono ou de Funcionário)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinic: { select: { accountId: true } }, // Se for funcionário, pegamos o accountId da clínica
        ownedAccount: { select: { id: true } }, // Se for dono, pegamos o ID da conta dele
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

    // --- MUDANÇA AQUI ---
    // Monta o payload do JWT dinamicamente
    let payload: UserPayload;

    if (user.clinicId && user.clinic) {
      // É um FUNCIONÁRIO
      payload = {
        userId: user.id,
        roleId: user.roleId,
        clinicId: user.clinicId,
        accountId: user.clinic.accountId, // O ID da conta "mãe"
      };
    } else if (user.ownedAccount) {
      // É um DONO
      payload = {
        userId: user.id,
        roleId: null, // Dono não tem "Role" de clínica
        clinicId: null, // Dono não tem *uma* clínica, tem várias
        accountId: user.ownedAccount.id, // O ID da conta dele
      };
    } else {
      // Caso de erro: usuário órfão (sempre bom ter um fallback)
      console.error(`Usuário ${user.id} não é nem dono nem funcionário.`);
      throw {
        code: "UNAUTHORIZED",
        message: "Configuração de usuário inválida.",
      };
    }

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    // --- MUDANÇA AQUI ---
    // Removemos o ownedAccount e clinic do objeto de retorno para
    // manter a resposta limpa, assim como era antes.
    const { passwordHash, clinic, ownedAccount, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  static async register(data: RegisterInput) {
    const { email, taxId, password, fullName, clinicName, isProfessional } =
      data;

    // 1. Verificar se o email ou CNPJ já existem
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw { code: "CONFLICT", message: "Este email já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({ where: { taxId } });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Criptografar a senha
    const passwordHash = await bcrypt.hash(password, 10);

    // --- MUDANÇA AQUI ---
    // A transação agora cria a nova arquitetura:
    // User (Dono) -> Account (Empresa) -> Clinic (Primeira Loja)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o usuário (DONO)
      // Note que clinicId e roleId são nulos, como manda o novo schema
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

      // 2. Criar a "Conta" (a empresa/dono do plano)
      const newAccount = await tx.account.create({
        data: { ownerId: newUser.id },
      });

      // 3. Criar a *primeira* Clínica
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
          clinicId: newClinic.id, // VINCULADO À CLÍNICA!
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

    // 4. Gerar um token JWT para auto-login
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    // --- MUDANÇA AQUI ---
    // O payload do token de registro é de um DONO
    const payload: UserPayload = {
      userId: result.newUser.id,
      roleId: null,
      clinicId: null,
      accountId: result.newAccount.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    // 5. Retornar os dados
    const { passwordHash: _, ...userWithoutPassword } = result.newUser;
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
