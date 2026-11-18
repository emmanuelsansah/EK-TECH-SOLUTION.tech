declare module '@paystack/inline-js' {
  export interface PaystackTransactionResult {
    id?: number | string;
    reference: string;
    message?: string;
    status?: string;
    trans?: string;
    transaction?: string;
    trxref?: string;
  }

  export interface PaystackCallbacks {
    onSuccess?: (transaction: PaystackTransactionResult) => void;
    onCancel?: () => void;
    onLoad?: (response: { id: number | string; accessCode?: string }) => void;
    onError?: (error: { message: string }) => void;
  }

  export interface PaystackNewTransactionOptions extends PaystackCallbacks {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    channels?: string[];
    reference?: string;
    metadata?: Record<string, unknown>;
  }

  export interface PopupTransactionInstance {
    getStatus?: () => {
      status: string | null;
      id?: string;
      checkoutUrl?: string;
    };
  }

  export default class PaystackPop {
    newTransaction(options: PaystackNewTransactionOptions): PopupTransactionInstance;
    resumeTransaction(accessCode: string, callbacks?: PaystackCallbacks): PopupTransactionInstance;
    cancelTransaction(transaction: PopupTransactionInstance | string): void;
  }
}
