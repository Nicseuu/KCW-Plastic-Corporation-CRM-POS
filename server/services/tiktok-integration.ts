import { createHmac } from "crypto";
import { storage } from "../storage";

const TIKTOK_API_BASE = process.env.TIKTOK_SANDBOX === "true"
  ? "https://open-api-sandbox.tiktokglobalshop.com"
  : "https://open-api.tiktokglobalshop.com";

const TIKTOK_AUTH_BASE = "https://services.tiktokshop.com/open/authorize";

interface TikTokConfig {
  appKey: string;
  appSecret: string;
  shopCipher?: string;
  accessToken?: string;
  refreshToken?: string;
}

function getBaseConfig(): { appKey: string; appSecret: string } | null {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY || process.env.TIKTOK_SHOP_APP_ID;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
  
  if (!appKey || !appSecret) {
    return null;
  }

  return { appKey, appSecret };
}

function getConfig(): TikTokConfig | null {
  const base = getBaseConfig();
  if (!base) return null;

  return {
    ...base,
    shopCipher: process.env.TIKTOK_SHOP_CIPHER,
    accessToken: process.env.TIKTOK_SHOP_ACCESS_TOKEN,
    refreshToken: process.env.TIKTOK_SHOP_REFRESH_TOKEN,
  };
}

async function getConfigWithDbTokens(): Promise<TikTokConfig | null> {
  const base = getBaseConfig();
  if (!base) return null;

  const integration = await storage.getPlatformIntegration("TikTok Shop");
  
  return {
    ...base,
    shopCipher: integration?.shopId || process.env.TIKTOK_SHOP_CIPHER,
    accessToken: integration?.accessToken || process.env.TIKTOK_SHOP_ACCESS_TOKEN,
    refreshToken: integration?.refreshToken || process.env.TIKTOK_SHOP_REFRESH_TOKEN,
  };
}

function generateSign(appSecret: string, path: string, timestamp: number, params: Record<string, string> = {}): string {
  const sortedKeys = Object.keys(params).sort();
  let signString = appSecret + path;
  
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  
  signString += appSecret;
  
  return createHmac("sha256", appSecret)
    .update(signString)
    .digest("hex");
}

