export const FREE_MAX_PLAYERS = 16;
export const PRO_LAUNCH_PRICE_USD = 10;

/**
 * Editable commercial & semi-manual fulfillment details for the \$10 Pro launch tier.
 * Update WhatsApp link, USDC address, or contact email here anytime without touching license verification.
 */
export const PRO_PURCHASE_CONFIG = {
  priceUsd: PRO_LAUNCH_PRICE_USD,
  contactEmail: 'villasana26enrique@gmail.com',
  githubContactUrl: 'https://github.com/villasana26enrique/domino-tournament-manager/issues',
  // Optional: fill in your WhatsApp link (e.g. 'https://wa.me/58...') or USDC wallet address when ready.
  whatsappUrl: '',
  usdcWalletNote: '',
  acceptedMethods: {
    en: 'USDC · Zelle · PayPal · Pago Móvil',
    es: 'USDC · Zelle · PayPal · Pago Móvil'
  }
} as const;
