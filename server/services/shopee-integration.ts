import { createHmac } from "crypto";
import { storage } from "../storage";

const SHOPEE_API_BASE = process.env.SHOPEE_SANDBOX === "true" 
  ? "https://partner.test-stable.shopeemobile.com"
  : "https://partner.shopeemobile.com";

interface ShopeeConfig {
  partnerId: string;
  partnerKey: string;
  shopId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

function getBaseConfig(): { partnerId: string; partnerKey: string } | null {
  const partnerId = process.env.SHOPEE_PARTNER_ID || process.env.SHOPEE_APP_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY || process.env.SHOPEE_APP_SECRET;
  
  if (!partnerId || !partnerKey) {
    return null;
  }

  return { partnerId, partnerKey };
}

function getConfig(): ShopeeConfig | null {
  const base = getBaseConfig();
  if (!base) return null;

  return {
    ...base,
    shopId: process.env.SHOPEE_SHOP_ID,
    accessToken: process.env.SHOPEE_ACCESS_TOKEN,
    refreshToken: process.env.SHOPEE_REFRESH_TOKEN,
  };
}

async function getConfigWithDbTokens(): Promise<ShopeeConfig | null> {
  const base = getBaseConfig();
  if (!base) return null;

  const integration = await storage.getPlatformIntegration("Shopee");
  
  return {
    ...base,
    shopId: integration?.shopId || process.env.SHOPEE_SHOP_ID,
    accessToken: integration?.accessToken || process.env.SHOPEE_ACCESS_TOKEN,
    refreshToken: integration?.refreshToken || process.env.SHOPEE_REFRESH_TOKEN,
  };
}

function generateSignature(partnerId: string, path: string, timestamp: number, accessToken: string, shopId: string, partnerKey: string): string {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

function generateAuthSignature(partnerId: string, path: string, timestamp: number, partnerKey: string): string {
  const baseString = `${partnerId}${path}${timestamp}`;
  return createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

export function getShopeeAuthUrl(redirectUri: string): string | null {
  const config = getConfig();
  if (!config) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const path = "/api/v2/shop/auth_partner";
  const sign = generateAuthSignature(config.partnerId, path, timestamp, config.partnerKey);

  const params = new URLSearchParams({
    partner_id: config.partnerId,
    timestamp: timestamp.toString(),
    sign,
    redirect: redirectUri,
  });

  return `${SHOPEE_API_BASE}${path}?${params.toString()}`;
}

export async function exchangeShopeeCode(code: string, shopId: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expireIn?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Shopee not configured" };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/token/get";
    const sign = generateAuthSignature(config.partnerId, path, timestamp, config.partnerKey);

    const response = await fetch(`${SHOPEE_API_BASE}${path}?partner_id=${config.partnerId}&timestamp=${timestamp}&sign=${sign}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        shop_id: parseInt(shopId),
        partner_id: parseInt(config.partnerId),
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.message || data.error };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expireIn: data.expire_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function refreshShopeeToken(refreshToken: string, shopId: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expireIn?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Shopee not configured" };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/access_token/get";
    const sign = generateAuthSignature(config.partnerId, path, timestamp, config.partnerKey);

    const response = await fetch(`${SHOPEE_API_BASE}${path}?partner_id=${config.partnerId}&timestamp=${timestamp}&sign=${sign}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        shop_id: parseInt(shopId),
        partner_id: parseInt(config.partnerId),
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.message || data.error };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expireIn: data.expire_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function syncShopeeOrders(): Promise<{
  success: boolean;
  ordersCount?: number;
  error?: string;
}> {
  const config = await getConfigWithDbTokens();
  if (!config || !config.accessToken || !config.shopId) {
    return { success: false, error: "Shopee not fully configured. Please connect your Shopee account first." };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/order/get_order_list";
    const sign = generateSignature(config.partnerId, path, timestamp, config.accessToken, config.shopId, config.partnerKey);

    const timeRangeEnd = timestamp;
    const timeRangeStart = timestamp - (7 * 24 * 60 * 60);

    const params = new URLSearchParams({
      partner_id: config.partnerId,
      timestamp: timestamp.toString(),
      sign,
      access_token: config.accessToken,
      shop_id: config.shopId,
      time_range_field: "create_time",
      time_from: timeRangeStart.toString(),
      time_to: timeRangeEnd.toString(),
      page_size: "50",
    });

    const response = await fetch(`${SHOPEE_API_BASE}${path}?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.message || data.error };
    }

    const orders = data.response?.order_list || [];
    let importedCount = 0;

    for (const shopeeOrder of orders) {
      const existingOrder = await storage.getOrderByPlatformId("Shopee", shopeeOrder.order_sn);
      
      if (!existingOrder) {
        const customer = await findOrCreateCustomerFromShopee(shopeeOrder);
        
        await storage.createOrder({
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          platformOrderId: shopeeOrder.order_sn,
          customerId: customer.id,
          platform: "Shopee",
          status: mapShopeeOrderStatus(shopeeOrder.order_status),
          paymentStatus: shopeeOrder.order_status === "COMPLETED" ? "Paid" : "Unpaid",
          totalAmount: (shopeeOrder.total_amount || 0).toString(),
          paidAmount: shopeeOrder.order_status === "COMPLETED" ? (shopeeOrder.total_amount || 0).toString() : "0",
          discount: "0",
          storeId: null,
          cashierId: null,
          courier: shopeeOrder.shipping_carrier || null,
          shippingAddress: null,
          notes: `Shopee Order: ${shopeeOrder.order_sn}`,
        });
        importedCount++;
      }
    }

    return { success: true, ordersCount: importedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function findOrCreateCustomerFromShopee(order: any) {
  const customers = await storage.getCustomers();
  
  let customer = customers.find(c => 
    c.notes?.includes(`shopee:${order.buyer_user_id}`)
  );

  if (!customer) {
    const crn = `CRN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    customer = await storage.createCustomer({
      crn,
      name: order.buyer_username || "Shopee Customer",
      email: null,
      phone: null,
      address: null,
      stage: "Customer",
      tags: ["Shopee"],
      notes: `shopee:${order.buyer_user_id}`,
      platform: "Shopee",
      isWalkIn: false,
      storeId: null,
    });
  }

  return customer;
}

function mapShopeeOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    "UNPAID": "Pending",
    "READY_TO_SHIP": "Processing",
    "PROCESSED": "Processing",
    "SHIPPED": "Shipped",
    "COMPLETED": "Completed",
    "IN_CANCEL": "Cancelled",
    "CANCELLED": "Cancelled",
  };
  return statusMap[status] || "Pending";
}

export function getShopeeStatus(): {
  configured: boolean;
  sandbox: boolean;
  hasCredentials: boolean;
  hasTokens: boolean;
} {
  const config = getConfig();
  return {
    configured: config !== null,
    sandbox: process.env.SHOPEE_SANDBOX === "true",
    hasCredentials: config !== null,
    hasTokens: !!(config?.accessToken && config?.refreshToken),
  };
}

export async function syncShopeeProducts(): Promise<{
  success: boolean;
  productsCount?: number;
  error?: string;
}> {
  const config = getConfig();
  if (!config || !config.accessToken || !config.shopId) {
    return { success: false, error: "Shopee not fully configured" };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/product/get_item_list";
    const sign = generateSignature(config.partnerId, path, timestamp, config.accessToken, config.shopId, config.partnerKey);

    const params = new URLSearchParams({
      partner_id: config.partnerId,
      timestamp: timestamp.toString(),
      sign,
      access_token: config.accessToken,
      shop_id: config.shopId,
      offset: "0",
      page_size: "100",
      item_status: "NORMAL",
    });

    const response = await fetch(`${SHOPEE_API_BASE}${path}?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.message || data.error };
    }

    return { success: true, productsCount: data.response?.item?.length || 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
