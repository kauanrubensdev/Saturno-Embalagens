import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testQuery() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, user_id, status, payment_status, payment_method,
      subtotal, shipping_cost, total,
      delivery_type, shipping_address_id, pickup_address,
      customer_note, created_at, updated_at, abacate_pix_id,
      profile:profiles!orders_user_id_fkey ( id, name, phone ),
      shipping_address:addresses!orders_shipping_address_id_fkey (
        id, street, number, complement, neighborhood, city, state, zip_code
      )
    `)
    .limit(1);

  if (error) {
    console.error('Supabase Error:', error);
  } else {
    console.log('Success, data:', data);
  }
}

testQuery();
