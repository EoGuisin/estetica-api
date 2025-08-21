import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", AuthController.login);
  app.post("/register", AuthController.register);
  app.post("/forgot-password", AuthController.forgotPassword);
  app.post("/reset-password", AuthController.resetPassword);
}
