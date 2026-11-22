// supabase/functions/send-order-email/types.ts

export type EmailType =
  | 'order_created'
  | 'payment_approved'
  | 'preparing'
  | 'ready_for_pickup'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export const VALID_EMAIL_TYPES: readonly EmailType[] = [
  'order_created',
  'payment_approved',
  'preparing',
  'ready_for_pickup',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export function isValidEmailType(val: unknown): val is EmailType {
  return typeof val === 'string' && (VALID_EMAIL_TYPES as readonly string[]).includes(val);
}

export type EmailQueueStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'skipped';

export interface OrderEmailQueueRecord {
  id: string;
  order_id: string;
  email_type: EmailType;
  recipient_email: string;
  status: EmailQueueStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  resend_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface OrderRecord {
  id: string;
  user_id: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_type: 'delivery' | 'pickup' | string;
  shipping_address_id: string | null;
  pickup_address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
}

export interface AddressRecord {
  id: string;
  user_id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

export interface RenderTemplateParams {
  order: OrderRecord;
  items: OrderItemRecord[];
  address: AddressRecord | null;
  customerName: string;
  customerEmail: string;
  emailType: EmailType;
  shortOrderId: string;
  formattedDate: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface ProcessQueueOptions {
  queue_id?: string;
  order_id?: string;
  email_type?: EmailType;
  batch_size?: number;
  dry_run?: boolean;
  preview_only?: boolean;
  recipient_email?: string;
  stale_timeout_minutes?: number;
}

export interface ProcessResultItem {
  queue_id: string;
  order_id: string;
  email_type: string;
  recipient_email: string;
  status: 'sent' | 'failed' | 'skipped' | 'preview';
  resend_id?: string;
  error_message?: string;
  preview?: {
    subject: string;
    html: string;
  };
}
