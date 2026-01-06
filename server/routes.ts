import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createHash, randomBytes } from "crypto";
import type { User, Role } from "@shared/schema";
import * as XLSX from "xlsx";
import { WebSocketServer, WebSocket } from "ws";
import {
  verifyWebhookSignature,
  verifyWebhookChallenge,
  processMessengerWebhook,
  processWhatsAppWebhook,
  sendMessengerMessage,
  sendWhatsAppMessage,
  getIntegrationStatus,
} from "./services/meta-messaging";
import {
  getShopeeAuthUrl,
  exchangeShopeeCode,
  syncShopeeOrders,
  getShopeeStatus,
} from "./services/shopee-integration";
import {
  getLazadaAuthUrl,
  exchangeLazadaCode,
  syncLazadaOrders,
  getLazadaStatus,
} from "./services/lazada-integration";
import {
  getTikTokAuthUrl,
  exchangeTikTokCode,
  syncTikTokOrders,
  getTikTokStatus,
} from "./services/tiktok-integration";

// WebSocket clients for real-time updates
const wsClients = new Set<WebSocket>();

// Broadcast stock update to all connected clients
export function broadcastStockUpdate(productId: string, totalStock: number, reservedStock: number) {
  const message = JSON.stringify({
    type: "STOCK_UPDATE",
    payload: { productId, totalStock, reservedStock, availableStock: totalStock - reservedStock }
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast full inventory refresh
export function broadcastInventoryRefresh() {
  const message = JSON.stringify({ type: "INVENTORY_REFRESH" });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast new message to all connected clients
export function broadcastNewMessage(conversationId: string, message: any) {
  const wsMessage = JSON.stringify({
    type: "NEW_MESSAGE",
    payload: { conversationId, message }
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(wsMessage);
    }
  });
}

// Broadcast conversation update
export function broadcastConversationUpdate(conversation: any) {
  const wsMessage = JSON.stringify({
    type: "CONVERSATION_UPDATE",
    payload: conversation
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(wsMessage);
    }
  });
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User & { role?: Role };
    }
  }
}

// Password hashing
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Generate auth token
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const session = await storage.getSession(token);
  
  if (!session || new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ error: "Session expired" });
  }

  const user = await storage.getUser(session.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "User not found or inactive" });
  }

  // Attach role to user
  let role: Role | undefined;
  if (user.roleId) {
    role = await storage.getRole(user.roleId);
  }

  req.user = { ...user, role };
  next();
}

// Permission check middleware
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user?.role) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const permissions = user.role.permissions || [];
    if (permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }

    res.status(403).json({ error: "Forbidden" });
  };
}