export function getTikTokAuthUrl(redirectUri: string): string | null {
  const config = getConfig();
  if (!config) return null;

  const state = Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    app_key: config.appKey,
    state,
  });

  return `${TIKTOK_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  shops?: Array<{ shopId: string; shopCipher: string; shopName: string }>;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "TikTok Shop not configured" };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/token/get";
    
    const response = await fetch(`${TIKTOK_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_key: config.appKey,
        app_secret: config.appSecret,
        auth_code: code,
        grant_type: "authorized_code",
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.message || "Token exchange failed" };
    }

    return {
      success: true,
      accessToken: data.data?.access_token,
      refreshToken: data.data?.refresh_token,
      expiresIn: data.data?.access_token_expire_in,
      shops: data.data?.shops?.map((shop: any) => ({
        shopId: shop.shop_id,
        shopCipher: shop.shop_cipher,
        shopName: shop.shop_name,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "TikTok Shop not configured" };
  }

  try {
    const path = "/api/v2/token/refresh";
    
    const response = await fetch(`${TIKTOK_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_key: config.appKey,
        app_secret: config.appSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.message || "Token refresh failed" };
    }

    return {
      success: true,
      accessToken: data.data?.access_token,
      refreshToken: data.data?.refresh_token,
      expiresIn: data.data?.access_token_expire_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function syncTikTokOrders(): Promise<{
  success: boolean;
  ordersCount?: number;
  error?: string;
}> {
  const config = await getConfigWithDbTokens();
  if (!config || !config.accessToken || !config.shopCipher) {
    return { success: false, error: "TikTok Shop not fully configured. Please connect your TikTok Shop account first." };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/orders/search";
    
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - (7 * 24 * 60 * 60);

    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp: timestamp.toString(),
      shop_cipher: config.shopCipher,
      access_token: config.accessToken,
    };

    const sign = generateSign(config.appSecret, path, timestamp, params);
    params.sign = sign;

    const queryString = new URLSearchParams(params).toString();
    
    const response = await fetch(`${TIKTOK_API_BASE}${path}?${queryString}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        create_time_from: weekAgo,
        create_time_to: now,
        page_size: 50,
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.message || "Failed to fetch orders" };
    }

    const orders = data.data?.orders || [];
    let importedCount = 0;

    for (const tiktokOrder of orders) {
      const existingOrder = await storage.getOrderByPlatformId("TikTok Shop", tiktokOrder.order_id);
      
      if (!existingOrder) {
        const customer = await findOrCreateCustomerFromTikTok(tiktokOrder);
        
        await storage.createOrder({
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          platformOrderId: tiktokOrder.order_id,
          customerId: customer.id,
          platform: "TikTok Shop",
          status: mapTikTokOrderStatus(tiktokOrder.order_status),
          paymentStatus: tiktokOrder.payment_info?.payment_status === "PAID" ? "Paid" : "Unpaid",
          totalAmount: (tiktokOrder.payment_info?.total_amount || 0).toString(),
          paidAmount: tiktokOrder.payment_info?.payment_status === "PAID" 
            ? (tiktokOrder.payment_info?.total_amount || 0).toString() 
            : "0",
          discount: "0",
          storeId: null,
          cashierId: null,
          courier: tiktokOrder.shipping_provider || null,
          shippingAddress: tiktokOrder.recipient_address?.full_address || null,
          notes: `TikTok Order: ${tiktokOrder.order_id}`,
        });
        importedCount++;
      }
    }

    return { success: true, ordersCount: importedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function findOrCreateCustomerFromTikTok(order: any) {
  const customers = await storage.getCustomers();
  
  const buyerName = order.recipient_address?.name || order.buyer_username;
  
  let customer = customers.find(c => 
    c.notes?.includes(`tiktok:${order.buyer_user_id}`)
  );

  if (!customer) {
    const crn = `CRN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    customer = await storage.createCustomer({
      crn,
      name: buyerName || "TikTok Customer",
      email: null,
      phone: order.recipient_address?.phone || null,
      address: order.recipient_address?.full_address || null,
      stage: "Customer",
      tags: ["TikTok Shop"],
      notes: `tiktok:${order.buyer_user_id}`,
      platform: "TikTok Shop",
      isWalkIn: false,
      storeId: null,
    });
  }

  return customer;
}

function mapTikTokOrderStatus(status: number | string): string {
  const statusMap: Record<string, string> = {
    "100": "Pending",
    "105": "Pending",
    "111": "Processing",
    "112": "Processing",
    "114": "Shipped",
    "121": "Completed",
    "130": "Cancelled",
    "140": "Cancelled",
  };
  return statusMap[status.toString()] || "Pending";
}

export function getTikTokStatus(): {
  configured: boolean;
  sandbox: boolean;
  hasCredentials: boolean;
  hasTokens: boolean;
} {
  const config = getConfig();
  return {
    configured: config !== null,
    sandbox: process.env.TIKTOK_SANDBOX === "true",
    hasCredentials: config !== null,
    hasTokens: !!(config?.accessToken && config?.refreshToken),
  };
}

export async function syncTikTokProducts(): Promise<{
  success: boolean;
  productsCount?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config || !config.accessToken || !config.shopCipher) {
    return { success: false, error: "TikTok Shop not fully configured" };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/products/search";

    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp: timestamp.toString(),
      shop_cipher: config.shopCipher,
      access_token: config.accessToken,
    };

    const sign = generateSign(config.appSecret, path, timestamp, params);
    params.sign = sign;

    const queryString = new URLSearchParams(params).toString();
    
    const response = await fetch(`${TIKTOK_API_BASE}${path}?${queryString}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_size: 100,
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.message || "Failed to fetch products" };
    }

    return { success: true, productsCount: data.data?.products?.length || 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
