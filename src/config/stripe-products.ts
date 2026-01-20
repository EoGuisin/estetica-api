// src/config/stripe-products.ts

export const STRIPE_PLANS = {
  ESSENTIAL: {
    productId: "prod_Tmta0Ivq0JuL3B",
    name: "Plano Essencial",
    prices: {
      MONTHLY: "price_1SpJnQ98FBliezJxOCLkHyqt",
      YEARLY: "price_1SpMGb98FBliezJx6kFf13E9",
    },
  },
  EXPERTS: {
    productId: "prod_TmtnXmlqdFR6D8",
    name: "Plano Experts",
    prices: {
      MONTHLY: "price_1SpJzv98FBliezJxT7Tndnl0",
      YEARLY: "price_1SpMHH98FBliezJx2qEilGfa",
    },
  },
};

export const STRIPE_ADDONS = {
  APP: {
    productId: "prod_TmuWS32TTYJX7I",
    name: "Aplicativo para Visualização de Agenda",
    prices: {
      MONTHLY: "price_1SpKhY98FBliezJxwH4qfmOS",
      YEARLY: "price_1SpMVW98FBliezJxqj4qondA", // <--- Preencha após criar
    },
  },
  FUNNEL: {
    productId: "prod_TmuW6TqpBv19J1",
    name: "Funil de Vendas",
    prices: {
      MONTHLY: "price_1SpKh098FBliezJxtFvrxyEQ",
      YEARLY: "price_1SpMUa98FBliezJxUYrGf0h6",
    },
  },
  IA: {
    productId: "prod_TmuVPm3gYsg2OD",
    name: "Módulo IA (Belliun AI)",
    prices: {
      MONTHLY: "price_1SpKgW98FBliezJxb5KTqew9",
      YEARLY: "price_1SpMWP98FBliezJxz7dP6ww9",
    },
  },
  CRM_WHATS_FUNNEL: {
    productId: "prod_TmuVt9EChQe5Gm",
    name: "CRM + Integração WhatsApp + Funil de Vendas",
    prices: {
      MONTHLY: "price_1SpKgB98FBliezJxW35bfs9S",
      YEARLY: "price_1SpMX998FBliezJx7SJxmXLj",
    },
  },
  PACK_5_USERS: {
    productId: "prod_TmuUQ3DEOXj6XF",
    name: "Pacote +5 Usuários",
    prices: {
      MONTHLY: "price_1SpKfb98FBliezJxJPJ2uzew",
      YEARLY: "price_1SpMXd98FBliezJxj9BOTbB4",
    },
  },
  ADDITIONAL_USER: {
    productId: "prod_TmuUfcZNLM2cZU",
    name: "Usuário Adicional (Unitário)",
    prices: {
      MONTHLY: "price_1SpKfA98FBliezJxDLSvDWK3",
      YEARLY: "price_1SpMY698FBliezJxks2Uw0r1",
    },
  },
};
