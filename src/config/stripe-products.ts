// src/config/stripe-products.ts

export const STRIPE_PLANS = {
  ESSENTIAL: {
    productId: "prod_U2EE7G0TzQr2I5",
    name: "Plano Essencial",
    prices: {
      MONTHLY: "price_1T49mD4yl3Sv3EJgpsUkyQS5",
      YEARLY: "price_1T49mC4yl3Sv3EJg4GPWTZ04",
    },
  },
  EXPERTS: {
    productId: "prod_U2EEIJgNmix1JE",
    name: "Plano Experts",
    prices: {
      MONTHLY: "price_1T49mD4yl3Sv3EJgf7D9CNh6",
      YEARLY: "price_1T49mB4yl3Sv3EJgu8bdb7ZG",
    },
  },
};

export const STRIPE_ADDONS = {
  APP: {
    productId: "prod_U2EEsRU9L8IFdm",
    name: "Aplicativo para Visualização de Agenda",
    prices: {
      MONTHLY: "price_1T49mD4yl3Sv3EJgWye0TMWr",
      YEARLY: "price_1T49mD4yl3Sv3EJgVvoYq3S4", // <--- Preencha após criar
    },
  },
  FUNNEL: {
    productId: "prod_U2EE2TrjHYJkFE",
    name: "Funil de Vendas",
    prices: {
      MONTHLY: "price_1T49mE4yl3Sv3EJgXWGZaYZJ",
      YEARLY: "price_1T49mE4yl3Sv3EJg78Vm0rKI",
    },
  },
  IA: {
    productId: "prod_U2EEFCmFQm3dQg",
    name: "Módulo IA (Belliun AI)",
    prices: {
      MONTHLY: "price_1T49mE4yl3Sv3EJg9hYIq3kC",
      YEARLY: "price_1T49mD4yl3Sv3EJgq2YxGFlb",
    },
  },
  CRM_WHATS_FUNNEL: {
    productId: "prod_U2EEGlaxCqGTxE",
    name: "CRM + Integração WhatsApp + Funil de Vendas",
    prices: {
      MONTHLY: "price_1T49mC4yl3Sv3EJg7O28hJq6",
      YEARLY: "price_1T49mB4yl3Sv3EJguEz7Kx8S",
    },
  },
  PACK_5_USERS: {
    productId: "prod_U2EE3LKfqCVu4p",
    name: "Pacote +5 Usuários",
    prices: {
      MONTHLY: "price_1T49mC4yl3Sv3EJgicKyuhCw",
      YEARLY: "price_1T49mC4yl3Sv3EJgIDemb6tj",
    },
  },
  ADDITIONAL_USER: {
    productId: "prod_U2EEco9TQANtNy",
    name: "Usuário Adicional (Unitário)",
    prices: {
      MONTHLY: "price_1T49mC4yl3Sv3EJgYzfmYY4n",
      YEARLY: "price_1T49mC4yl3Sv3EJgkMV9ppdo",
    },
  },
};
