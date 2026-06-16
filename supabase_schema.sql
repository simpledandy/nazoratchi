-- Complete Supabase PostgreSQL Schema & Migration Script
-- This script safely creates all tables, fields, indexes, and RLS rules if they do not exist,
-- and gracefully updates existing environments with new tracking columns and indexing optimizations.
-- Execute this entire script inside your Supabase SQL Editor.

-- ==========================================================
-- 1. BASE TELEGRAM GROUP AND USER DIRECTORIES
-- ==========================================================

-- 1A. Create Groups Table
CREATE TABLE IF NOT EXISTS public.groups (
  id text NOT NULL,
  title text NOT NULL,
  last_active_at timestamp with time zone DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id)
);

-- 1B. Create Users Table (Global Telegram User Registry)
CREATE TABLE IF NOT EXISTS public.users (
  telegram_id text NOT NULL,
  username text,
  first_name text NOT NULL,
  last_name text,
  joined_at timestamp with time zone DEFAULT now(),
  is_bot boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (telegram_id)
);

-- ==========================================================
-- 2. TELEGRAM CONTESTS MANAGEMENT
-- ==========================================================

-- Create Contests Table (Using UUID as ID)
CREATE TABLE IF NOT EXISTS public.contests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  title text NOT NULL,
  description text,
  prizes text,
  image_url text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contests_pkey PRIMARY KEY (id),
  CONSTRAINT contests_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- ==========================================================
-- 3. INTERACTIVE GROUP MEMBERSHIPS & RETURN TRACKING
-- ==========================================================

-- Create Memberships Table
CREATE TABLE IF NOT EXISTS public.memberships (
  id text NOT NULL, -- composite unique ID format: chat_id_telegram_id
  chat_id text NOT NULL,
  telegram_id text NOT NULL,
  username text,
  first_name text,
  last_name text,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT memberships_pkey PRIMARY KEY (id),
  CONSTRAINT memberships_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- Safe Column Upgrades for Existing Memberships Table
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS left_at timestamp with time zone;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS invited_by text;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS invite_link text;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS invite_link_name text;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS join_count integer DEFAULT 1;

-- Safely Add invited_by Foreign Key to public.users(telegram_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memberships_invited_by_fkey' AND table_name = 'memberships'
  ) THEN
    ALTER TABLE public.memberships 
    ADD CONSTRAINT memberships_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES public.users(telegram_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================================================
-- 4. MEMBERSHIP TRANSITIONS: LEAVES & INVITATIONS RECORD
-- ==========================================================

-- 4A. Create Leaves History Table
CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telegram_id text NOT NULL,
  chat_id text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT leaves_pkey PRIMARY KEY (id),
  CONSTRAINT leaves_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- Safely Add leaves.telegram_id Foreign Key Reference to users(telegram_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leaves_telegram_id_fkey' AND table_name = 'leaves'
  ) THEN
    ALTER TABLE public.leaves 
    ADD CONSTRAINT leaves_telegram_id_fkey 
    FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4B. Create Invites Log Table
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inviter_id text NOT NULL,
  invitee_id text NOT NULL,
  chat_id text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  contest_id text,
  CONSTRAINT invites_pkey PRIMARY KEY (id),
  CONSTRAINT invites_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- Safely Add invites Foreign Keys to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invites_inviter_id_fkey' AND table_name = 'invites'
  ) THEN
    ALTER TABLE public.invites 
    ADD CONSTRAINT invites_inviter_id_fkey 
    FOREIGN KEY (inviter_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invites_invitee_id_fkey' AND table_name = 'invites'
  ) THEN
    ALTER TABLE public.invites 
    ADD CONSTRAINT invites_invitee_id_fkey 
    FOREIGN KEY (invitee_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==========================================================
-- 5. LINK MONITORING & ENCRYPTION SESSIONS (AUTH_CODE)
-- ==========================================================

-- Create Link Logs Table
CREATE TABLE IF NOT EXISTS public.link_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  sender_id text NOT NULL,
  sender_username text,
  sender_name text,
  message_text text,
  extracted_link text,
  is_deleted boolean DEFAULT false,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT link_logs_pkey PRIMARY KEY (id),
  CONSTRAINT link_logs_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE CASCADE
);

-- Safely Add link_logs.sender_id Foreign Key Reference to users(telegram_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'link_logs_sender_id_fkey' AND table_name = 'link_logs'
  ) THEN
    ALTER TABLE public.link_logs 
    ADD CONSTRAINT link_logs_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==========================================================
-- 6. BUSINESS LAYER: COSMETICS (LA'CORE) SALES TRACKING
-- ==========================================================

-- 6A. Customers Table
CREATE TABLE IF NOT EXISTS public.sales_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text, -- link with Telegram Group for community marketing context
  name text NOT NULL,
  telegram_id text, -- optionally reference Telegram profile
  telegram_username text,
  phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_customers_pkey PRIMARY KEY (id),
  CONSTRAINT sales_customers_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE SET NULL,
  CONSTRAINT sales_customers_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE SET NULL
);

-- 6B. Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  chat_id text, -- link with Telegram Group for marketing context
  sale_date timestamp with time zone NOT NULL DEFAULT now(),
  total_amount numeric NOT NULL DEFAULT 0,
  total_points numeric NOT NULL DEFAULT 0, -- Cosmetics value system points (Балл)
  status text NOT NULL DEFAULT 'unpaid', -- unpaid, partially_paid, paid
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  CONSTRAINT sales_orders_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.groups(id) ON DELETE SET NULL
);

