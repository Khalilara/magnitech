export type CheckoutDetails={firstName:string;lastName:string;email:string;phone:string;country:string;city:string;address:string;postalCode:string;instructions:string};
export interface PaymentProvider { readonly enabled:boolean; createCheckout(details:CheckoutDetails,cart:Record<string,number>):Promise<never>; }
/** Frontend-only placeholder. Never reports a payment as successful. */
export const paymentProvider:PaymentProvider={enabled:false,async createCheckout(){throw new Error("Hosted payments are not configured. No payment has been taken.");}};
