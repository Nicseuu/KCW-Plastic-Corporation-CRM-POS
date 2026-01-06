import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array().default(sql`ARRAY[]::text[]`),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Users table with authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  roleId: varchar("role_id"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table for auth
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Stores table for multi-store support
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
});

export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof stores.$inferSelect;

// Audit log table for tracking all changes
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  previousData: jsonb("previous_data"),
  newData: jsonb("new_data"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Customer schema
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crn: text("crn").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  stage: text("stage").notNull().default("Lead"),
  tags: text("tags").array(),
  notes: text("notes"),
  platform: text("platform"),
  isWalkIn: boolean("is_walk_in").default(false),
  storeId: varchar("store_id"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Product/SKU schema
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  size: text("size"),
  category: text("category"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  totalStock: integer("total_stock").notNull().default(0),
  reservedStock: integer("reserved_stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  isActive: boolean("is_active").default(true),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Payment methods
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").default(true),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
});

export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// Order schema
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: text("order_id").notNull().unique(),
  platformOrderId: text("platform_order_id"),
  customerId: varchar("customer_id").notNull(),
  storeId: varchar("store_id"),
  cashierId: varchar("cashier_id"),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("Pending"),
  paymentStatus: text("payment_status").default("Unpaid"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  courier: text("courier"),
  shippingAddress: text("shipping_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items schema
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Order payments for tracking multiple/partial payments
export const orderPayments = pgTable("order_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  paymentMethodId: varchar("payment_method_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const insertOrderPaymentSchema = createInsertSchema(orderPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderPayment = z.infer<typeof insertOrderPaymentSchema>;
export type OrderPayment = typeof orderPayments.$inferSelect;

// Refunds table
export const refunds = pgTable("refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: text("status").default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"),
});

export const insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertRefund = z.infer<typeof insertRefundSchema>;
export type Refund = typeof refunds.$inferSelect;

// Picklist schema
export const picklists = pgTable("picklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  picklistId: text("picklist_id").notNull().unique(),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("Pending"),
  pickedAt: timestamp("picked_at"),
  pickedBy: varchar("picked_by"),
});

export const insertPicklistSchema = createInsertSchema(picklists).omit({
  id: true,
  pickedAt: true,
});

export type InsertPicklist = z.infer<typeof insertPicklistSchema>;
export type Picklist = typeof picklists.$inferSelect;

// Messaging channels for platforms
export const MESSAGING_CHANNELS = ["facebook_messenger", "whatsapp", "tiktok", "shopee", "lazada", "manual"] as const;
export type MessagingChannel = typeof MESSAGING_CHANNELS[number];

// Message direction
export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = typeof MESSAGE_DIRECTIONS[number];

// Message delivery status
export const MESSAGE_STATUSES = ["pending", "sent", "delivered", "read", "failed"] as const;
export type MessageDeliveryStatus = typeof MESSAGE_STATUSES[number];

// Inbox/Conversation schema
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  platform: text("platform").notNull(),
  channel: text("channel").notNull().default("manual"),
  externalThreadId: text("external_thread_id"),
  status: text("status").notNull().default("New"),
  assignedTo: varchar("assigned_to"),
  lastMessage: text("last_message"),
  lastDirection: text("last_direction"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Conversation participants (external platform users)
export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  platform: text("platform").notNull(),
  externalUserId: text("external_user_id").notNull(),
  displayName: text("display_name"),
  profilePicUrl: text("profile_pic_url"),
  phoneNumber: text("phone_number"),
  isPrimary: boolean("is_primary").default(true),
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
});

export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;

// Messages schema
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  content: text("content").notNull(),
  sender: text("sender").notNull(),
  direction: text("direction").notNull().default("inbound"),
  status: text("status").notNull().default("sent"),
  externalMessageId: text("external_message_id"),
  externalTimestamp: timestamp("external_timestamp"),
  metadata: jsonb("metadata"),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Message delivery events for tracking receipts
export const messageDeliveryEvents = pgTable("message_delivery_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull(),
  status: text("status").notNull(),
  platform: text("platform").notNull(),
  eventTimestamp: timestamp("event_timestamp").defaultNow(),
  rawPayload: jsonb("raw_payload"),
});

export const insertMessageDeliveryEventSchema = createInsertSchema(messageDeliveryEvents).omit({
  id: true,
  eventTimestamp: true,
});

export type InsertMessageDeliveryEvent = z.infer<typeof insertMessageDeliveryEventSchema>;
export type MessageDeliveryEvent = typeof messageDeliveryEvents.$inferSelect;

// POS Sessions for cashier shifts
export const posSessions = pgTable("pos_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  storeId: varchar("store_id"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).default("0"),
  closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }),
  status: text("status").default("Open"),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertPosSessionSchema = createInsertSchema(posSessions).omit({
  id: true,
  openedAt: true,
  closedAt: true,
});

export type InsertPosSession = z.infer<typeof insertPosSessionSchema>;
export type PosSession = typeof posSessions.$inferSelect;

// Platform types
export const PLATFORMS = ["TikTok Shop", "Shopee", "Lazada", "Manual", "POS", "Facebook Messenger", "WhatsApp"] as const;
export type Platform = typeof PLATFORMS[number];

// Order statuses
export const ORDER_STATUSES = [
  "Pending", "Paid", "Packed", "Shipped", "Delivered", "Completed", "Cancelled", "Refunded"
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

// Payment statuses
export const PAYMENT_STATUSES = ["Unpaid", "Partial", "Paid", "Refunded"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

// Customer stages
export const CUSTOMER_STAGES = ["Lead", "Active", "Repeat", "VIP"] as const;
export type CustomerStage = typeof CUSTOMER_STAGES[number];

// User roles
export const USER_ROLES = ["Admin", "Sales", "Cashier", "Warehouse", "Finance"] as const;
export type UserRole = typeof USER_ROLES[number];

// Audit actions
export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "REFUND", "ADJUSTMENT"] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

// Default permissions per role
export const ROLE_PERMISSIONS = {
  Admin: ["*"],
  Sales: ["customers:read", "customers:write", "orders:read", "orders:write", "products:read", "conversations:read", "conversations:write"],
  Cashier: ["pos:access", "orders:read", "orders:write", "products:read", "customers:read", "customers:write"],
  Warehouse: ["picklists:read", "picklists:write", "products:read", "orders:read"],
  Finance: ["orders:read", "reports:read", "refunds:read", "refunds:write"],
} as const;

// Platform Integrations for e-commerce sync
export const platformIntegrations = pgTable("platform_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull().unique(),
  appId: text("app_id"),
  appSecret: text("app_secret"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  shopId: text("shop_id"),
  isActive: boolean("is_active").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlatformIntegrationSchema = createInsertSchema(platformIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformIntegration = z.infer<typeof insertPlatformIntegrationSchema>;
export type PlatformIntegration = typeof platformIntegrations.$inferSelect;

// Sync Logs for tracking e-commerce sync operations
export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  recordsSynced: integer("records_synced").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({
  id: true,
});

export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SyncLog = typeof syncLogs.$inferSelect;

// Sync types
export const SYNC_TYPES = ["orders", "products", "customers", "inventory", "all"] as const;
export type SyncType = typeof SYNC_TYPES[number];

// Sync statuses
export const SYNC_STATUSES = ["pending", "running", "completed", "failed"] as const;
export type SyncStatus = typeof SYNC_STATUSES[number];

// Notifications table for alerts
export const NOTIFICATION_TYPES = ["LOW_STOCK", "NEW_ORDER", "ORDER_UPDATE", "SYSTEM"] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