-- 6C. Sales Order Items Table (Product breakdowns)
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  points numeric DEFAULT 0, -- point value per unit
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE
);

-- 6D. Payments Table
CREATE TABLE IF NOT EXISTS public.sales_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  order_id uuid, -- optional order specification
  amount numeric NOT NULL DEFAULT 0,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT 'cash', -- cash, card, click, payme, transfer, other
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_payments_pkey PRIMARY KEY (id),
  CONSTRAINT sales_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  CONSTRAINT sales_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL
);

-- ==========================================================
-- 7. PERFORMANCE AND REPORT INDEX OPTIMIZATIONS
-- ==========================================================

-- Standard Telegram Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_memberships_chat_id ON public.memberships(chat_id);
CREATE INDEX IF NOT EXISTS idx_memberships_telegram_id ON public.memberships(telegram_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_leaves_chat_id ON public.leaves(chat_id);
CREATE INDEX IF NOT EXISTS idx_leaves_telegram_id ON public.leaves(telegram_id);
CREATE INDEX IF NOT EXISTS idx_invites_chat_id ON public.invites(chat_id);
CREATE INDEX IF NOT EXISTS idx_invites_inviter_id ON public.invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invites_invitee_id ON public.invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_link_logs_chat_id ON public.link_logs(chat_id);
CREATE INDEX IF NOT EXISTS idx_link_logs_sender_id ON public.link_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_contests_chat_id ON public.contests(chat_id);

-- Sales / Customers Indexes
CREATE INDEX IF NOT EXISTS idx_sales_customers_chat_id ON public.sales_customers(chat_id);
CREATE INDEX IF NOT EXISTS idx_sales_customers_telegram_id ON public.sales_customers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_chat_id ON public.sales_orders(chat_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_customer_id ON public.sales_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_order_id ON public.sales_payments(order_id);

-- ==========================================================
-- 8. SECURITY RULES: ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

-- Grant broad read/write permissions for authenticated/anonymous interactions
-- (Designed for client authentication via public API keys inside client-authoritative apps)
CREATE POLICY "Allow public select of groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of contests" ON public.contests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of memberships" ON public.memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of leaves" ON public.leaves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of invites" ON public.invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of link_logs" ON public.link_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of sales_customers" ON public.sales_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of sales_orders" ON public.sales_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of sales_order_items" ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public select of sales_payments" ON public.sales_payments FOR ALL USING (true) WITH CHECK (true);
