// Store-wide settings. This is the file to edit when you make the store yours.

export const CONFIG = {
  storeName: '3RD RAIL',
  tagline: 'THE SHOP UNDER THE CITY',
  currency: 'USD',
  currencySymbol: '$',

  // Shipping: flat rate, free above the threshold.
  shipping: { flat: 6, freeOver: 75 },

  // Tokens back per dollar spent (cashback), applied after checkout.
  tokensPerDollar: 2,

  // Checkout.
  //   'demo' — orders are saved on this device only, nobody is charged.
  //   'link' — send the shopper to your own hosted checkout (Shopify, Stripe
  //            Payment Links, Gumroad...). The URL receives ?order=<json>.
  checkout: {
    mode: 'demo',
    url: '',
  },
};

export function money(n) {
  return `${CONFIG.currencySymbol}${(Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0)}`;
}
