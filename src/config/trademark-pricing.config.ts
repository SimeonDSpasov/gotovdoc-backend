/**
* Trademark Registration Pricing Configuration
*
* SECURITY: This is the backend source of truth for trademark pricing.
* Must mirror the frontend config at src/app/config/trademark-pricing.config.ts.
* Never trust prices from the frontend — always calculate on the backend.
*/

export const TRADEMARK_PRICING = {
 regular: {
  upToThreeClasses: 265.87,   // EUR
  additionalClass: 15.34,     // EUR per class above 3
  priorityClaim: 10.23,       // EUR per convention/exhibition priority claim
 },
 collectiveOrCertified: {
  upToThreeClasses: 516.40,
  additionalClass: 40.90,
  priorityClaim: 10.23,
 },
};

export const VALID_MARK_TYPES = [
 'word', 'figurative', 'combined', '3d', 'color', 'sound',
 'hologram', 'position', 'pattern', 'motion', 'multimedia', 'other',
] as const;

export type MarkType = typeof VALID_MARK_TYPES[number];

/**
* Calculate trademark registration price.
* No VAT is charged — subtotal equals total (these are BPO government fees).
*/
export function calculateTrademarkPrice(params: {
 niceClassCount: number;
 priorityClaimCount: number;
 isCollective: boolean;
 isCertified: boolean;
}): { subtotal: number; vat: number; total: number; currency: string } {
 const tier = (params.isCollective || params.isCertified)
  ? TRADEMARK_PRICING.collectiveOrCertified
  : TRADEMARK_PRICING.regular;

 const baseFee = tier.upToThreeClasses;
 const extraClasses = Math.max(0, params.niceClassCount - 3);
 const additionalClassesFee = extraClasses * tier.additionalClass;
 const priorityFee = params.priorityClaimCount * tier.priorityClaim;

 const subtotal = Math.round((baseFee + additionalClassesFee + priorityFee) * 100) / 100;

 return {
  subtotal,
  vat: 0,
  total: subtotal,
  currency: 'EUR',
 };
}
