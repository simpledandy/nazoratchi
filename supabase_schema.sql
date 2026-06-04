-- Supabase SQL Script to establish Sales and Transactions tracking for Cosmetics products (LA'CORE)
-- Execute this script directly in the Supabase SQL Editor.

-- 1. Create Customers/Profiles Table
CREATE TABLE IF NOT EXISTS public.sales_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text, -- tracks which Telegram Group the customer resides in (if any), to allow community attribution analysis
  name text NOT NULL,
  telegram_id text, -- optional link to public.users(telegram_id)
  telegram_username text,
  phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_customers_pkey PRIMARY KEY (id),
  CONSTRAINT sales_customers_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE SET NULL,
  CONSTRAINT sales_customers_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE SET NULL
);

-- 2. Create Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  chat_id text, -- tracks group chat attribution for business performance optimization
  sale_date timestamp with time zone NOT NULL DEFAULT now(),
  total_amount numeric NOT NULL DEFAULT 0,
  total_points numeric NOT NULL DEFAULT 0, -- cosmetics point system points (балл/ball)
  status text NOT NULL DEFAULT 'unpaid', -- unpaid, partially_paid, paid
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  CONSTRAINT sales_orders_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE SET NULL
);

-- 3. Create Sale Items Table (Order items details)
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  points numeric DEFAULT 0, -- reward points per unit
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE
);

-- 4. Create Payments/Transactions Table
CREATE TABLE IF NOT EXISTS public.sales_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  order_id uuid, -- optional association to a specific sales order
  amount numeric NOT NULL DEFAULT 0,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT 'cash', -- cash, card, bank_transfer, click, payme, other
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_payments_pkey PRIMARY KEY (id),
  CONSTRAINT sales_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  CONSTRAINT sales_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL
);

-- 5. Build indexes to optimize query performance and fast analytical summaries
CREATE INDEX IF NOT EXISTS idx_sales_customers_chat_id ON public.sales_customers(chat_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_chat_id ON public.sales_orders(chat_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_customer_id ON public.sales_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_order_id ON public.sales_payments(order_id);

-- 6. Setup Row Level Security (RLS) Rules if desired
-- We grant basic access to authenticated roles
ALTER TABLE public.sales_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for anon/authenticated" ON public.sales_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select for anon/authenticated" ON public.sales_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select for anon/authenticated" ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select for anon/authenticated" ON public.sales_payments FOR ALL USING (true) WITH CHECK (true);
