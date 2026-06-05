export interface Stats {
  totalInvites: number;
  totalLeaves: number;
  totalMembers: number;
  invites: any[];
  leaves: any[];
  members: any[];
}

export interface LeaderboardItem {
  id: string;
  count: number;
  name: string;
}

export type TabType = "dashboard" | "leaderboard" | "contests" | "sales" | "settings" | "instructions";

export interface Product {
  code: string;
  name: string;
  volume: string;
  price: number;
  discount_price: number;
  points: number;
  category: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  telegram_username?: string;
  telegram_id?: string;
  chat_id?: string;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  points: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  chatId?: string;
  saleDate: string;
  totalAmount: number;
  totalPoints: number;
  status: string; // paid, partially_paid, unpaid
  notes?: string;
  items: OrderItem[];
  paidAmount: number;
  outstandingBalance: number;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

export interface BusinessMetrics {
  summary: {
    totalSalesRevenue: number;
    totalCollectedPayments: number;
    totalOutstandingDebt: number;
    totalPointsGenerated: number;
    activeCustomersCount: number;
    totalOrdersCount: number;
  };
  bestSellers: Array<{
    code: string;
    name: string;
    quantitySold: number;
    revenue: number;
    points: number;
  }>;
  customerPerformance: Array<{
    customerId: string;
    customerName: string;
    totalOrdersAmount: number;
    totalPaidAmount: number;
    outstandingDebt: number;
    debtorSince: string;
  }>;
  topDebtors: Array<{
    customerId: string;
    customerName: string;
    totalOrdersAmount: number;
    totalPaidAmount: number;
    outstandingDebt: number;
    debtorSince: string;
  }>;
  channelPerformance: Array<{
    channelId: string;
    channelName: string;
    revenueGenerated: number;
  }>;
}