import { processUnifiedWebhook } from "./services/webhook-handler";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ========== WEBHOOKS API ==========
  
  app.post("/api/webhooks/order", async (req, res) => {
    try {
      // In production, we would verify signature here
      await processUnifiedWebhook(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Webhook Order Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== WEBSOCKET SETUP ==========
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    wsClients.add(ws);
    
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      wsClients.delete(ws);
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      wsClients.delete(ws);
    });
  });
  
  // ========== AUTH ROUTES ==========
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled" });
      }

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.createSession({
        userId: user.id,
        token,
        expiresAt,
      });

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      // Log audit
      await storage.createAuditLog({
        userId: user.id,
        action: "LOGIN",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Get role for response
      let role: Role | undefined;
      if (user.roleId) {
        role = await storage.getRole(user.roleId);
      }

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: role?.name,
          permissions: role?.permissions || [],
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      const token = req.headers.authorization?.substring(7);
      if (token) {
        await storage.deleteSession(token);
        
        // Log audit
        await storage.createAuditLog({
          userId: req.user!.id,
          action: "LOGOUT",
          entityType: "user",
          entityId: req.user!.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const user = req.user!;
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role?.name,
      permissions: user.role?.permissions || [],
    });
  });

  // Register (admin only)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, fullName, email, roleName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Get role
      let roleId: string | undefined;
      if (roleName) {
        const role = await storage.getRoleByName(roleName);
        roleId = role?.id;
      }

      const user = await storage.createUser({
        username,
        password: hashPassword(password),
        fullName,
        email,
        roleId,
        isActive: true,
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ========== ROLES API ==========
  
  app.get("/api/roles", authMiddleware, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // ========== USERS API ==========
  
  app.get("/api/users", authMiddleware, requirePermission("users:read"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authMiddleware, requirePermission("users:write"), async (req, res) => {
    try {
      const { username, password, fullName, email, roleId } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        fullName: fullName || null,
        email: email || null,
        roleId: roleId || null,
        isActive: true,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATE_USER",
        entityType: "user",
        entityId: user.id,
        newData: { username, fullName, email, roleId },
      });

      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, requirePermission("users:write"), async (req, res) => {
    try {
      const { password, ...updates } = req.body;
      if (password) {
        (updates as any).password = hashPassword(password);
      }
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ========== STORES API ==========
  
  app.get("/api/stores", authMiddleware, async (req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  app.post("/api/stores", authMiddleware, requirePermission("stores:write"), async (req, res) => {
    try {
      const store = await storage.createStore(req.body);
      res.status(201).json(store);
    } catch (error) {
      res.status(500).json({ error: "Failed to create store" });
    }
  });

  app.patch("/api/stores/:id", authMiddleware, requirePermission("stores:write"), async (req, res) => {
    try {
      const store = await storage.updateStore(req.params.id, req.body);
      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      res.status(500).json({ error: "Failed to update store" });
    }
  });

  // ========== AUDIT LOGS API ==========
  
  app.get("/api/audit-logs", authMiddleware, requirePermission("reports:read"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ========== PAYMENT METHODS API ==========
  
  app.get("/api/payment-methods", authMiddleware, async (req, res) => {
    try {
      const methods = await storage.getPaymentMethods();
      res.json(methods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // ========== ORDER PAYMENTS API ==========
  
  app.get("/api/orders/:orderId/payments", authMiddleware, async (req, res) => {
    try {
      const payments = await storage.getOrderPayments(req.params.orderId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order payments" });
    }
  });

  app.post("/api/orders/:orderId/payments", authMiddleware, async (req, res) => {
    try {
      const payment = await storage.createOrderPayment({
        ...req.body,
        orderId: req.params.orderId,
        createdBy: req.user!.id,
      });

      // Update order paid amount
      const order = await storage.getOrder(req.params.orderId);
      if (order) {
        const payments = await storage.getOrderPayments(req.params.orderId);
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const orderTotal = parseFloat(order.totalAmount);
        
        await storage.updateOrder(req.params.orderId, {
          paidAmount: totalPaid.toString(),
          paymentStatus: totalPaid >= orderTotal ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid",
        });
      }

      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // ========== REFUNDS API ==========
  
  app.get("/api/refunds", authMiddleware, requirePermission("refunds:read"), async (req, res) => {
    try {
      const refunds = await storage.getRefunds();
      res.json(refunds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch refunds" });
    }
  });

  app.post("/api/refunds", authMiddleware, requirePermission("refunds:write"), async (req, res) => {
    try {
      const refund = await storage.createRefund({
        ...req.body,
        createdBy: req.user!.id,
      });

      // Log audit
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "REFUND",
        entityType: "order",
        entityId: req.body.orderId,
        newData: refund,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(refund);
    } catch (error) {
      res.status(500).json({ error: "Failed to create refund" });
    }
  });

  app.patch("/api/refunds/:id", authMiddleware, requirePermission("refunds:write"), async (req, res) => {
    try {
      const updates = { ...req.body };
      if (req.body.status === "Approved" || req.body.status === "Rejected") {
        updates.processedBy = req.user!.id;
        updates.processedAt = new Date();
      }
      const refund = await storage.updateRefund(req.params.id, updates);
      if (!refund) {
        return res.status(404).json({ error: "Refund not found" });
      }
      res.json(refund);
    } catch (error) {
      res.status(500).json({ error: "Failed to update refund" });
    }
  });

  // ========== POS SESSIONS API ==========
  
  app.get("/api/pos/session", authMiddleware, async (req, res) => {
    try {
      const session = await storage.getOpenPosSession(req.user!.id);
      res.json(session || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch POS session" });
    }
  });

  app.post("/api/pos/session/open", authMiddleware, requirePermission("pos:access"), async (req, res) => {
    try {
      const existing = await storage.getOpenPosSession(req.user!.id);
      if (existing) {
        return res.status(400).json({ error: "Already have an open session" });
      }

      const session = await storage.createPosSession({
        userId: req.user!.id,
        storeId: req.body.storeId,
        openingBalance: req.body.openingBalance || "0",
        status: "Open",
      });

      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to open POS session" });
    }
  });

  app.post("/api/pos/session/close", authMiddleware, requirePermission("pos:access"), async (req, res) => {
    try {
      const session = await storage.getOpenPosSession(req.user!.id);
      if (!session) {
        return res.status(400).json({ error: "No open session" });
      }

      const updated = await storage.updatePosSession(session.id, {
        status: "Closed",
        closingBalance: req.body.closingBalance,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to close POS session" });
    }
  });

  // ========== PLATFORM INTEGRATIONS API ==========
  
  app.get("/api/integrations", authMiddleware, async (req, res) => {
    try {
      const integrations = await storage.getPlatformIntegrations();
      // Return integrations with credential status (not actual values)
      const safeIntegrations = integrations.map(i => ({
        id: i.id,
        platform: i.platform,
        shopId: i.shopId,
        isActive: i.isActive,
        lastSyncAt: i.lastSyncAt,
        hasCredentials: !!(process.env[`${i.platform.toUpperCase().replace(/\s+/g, '_')}_APP_ID`]),
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));
      res.json(safeIntegrations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.get("/api/integrations/:platform", authMiddleware, async (req, res) => {
    try {
      const integration = await storage.getPlatformIntegration(req.params.platform);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      // Return safe data without exposing secrets
      const envPrefix = req.params.platform.toUpperCase().replace(/\s+/g, '_');
      res.json({
        id: integration.id,
        platform: integration.platform,
        shopId: integration.shopId,
        isActive: integration.isActive,
        lastSyncAt: integration.lastSyncAt,
        hasAppId: !!process.env[`${envPrefix}_APP_ID`],
        hasAppSecret: !!process.env[`${envPrefix}_APP_SECRET`],
        hasAccessToken: !!process.env[`${envPrefix}_ACCESS_TOKEN`],
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration" });
    }
  });

  app.patch("/api/integrations/:platform", authMiddleware, requirePermission("*"), async (req, res) => {
    try {
      const { shopId, isActive } = req.body;
      const integration = await storage.updatePlatformIntegration(req.params.platform, {
        shopId,
        isActive,
      });
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(500).json({ error: "Failed to update integration" });
    }
  });

  app.post("/api/integrations/:platform/sync", authMiddleware, requirePermission("*"), async (req, res) => {
    try {
      const { syncType = "all" } = req.body;
      const platform = req.params.platform;
      
      // Create sync log
      const syncLog = await storage.createSyncLog({
        platform,
        syncType,
        status: "pending",
        recordsSynced: 0,
      });

      // In production, this would trigger the actual sync process
      // For now, return a message about needing credentials
      const envPrefix = platform.toUpperCase().replace(/\s+/g, '_');
      const hasCredentials = process.env[`${envPrefix}_APP_ID`] && process.env[`${envPrefix}_APP_SECRET`];
      
      if (!hasCredentials) {
        await storage.updateSyncLog(syncLog.id, {
          status: "failed",
          errorMessage: "API credentials not configured. Please add credentials in Secrets.",
        });
        return res.status(400).json({ 
          error: "API credentials not configured",
          message: `Please add ${envPrefix}_APP_ID and ${envPrefix}_APP_SECRET to your Secrets`,
          syncLogId: syncLog.id,
        });
      }

      // Update status to running (actual sync would happen here)
      await storage.updateSyncLog(syncLog.id, { status: "running" });
      
      res.json({ 
        message: "Sync started",
        syncLogId: syncLog.id,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start sync" });
    }
  });

  app.get("/api/integrations/:platform/logs", authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await storage.getSyncLogs(req.params.platform, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sync logs" });
    }
  });

  // ========== CUSTOMERS API ==========
  
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customer = await storage.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // ========== PRODUCTS API ==========
  
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/barcode/:barcode", async (req, res) => {
    try {
      const product = await storage.getProductByBarcode(req.params.barcode);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Broadcast real-time stock update
      broadcastStockUpdate(product.id, product.totalStock, product.reservedStock || 0);
      
      // Check for low stock and create notification if needed
      const availableStock = product.totalStock - (product.reservedStock || 0);
      if (availableStock <= (product.lowStockThreshold || 10)) {
        const hasExisting = await storage.hasUnreadNotificationForEntity("LOW_STOCK", product.id);
        if (!hasExisting) {
          await storage.createNotification({
            type: "LOW_STOCK",
            title: "Low Stock Alert",
            message: `${product.name} (SKU: ${product.sku}) is running low. Only ${availableStock} units remaining.`,
            entityType: "product",
            entityId: product.id,
            isRead: false,
          });
        }
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // ========== ORDERS API ==========
  
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/order-items", async (req, res) => {
    try {
      const items = await storage.getAllOrderItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const order = await storage.createOrder(req.body);
      
      // Create NEW_ORDER notification
      await storage.createNotification({
        type: "NEW_ORDER",
        title: "New Order Received",
        message: `New ${order.platform || "Manual"} order #${order.orderId} for ₱${parseFloat(order.totalAmount).toLocaleString()}`,
        entityType: "order",
        entityId: order.id,
        isRead: false,
      });
      
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.post("/api/orders/:id/items", async (req, res) => {
    try {
      console.log("Creating order item for order:", req.params.id, "with data:", req.body);
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        console.log("Order not found:", req.params.id);
        return res.status(404).json({ error: "Order not found" });
      }
      const item = await storage.createOrderItem({
        ...req.body,
        orderId: req.params.id,
      });
      console.log("Order item created:", item);
      
      // Broadcast stock update for the product (reserved stock increases)
      if (item.productId) {
        const product = await storage.getProduct(item.productId);
        if (product) {
          broadcastStockUpdate(product.id, product.totalStock, product.reservedStock || 0);
        }
      }
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating order item:", error);
      res.status(500).json({ error: "Failed to create order item" });
    }
  });

  // ========== PRODUCT SALES STATS API ==========

  app.get("/api/product-sales", authMiddleware, async (req, res) => {
    try {
      const allItems = await storage.getAllOrderItems();
      const productSales: Record<string, number> = {};
      for (const item of allItems) {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      }
      res.json(productSales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product sales" });
    }
  });

  // ========== DASHBOARD ANALYTICS API ==========

  app.get("/api/analytics/sales-trend", authMiddleware, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const orders = await storage.getOrders();
      const allOrderItems = await storage.getAllOrderItems();
      
      const itemsByOrder: Record<string, number> = {};
      for (const item of allOrderItems) {
        itemsByOrder[item.orderId] = (itemsByOrder[item.orderId] || 0) + item.quantity;
      }
      
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      
      const dailyData: Record<string, { sales: number; orders: number; items: number }> = {};
      
      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        dailyData[dateKey] = { sales: 0, orders: 0, items: 0 };
      }
      
      for (const order of orders) {
        if (!order.createdAt) continue;
        const orderDate = new Date(order.createdAt);
        if (orderDate < startDate) continue;
        
        const dateKey = orderDate.toISOString().split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].sales += parseFloat(order.totalAmount || "0");
          dailyData[dateKey].orders += 1;
          dailyData[dateKey].items += itemsByOrder[order.id] || 0;
        }
      }
      
      const trend = Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data,
      })).sort((a, b) => a.date.localeCompare(b.date));
      
      res.json(trend);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales trend" });
    }
  });

  app.get("/api/analytics/inventory-trend", authMiddleware, async (req, res) => {
    try {
      const products = await storage.getProducts();
      
      const categoryData: Record<string, { totalStock: number; reserved: number; available: number; count: number }> = {};
      
      for (const product of products) {
        const category = product.category || "Uncategorized";
        if (!categoryData[category]) {
          categoryData[category] = { totalStock: 0, reserved: 0, available: 0, count: 0 };
        }
        categoryData[category].totalStock += product.totalStock;
        categoryData[category].reserved += product.reservedStock;
        categoryData[category].available += (product.totalStock - product.reservedStock);
        categoryData[category].count += 1;
      }
      
      const inventoryBreakdown = Object.entries(categoryData).map(([category, data]) => ({
        category,
        ...data,
      }));
      
      const stockLevels = products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        totalStock: p.totalStock,
        reserved: p.reservedStock,
        available: p.totalStock - p.reservedStock,
        threshold: p.lowStockThreshold || 10,
        status: p.totalStock - p.reservedStock <= 0 ? "out" : 
                p.totalStock - p.reservedStock < (p.lowStockThreshold || 10) ? "low" : "ok",
      }));
      
      const summary = {
        totalProducts: products.length,
        totalStock: products.reduce((sum, p) => sum + p.totalStock, 0),
        totalReserved: products.reduce((sum, p) => sum + p.reservedStock, 0),
        totalAvailable: products.reduce((sum, p) => sum + (p.totalStock - p.reservedStock), 0),
        lowStockCount: stockLevels.filter(s => s.status === "low").length,
        outOfStockCount: stockLevels.filter(s => s.status === "out").length,
      };
      
      res.json({ summary, inventoryBreakdown, stockLevels });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory trend" });
    }
  });

  app.get("/api/analytics/platform-performance", authMiddleware, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const orders = await storage.getOrders();
      
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      
      const platformData: Record<string, { orders: number; revenue: number; avgOrder: number }> = {};
      
      for (const order of orders) {
        if (!order.createdAt) continue;
        const orderDate = new Date(order.createdAt);
        if (orderDate < startDate) continue;
        
        const platform = order.platform || "Unknown";
        if (!platformData[platform]) {
          platformData[platform] = { orders: 0, revenue: 0, avgOrder: 0 };
        }
        platformData[platform].orders += 1;
        platformData[platform].revenue += parseFloat(order.totalAmount || "0");
      }
      
      const performance = Object.entries(platformData).map(([platform, data]) => ({
        platform,
        orders: data.orders,
        revenue: data.revenue,
        avgOrder: data.orders > 0 ? data.revenue / data.orders : 0,
      })).sort((a, b) => b.revenue - a.revenue);
      
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch platform performance" });
    }
  });

  // ========== ORDER ITEMS API ==========
  
  app.get("/api/orders/:orderId/items", async (req, res) => {
    try {
      const items = await storage.getOrderItems(req.params.orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders/:orderId/items", async (req, res) => {
    try {
      const item = await storage.createOrderItem({
        ...req.body,
        orderId: req.params.orderId,
      });
      
      // Check for low stock alert after adding order item
      const product = await storage.getProduct(item.productId);
      if (product) {
        // Broadcast real-time stock update
        broadcastStockUpdate(product.id, product.totalStock, product.reservedStock || 0);
        
        const availableStock = product.totalStock - (product.reservedStock || 0);
        if (availableStock <= (product.lowStockThreshold || 10)) {
          const hasExisting = await storage.hasUnreadNotificationForEntity("LOW_STOCK", product.id);
          if (!hasExisting) {
            await storage.createNotification({
              type: "LOW_STOCK",
              title: "Low Stock Alert",
              message: `${product.name} (SKU: ${product.sku}) is running low. Only ${availableStock} units remaining.`,
              entityType: "product",
              entityId: product.id,
              isRead: false,
            });
          }
        }
      }
      
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create order item" });
    }
  });

  // ========== PICKLISTS API ==========
  
  app.get("/api/picklists", async (req, res) => {
    try {
      const picklists = await storage.getPicklists();
      res.json(picklists);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch picklists" });
    }
  });

  app.get("/api/picklists/:id", async (req, res) => {
    try {
      const picklist = await storage.getPicklist(req.params.id);
      if (!picklist) {
        return res.status(404).json({ error: "Picklist not found" });
      }
      res.json(picklist);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch picklist" });
    }
  });

  app.post("/api/picklists", async (req, res) => {
    try {
      const picklist = await storage.createPicklist(req.body);
      res.status(201).json(picklist);
    } catch (error) {
      res.status(500).json({ error: "Failed to create picklist" });
    }
  });

  app.patch("/api/picklists/:id", async (req, res) => {
    try {
      const picklist = await storage.updatePicklist(req.params.id, req.body);
      if (!picklist) {
        return res.status(404).json({ error: "Picklist not found" });
      }
      res.json(picklist);
    } catch (error) {
      res.status(500).json({ error: "Failed to update picklist" });
    }
  });

  // ========== CONVERSATIONS API ==========
  
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = await storage.createConversation(req.body);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.updateConversation(req.params.id, req.body);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // ========== MESSAGES API ==========
  
  app.get("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const message = await storage.createMessage({
        ...req.body,
        conversationId: req.params.conversationId,
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // ========== EXPORT/IMPORT API ==========

  // Export customers to Excel
  app.get("/api/export/customers", authMiddleware, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const data = customers.map(c => ({
        CRN: c.crn,
        Name: c.name,
        Email: c.email || "",
        Phone: c.phone || "",
        Address: c.address || "",
        Stage: c.stage,
        Platform: c.platform || "",
        Tags: (c.tags || []).join(", "),
        Notes: c.notes || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=customers_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export customers" });
    }
  });

  // Export products to Excel
  app.get("/api/export/products", authMiddleware, async (req, res) => {
    try {
      const products = await storage.getProducts();
      const data = products.map(p => ({
        SKU: p.sku,
        Barcode: p.barcode || "",
        Name: p.name,
        Description: p.description || "",
        Category: p.category || "",
        Color: p.color || "",
        Size: p.size || "",
        Price: p.price,
        Cost: p.cost || "",
        "Total Stock": p.totalStock,
        "Reserved Stock": p.reservedStock,
        "Low Stock Threshold": p.lowStockThreshold || 10,
        Active: p.isActive ? "Yes" : "No",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=products_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // Export orders to Excel
  app.get("/api/export/orders", authMiddleware, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const data = orders.map(o => ({
        "Order ID": o.orderId,
        "Platform Order ID": o.platformOrderId || "",
        Platform: o.platform,
        Status: o.status,
        "Payment Status": o.paymentStatus || "",
        "Total Amount": o.totalAmount,
        "Paid Amount": o.paidAmount || "0",
        Discount: o.discount || "0",
        Courier: o.courier || "",
        "Shipping Address": o.shippingAddress || "",
        Notes: o.notes || "",
        "Created At": o.createdAt ? new Date(o.createdAt).toISOString() : "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=orders_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export orders" });
    }
  });

  // Import customers from Excel
  app.post("/api/import/customers", authMiddleware, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const row of data) {
        try {
          await storage.createCustomer({
            name: row.Name || row.name,
            email: row.Email || row.email || null,
            phone: row.Phone || row.phone || null,
            address: row.Address || row.address || null,
            stage: row.Stage || row.stage || "Lead",
            platform: row.Platform || row.platform || null,
            tags: row.Tags ? String(row.Tags).split(",").map((t: string) => t.trim()) : null,
            notes: row.Notes || row.notes || null,
            crn: "",
          });
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: ${err.message}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import customers" });
    }
  });

  // Import products from Excel
  app.post("/api/import/products", authMiddleware, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const row of data) {
        try {
          const sku = row.SKU || row.sku;
          if (!sku) {
            throw new Error("SKU is required");
          }

          await storage.createProduct({
            sku,
            barcode: row.Barcode || row.barcode || null,
            name: row.Name || row.name,
            description: row.Description || row.description || null,
            category: row.Category || row.category || null,
            color: row.Color || row.color || null,
            size: row.Size || row.size || null,
            price: String(row.Price || row.price || 0),
            cost: row.Cost || row.cost ? String(row.Cost || row.cost) : null,
            totalStock: parseInt(row["Total Stock"] || row.totalStock || 0),
            reservedStock: parseInt(row["Reserved Stock"] || row.reservedStock || 0),
            lowStockThreshold: parseInt(row["Low Stock Threshold"] || row.lowStockThreshold || 10),
            isActive: row.Active === "Yes" || row.isActive === true,
          });
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: ${err.message}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // ========== NOTIFICATION ROUTES ==========

  // Get notifications
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const notifications = await storage.getNotifications({ unreadOnly, limit });
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/count", authMiddleware, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  // Mark single notification as read
  app.patch("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await storage.markAllNotificationsRead();
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // ========== META WEBHOOK ROUTES (Facebook Messenger & WhatsApp) ==========

  // Webhook verification (GET) - required by Meta
  app.get("/webhooks/meta", (req, res) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    const result = verifyWebhookChallenge(mode, token, challenge);
    if (result) {
      console.log("Meta webhook verified successfully");
      res.status(200).send(result);
    } else {
      console.error("Meta webhook verification failed");
      res.status(403).send("Forbidden");
    }
  });

  // Webhook event handler (POST) - receives messages from Meta
  app.post("/webhooks/meta", async (req, res) => {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      const body = JSON.stringify(req.body);

      if (signature && !verifyWebhookSignature(body, signature)) {
        console.error("Invalid webhook signature");
        return res.status(403).send("Invalid signature");
      }

      const { object, entry } = req.body;

      if (object === "page") {
        await processMessengerWebhook(entry);
        
        for (const e of entry) {
          if (e.messaging) {
            for (const msg of e.messaging) {
              if (msg.message) {
                broadcastConversationUpdate({ platform: "Facebook Messenger" });
              }
            }
          }
        }
      } else if (object === "whatsapp_business_account") {
        await processWhatsAppWebhook(entry);
        
        for (const e of entry) {
          if (e.changes) {
            for (const change of e.changes) {
              if (change.value?.messages) {
                broadcastConversationUpdate({ platform: "WhatsApp" });
              }
            }
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).send("Error processing webhook");
    }
  });

  // ========== META MESSAGING INTEGRATION ROUTES ==========

  // Get Meta integration status
  app.get("/api/integrations/meta/status", authMiddleware, (req, res) => {
    res.json(getIntegrationStatus());
  });

  // Send message via Facebook Messenger
  app.post("/api/integrations/meta/messenger/send", authMiddleware, async (req, res) => {
    try {
      const { conversationId, message } = req.body;

      if (!conversationId || !message) {
        return res.status(400).json({ error: "conversationId and message are required" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.channel !== "facebook_messenger") {
        return res.status(400).json({ error: "Conversation is not a Facebook Messenger conversation" });
      }

      const participants = await storage.getConversationParticipants(conversationId);
      const recipient = participants.find(p => p.isPrimary);

      if (!recipient) {
        return res.status(400).json({ error: "No recipient found for this conversation" });
      }

      const result = await sendMessengerMessage(recipient.externalUserId, message, conversationId);

      if (result.success) {
        broadcastNewMessage(conversationId, { content: message, sender: "agent" });
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error("Messenger send error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Send message via WhatsApp
  app.post("/api/integrations/meta/whatsapp/send", authMiddleware, async (req, res) => {
    try {
      const { conversationId, message } = req.body;

      if (!conversationId || !message) {
        return res.status(400).json({ error: "conversationId and message are required" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.channel !== "whatsapp") {
        return res.status(400).json({ error: "Conversation is not a WhatsApp conversation" });
      }

      const participants = await storage.getConversationParticipants(conversationId);
      const recipient = participants.find(p => p.isPrimary);

      if (!recipient || !recipient.phoneNumber) {
        return res.status(400).json({ error: "No phone number found for this conversation" });
      }

      const result = await sendWhatsAppMessage(recipient.phoneNumber, message, conversationId);

      if (result.success) {
        broadcastNewMessage(conversationId, { content: message, sender: "agent" });
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Generic send message (auto-routes based on conversation channel)
  app.post("/api/conversations/:id/send", authMiddleware, async (req, res) => {
    try {
      const conversationId = req.params.id;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      let result: { success: boolean; messageId?: string; error?: string };

      if (conversation.channel === "facebook_messenger") {
        const participants = await storage.getConversationParticipants(conversationId);
        const recipient = participants.find(p => p.isPrimary);
        if (!recipient) {
          return res.status(400).json({ error: "No recipient found" });
        }
        result = await sendMessengerMessage(recipient.externalUserId, message, conversationId);
      } else if (conversation.channel === "whatsapp") {
        const participants = await storage.getConversationParticipants(conversationId);
        const recipient = participants.find(p => p.isPrimary);
        if (!recipient?.phoneNumber) {
          return res.status(400).json({ error: "No phone number found" });
        }
        result = await sendWhatsAppMessage(recipient.phoneNumber, message, conversationId);
      } else {
        const storedMessage = await storage.createMessage({
          conversationId,
          content: message,
          sender: "agent",
          direction: "outbound",
          status: "sent",
          externalMessageId: null,
          externalTimestamp: null,
          attachments: null,
          metadata: null,
        });
        result = { success: true, messageId: storedMessage.id };
      }

      if (result.success) {
        broadcastNewMessage(conversationId, { content: message, sender: "agent" });
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get conversation with participants
  app.get("/api/conversations/:id/details", authMiddleware, async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const participants = await storage.getConversationParticipants(req.params.id);
      const messages = await storage.getMessages(req.params.id);
      
      let customer = null;
      if (conversation.customerId) {
        customer = await storage.getCustomer(conversation.customerId);
      }

      res.json({
        ...conversation,
        participants,
        messages,
        customer,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation details" });
    }
  });

  // ========== E-COMMERCE INTEGRATION ROUTES ==========

  // Get all platform statuses (combines env vars and DB tokens)
  app.get("/api/integrations/ecommerce/status", authMiddleware, async (req, res) => {
    const [shopeeIntegration, lazadaIntegration, tiktokIntegration] = await Promise.all([
      storage.getPlatformIntegration("Shopee"),
      storage.getPlatformIntegration("Lazada"),
      storage.getPlatformIntegration("TikTok Shop"),
    ]);

    const shopeeEnv = getShopeeStatus();
    const lazadaEnv = getLazadaStatus();
    const tiktokEnv = getTikTokStatus();

    res.json({
      shopee: {
        ...shopeeEnv,
        hasTokens: shopeeEnv.hasTokens || !!shopeeIntegration?.accessToken,
        shopId: shopeeIntegration?.shopId || null,
        lastSyncAt: shopeeIntegration?.lastSyncAt || null,
        isActive: shopeeIntegration?.isActive || false,
      },
      lazada: {
        ...lazadaEnv,
        hasTokens: lazadaEnv.hasTokens || !!lazadaIntegration?.accessToken,
        shopId: lazadaIntegration?.shopId || null,
        lastSyncAt: lazadaIntegration?.lastSyncAt || null,
        isActive: lazadaIntegration?.isActive || false,
      },
      tiktok: {
        ...tiktokEnv,
        hasTokens: tiktokEnv.hasTokens || !!tiktokIntegration?.accessToken,
        shopId: tiktokIntegration?.shopId || null,
        lastSyncAt: tiktokIntegration?.lastSyncAt || null,
        isActive: tiktokIntegration?.isActive || false,
      },
    });
  });

  // Shopee OAuth flow
  app.get("/api/integrations/shopee/auth-url", authMiddleware, (req, res) => {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/shopee/callback`;
    const authUrl = getShopeeAuthUrl(redirectUri);
    
    if (!authUrl) {
      return res.status(400).json({ error: "Shopee not configured. Please add SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY secrets." });
    }
    
    res.json({ authUrl });
  });

  app.get("/api/integrations/shopee/callback", async (req, res) => {
    try {
      const { code, shop_id } = req.query;
      
      if (!code || !shop_id) {
        return res.redirect("/#/integrations?error=missing_params");
      }

      const result = await exchangeShopeeCode(code as string, shop_id as string);
      
      if (result.success && result.accessToken) {
        const updateData: any = {
          shopId: shop_id as string,
          accessToken: result.accessToken,
          isActive: true,
          lastSyncAt: new Date(),
        };
        if (result.refreshToken) {
          updateData.refreshToken = result.refreshToken;
        }
        await storage.updatePlatformIntegration("Shopee", updateData);
        console.log(`[Shopee] Successfully connected shop ${shop_id}`);
        res.redirect("/#/integrations?success=shopee_connected");
      } else {
        console.error(`[Shopee] OAuth failed: ${result.error}`);
        res.redirect(`/#/integrations?error=${encodeURIComponent(result.error || "unknown")}`);
      }
    } catch (error: any) {
      console.error(`[Shopee] Callback error: ${error.message}`);
      res.redirect(`/#/integrations?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.post("/api/integrations/shopee/sync", authMiddleware, async (req, res) => {
    try {
      const log = await storage.createSyncLog({
        platform: "Shopee",
        syncType: "orders",
        status: "running",
        recordsSynced: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      });

      const result = await syncShopeeOrders();

      await storage.updateSyncLog(log.id, {
        status: result.success ? "completed" : "failed",
        recordsSynced: result.ordersCount || 0,
        errorMessage: result.error || null,
        completedAt: new Date(),
      });

      if (result.success) {
        await storage.updatePlatformIntegration("Shopee", { lastSyncAt: new Date() });
        res.json({ success: true, ordersCount: result.ordersCount });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lazada OAuth flow
  app.get("/api/integrations/lazada/auth-url", authMiddleware, (req, res) => {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/lazada/callback`;
    const authUrl = getLazadaAuthUrl(redirectUri);
    
    if (!authUrl) {
      return res.status(400).json({ error: "Lazada not configured. Please add LAZADA_APP_KEY and LAZADA_APP_SECRET secrets." });
    }
    
    res.json({ authUrl });
  });

  app.get("/api/integrations/lazada/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.redirect("/#/integrations?error=missing_code");
      }

      const result = await exchangeLazadaCode(code as string);
      
      if (result.success && result.accessToken) {
        const updateData: any = {
          accessToken: result.accessToken,
          isActive: true,
          lastSyncAt: new Date(),
        };
        if (result.refreshToken) {
          updateData.refreshToken = result.refreshToken;
        }
        await storage.updatePlatformIntegration("Lazada", updateData);
        console.log(`[Lazada] Successfully connected`);
        res.redirect("/#/integrations?success=lazada_connected");
      } else {
        console.error(`[Lazada] OAuth failed: ${result.error}`);
        res.redirect(`/#/integrations?error=${encodeURIComponent(result.error || "unknown")}`);
      }
    } catch (error: any) {
      console.error(`[Lazada] Callback error: ${error.message}`);
      res.redirect(`/#/integrations?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.post("/api/integrations/lazada/sync", authMiddleware, async (req, res) => {
    try {
      const log = await storage.createSyncLog({
        platform: "Lazada",
        syncType: "orders",
        status: "running",
        recordsSynced: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      });

      const result = await syncLazadaOrders();

      await storage.updateSyncLog(log.id, {
        status: result.success ? "completed" : "failed",
        recordsSynced: result.ordersCount || 0,
        errorMessage: result.error || null,
        completedAt: new Date(),
      });

      if (result.success) {
        await storage.updatePlatformIntegration("Lazada", { lastSyncAt: new Date() });
        res.json({ success: true, ordersCount: result.ordersCount });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TikTok Shop OAuth flow
  app.get("/api/integrations/tiktok/auth-url", authMiddleware, (req, res) => {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/tiktok/callback`;
    const authUrl = getTikTokAuthUrl(redirectUri);
    
    if (!authUrl) {
      return res.status(400).json({ error: "TikTok Shop not configured. Please add TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET secrets." });
    }
    
    res.json({ authUrl });
  });

  app.get("/api/integrations/tiktok/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.redirect("/#/integrations?error=missing_code");
      }

      const result = await exchangeTikTokCode(code as string);
      
      if (result.success && result.accessToken) {
        const shopId = result.shops?.[0]?.shopId;
        const updateData: any = {
          accessToken: result.accessToken,
          isActive: true,
          lastSyncAt: new Date(),
        };
        if (shopId) {
          updateData.shopId = shopId;
        }
        if (result.refreshToken) {
          updateData.refreshToken = result.refreshToken;
        }
        await storage.updatePlatformIntegration("TikTok Shop", updateData);
        console.log(`[TikTok] Successfully connected shop ${shopId}`);
        res.redirect("/#/integrations?success=tiktok_connected");
      } else {
        console.error(`[TikTok] OAuth failed: ${result.error}`);
        res.redirect(`/#/integrations?error=${encodeURIComponent(result.error || "unknown")}`);
      }
    } catch (error: any) {
      console.error(`[TikTok] Callback error: ${error.message}`);
      res.redirect(`/#/integrations?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.post("/api/integrations/tiktok/sync", authMiddleware, async (req, res) => {
    try {
      const log = await storage.createSyncLog({
        platform: "TikTok Shop",
        syncType: "orders",
        status: "running",
        recordsSynced: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      });

      const result = await syncTikTokOrders();

      await storage.updateSyncLog(log.id, {
        status: result.success ? "completed" : "failed",
        recordsSynced: result.ordersCount || 0,
        errorMessage: result.error || null,
        completedAt: new Date(),
      });

      if (result.success) {
        await storage.updatePlatformIntegration("TikTok Shop", { lastSyncAt: new Date() });
        res.json({ success: true, ordersCount: result.ordersCount });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
