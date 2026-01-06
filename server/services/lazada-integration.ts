import { createHmac } from "crypto";
import { storage } from "../storage";

const LAZADA_API_BASE = process.env.LAZADA_SANDBOX === "true"
  ? "https://api.lazada.test/rest"
  : "https://api.lazada.com.ph/rest";

const LAZADA_AUTH_BASE = process.env.LAZADA_SANDBOX === "true"
  ? "https://auth.lazada.test/oauth/authorize"
  : "https://auth.lazada.com/oauth/authorize";

interface LazadaConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

function getBaseConfig(): { appKey: string; appSecret: string } | null {
  const appKey = process.env.LAZADA_APP_KEY || process.env.LAZADA_APP_ID;
  const appSecret = process.env.LAZADA_APP_SECRET;
  
  if (!appKey || !appSecret) {
    return null;
  }

  return { appKey, appSecret };
}

function getConfig(): LazadaConfig | null {
  const base = getBaseConfig();
  if (!base) return null;

  return {
    ...base,
    accessToken: process.env.LAZADA_ACCESS_TOKEN,
    refreshToken: process.env.LAZADA_REFRESH_TOKEN,
  };
}

async function getConfigWithDbTokens(): Promise<LazadaConfig | null> {
  const base = getBaseConfig();
  if (!base) return null;

  const integration = await storage.getPlatformIntegration("Lazada");
  
  return {
    ...base,
    accessToken: integration?.accessToken || process.env.LAZADA_ACCESS_TOKEN,
    refreshToken: integration?.refreshToken || process.env.LAZADA_REFRESH_TOKEN,
  };
}

function generateSign(params: Record<string, string>, appSecret: string, apiPath: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concatenated = apiPath;
  
  for (const key of sortedKeys) {
    concatenated += key + params[key];
  }
  
  return createHmac("sha256", appSecret)
    .update(concatenated)
    .digest("hex")
    .toUpperCase();
}

export function getLazadaAuthUrl(redirectUri: string): string | null {
  const config = getConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    response_type: "code",
    force_auth: "true",
    redirect_uri: redirectUri,
    client_id: config.appKey,
  });

  return `${LAZADA_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeLazadaCode(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Lazada not configured" };
  }

  try {
    const timestamp = Date.now().toString();
    const apiPath = "/auth/token/create";
    
    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp,
      sign_method: "sha256",
      code,
    };
    
    params.sign = generateSign(params, config.appSecret, apiPath);

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${LAZADA_API_BASE}${apiPath}?${queryString}`, {
      method: "POST",
    });

    const data = await response.json();

    if (data.code !== "0") {
      return { success: false, error: data.message || "Token exchange failed" };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function refreshLazadaToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Lazada not configured" };
  }

  try {
    const timestamp = Date.now().toString();
    const apiPath = "/auth/token/refresh";
    
    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp,
      sign_method: "sha256",
      refresh_token: refreshToken,
    };
    
    params.sign = generateSign(params, config.appSecret, apiPath);

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${LAZADA_API_BASE}${apiPath}?${queryString}`, {
      method: "POST",
    });

    const data = await response.json();

    if (data.code !== "0") {
      return { success: false, error: data.message || "Token refresh failed" };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function syncLazadaOrders(): Promise<{
  success: boolean;
  ordersCount?: number;
  error?: string;
}> {
  const config = await getConfigWithDbTokens();
  if (!config || !config.accessToken) {
    return { success: false, error: "Lazada not fully configured. Please connect your Lazada account first." };
  }

  try {
    const timestamp = Date.now().toString();
    const apiPath = "/orders/get";
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp,
      sign_method: "sha256",
      access_token: config.accessToken,
      created_after: weekAgo.toISOString(),
      limit: "50",
      offset: "0",
    };
    
    params.sign = generateSign(params, config.appSecret, apiPath);

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${LAZADA_API_BASE}${apiPath}?${queryString}`);
    const data = await response.json();

    if (data.code !== "0") {
      return { success: false, error: data.message || "Failed to fetch orders" };
    }

    const orders = data.data?.orders || [];
    let importedCount = 0;

    for (const lazadaOrder of orders) {
      const existingOrder = await storage.getOrderByPlatformId("Lazada", lazadaOrder.order_id.toString());
      
      if (!existingOrder) {
        const customer = await findOrCreateCustomerFromLazada(lazadaOrder);
        
        await storage.createOrder({
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          platformOrderId: lazadaOrder.order_id.toString(),
          customerId: customer.id,
          platform: "Lazada",
          status: mapLazadaOrderStatus(lazadaOrder.statuses?.[0] || "pending"),
          paymentStatus: lazadaOrder.payment_method ? "Paid" : "Unpaid",
          totalAmount: (lazadaOrder.price || 0).toString(),
          paidAmount: lazadaOrder.payment_method ? (lazadaOrder.price || 0).toString() : "0",
          discount: "0",
          storeId: null,
          cashierId: null,
          courier: null,
          shippingAddress: lazadaOrder.address_shipping?.address1 || null,
          notes: `Lazada Order: ${lazadaOrder.order_id}`,
        });
        importedCount++;
      }
    }

    return { success: true, ordersCount: importedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function findOrCreateCustomerFromLazada(order: any) {
  const customers = await storage.getCustomers();
  
  let customer = customers.find(c => 
    c.notes?.includes(`lazada:${order.customer_first_name}_${order.customer_last_name}`)
  );

  if (!customer) {
    const crn = `CRN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const fullName = `${order.customer_first_name || ""} ${order.customer_last_name || ""}`.trim() || "Lazada Customer";
    
    customer = await storage.createCustomer({
      crn,
      name: fullName,
      email: null,
      phone: order.address_shipping?.phone || null,
      address: order.address_shipping?.address1 || null,
      stage: "Customer",
      tags: ["Lazada"],
      notes: `lazada:${order.customer_first_name}_${order.customer_last_name}`,
      platform: "Lazada",
      isWalkIn: false,
      storeId: null,
    });
  }

  return customer;
}

function mapLazadaOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    "pending": "Pending",
    "confirmed": "Processing",
    "packed": "Processing",
    "ready_to_ship": "Processing",
    "shipped": "Shipped",
    "delivered": "Completed",
    "canceled": "Cancelled",
    "returned": "Cancelled",
  };
  return statusMap[status.toLowerCase()] || "Pending";
}

export function getLazadaStatus(): {
  configured: boolean;
  sandbox: boolean;
  hasCredentials: boolean;
  hasTokens: boolean;
} {
  const config = getConfig();
  return {
    configured: config !== null,
    sandbox: process.env.LAZADA_SANDBOX === "true",
    hasCredentials: config !== null,
    hasTokens: !!(config?.accessToken && config?.refreshToken),
  };
}

export async function syncLazadaProducts(): Promise<{
  success: boolean;
  productsCount?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config || !config.accessToken) {
    return { success: false, error: "Lazada not fully configured" };
  }

  try {
    const timestamp = Date.now().toString();
    const apiPath = "/products/get";
    
    const params: Record<string, string> = {
      app_key: config.appKey,
      timestamp,
      sign_method: "sha256",
      access_token: config.accessToken,
      limit: "100",
      offset: "0",
    };
    
    params.sign = generateSign(params, config.appSecret, apiPath);

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${LAZADA_API_BASE}${apiPath}?${queryString}`);
    const data = await response.json();

    if (data.code !== "0") {
      return { success: false, error: data.message || "Failed to fetch products" };
    }

    return { success: true, productsCount: data.data?.products?.length || 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
