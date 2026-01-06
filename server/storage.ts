// Database storage implementation using PostgreSQL via Drizzle ORM
// Reference: blueprint:javascript_database

import { 
  users, customers, products, orders, orderItems, picklists, conversations, messages,
  roles, sessions, stores, auditLogs, paymentMethods, orderPayments, refunds, posSessions,
  platformIntegrations, syncLogs, notifications,
  conversationParticipants, messageDeliveryEvents,
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Picklist, type InsertPicklist,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Role, type InsertRole,
  type Session, type InsertSession,
  type Store, type InsertStore,
  type AuditLog, type InsertAuditLog,
  type PaymentMethod, type InsertPaymentMethod,
  type OrderPayment, type InsertOrderPayment,
  type Refund, type InsertRefund,
  type PosSession, type InsertPosSession,
  type PlatformIntegration, type InsertPlatformIntegration,
  type SyncLog, type InsertSyncLog,
  type Notification, type InsertNotification,
  type ConversationParticipant, type InsertConversationParticipant,
  type MessageDeliveryEvent, type InsertMessageDeliveryEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;

  // Roles
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;

  // Sessions
  getSession(token: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(token: string): Promise<boolean>;
  deleteUserSessions(userId: string): Promise<boolean>;

  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, store: Partial<InsertStore>): Promise<Store | undefined>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Payment Methods
  getPaymentMethods(): Promise<PaymentMethod[]>;
  getPaymentMethod(id: string): Promise<PaymentMethod | undefined>;
  createPaymentMethod(method: InsertPaymentMethod): Promise<PaymentMethod>;

  // Order Payments
  getOrderPayments(orderId: string): Promise<OrderPayment[]>;
  createOrderPayment(payment: InsertOrderPayment): Promise<OrderPayment>;

  // Refunds
  getRefunds(): Promise<Refund[]>;
  getRefund(id: string): Promise<Refund | undefined>;
  getOrderRefunds(orderId: string): Promise<Refund[]>;
  createRefund(refund: InsertRefund): Promise<Refund>;
  updateRefund(id: string, updates: Partial<InsertRefund>): Promise<Refund | undefined>;

  // POS Sessions
  getPosSessions(): Promise<PosSession[]>;
  getPosSession(id: string): Promise<PosSession | undefined>;
  getOpenPosSession(userId: string): Promise<PosSession | undefined>;
  createPosSession(session: InsertPosSession): Promise<PosSession>;
  updatePosSession(id: string, updates: Partial<InsertPosSession>): Promise<PosSession | undefined>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByPlatformId(platform: string, platformOrderId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  getAllOrderItems(): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;

  // Picklists
  getPicklists(): Promise<Picklist[]>;
  getPicklist(id: string): Promise<Picklist | undefined>;
  createPicklist(picklist: InsertPicklist): Promise<Picklist>;
  updatePicklist(id: string, picklist: Partial<InsertPicklist>): Promise<Picklist | undefined>;

  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation | undefined>;

  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  getMessageByExternalId(externalMessageId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<InsertMessage>): Promise<Message | undefined>;

  // Conversation Participants
  getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]>;
  getConversationByExternalThread(channel: string, externalThreadId: string): Promise<Conversation | undefined>;
  getConversationByParticipant(platform: string, externalUserId: string): Promise<Conversation | undefined>;
  createConversationParticipant(participant: InsertConversationParticipant): Promise<ConversationParticipant>;
  updateConversationParticipant(id: string, updates: Partial<InsertConversationParticipant>): Promise<ConversationParticipant | undefined>;

  // Message Delivery Events
  createMessageDeliveryEvent(event: InsertMessageDeliveryEvent): Promise<MessageDeliveryEvent>;
  getMessageDeliveryEvents(messageId: string): Promise<MessageDeliveryEvent[]>;

  // Platform Integrations
  getPlatformIntegrations(): Promise<PlatformIntegration[]>;
  getPlatformIntegration(platform: string): Promise<PlatformIntegration | undefined>;
  updatePlatformIntegration(platform: string, updates: Partial<InsertPlatformIntegration>): Promise<PlatformIntegration | undefined>;

  // Sync Logs
  getSyncLogs(platform?: string, limit?: number): Promise<SyncLog[]>;
  createSyncLog(log: InsertSyncLog): Promise<SyncLog>;
  updateSyncLog(id: string, updates: Partial<InsertSyncLog>): Promise<SyncLog | undefined>;

  // Notifications
  getNotifications(options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  getUnreadNotificationCount(): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(): Promise<void>;
  hasUnreadNotificationForEntity(type: string, entityId: string): Promise<boolean>;
}

function generateCRN(): string {
  const prefix = "CRN";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

function generateOrderId(): string {
  const prefix = "ORD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

function generatePicklistId(): string {
  const prefix = "PL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role || undefined;
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(insertRole).returning();
    return role;
  }

  // Sessions
  async getSession(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || undefined;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.token, token)).returning();
    return result.length > 0;
  }

  async deleteUserSessions(userId: string): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    return true;
  }

  // Stores
  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async updateStore(id: string, updates: Partial<InsertStore>): Promise<Store | undefined> {
    const [store] = await db.update(stores)
      .set(updates)
      .where(eq(stores.id, id))
      .returning();
    return store || undefined;
  }

  // Audit Logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(insertLog).returning();
    return log;
  }

  // Payment Methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods);
  }

  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return method || undefined;
  }

  async createPaymentMethod(insertMethod: InsertPaymentMethod): Promise<PaymentMethod> {
    const [method] = await db.insert(paymentMethods).values(insertMethod).returning();
    return method;
  }

  // Order Payments
  async getOrderPayments(orderId: string): Promise<OrderPayment[]> {
    return await db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId));
  }

  async createOrderPayment(insertPayment: InsertOrderPayment): Promise<OrderPayment> {
    const [payment] = await db.insert(orderPayments).values(insertPayment).returning();
    return payment;
  }

  // Refunds
  async getRefunds(): Promise<Refund[]> {
    return await db.select().from(refunds).orderBy(desc(refunds.createdAt));
  }

  async getRefund(id: string): Promise<Refund | undefined> {
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, id));
    return refund || undefined;
  }

  async getOrderRefunds(orderId: string): Promise<Refund[]> {
    return await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  }

  async createRefund(insertRefund: InsertRefund): Promise<Refund> {
    const [refund] = await db.insert(refunds).values(insertRefund).returning();
    return refund;
  }

  async updateRefund(id: string, updates: Partial<InsertRefund>): Promise<Refund | undefined> {
    const [refund] = await db.update(refunds)
      .set(updates)
      .where(eq(refunds.id, id))
      .returning();
    return refund || undefined;
  }

  // POS Sessions
  async getPosSessions(): Promise<PosSession[]> {
    return await db.select().from(posSessions).orderBy(desc(posSessions.openedAt));
  }

  async getPosSession(id: string): Promise<PosSession | undefined> {
    const [session] = await db.select().from(posSessions).where(eq(posSessions.id, id));
    return session || undefined;
  }

  async getOpenPosSession(userId: string): Promise<PosSession | undefined> {
    const [session] = await db.select().from(posSessions)
      .where(and(eq(posSessions.userId, userId), eq(posSessions.status, "Open")));
    return session || undefined;
  }

  async createPosSession(insertSession: InsertPosSession): Promise<PosSession> {
    const [session] = await db.insert(posSessions).values(insertSession).returning();
    return session;
  }

  async updatePosSession(id: string, updates: Partial<InsertPosSession>): Promise<PosSession | undefined> {
    const updateData: any = { ...updates };
    if (updates.status === "Closed") {
      updateData.closedAt = new Date();
    }
    const [session] = await db.update(posSessions)
      .set(updateData)
      .where(eq(posSessions.id, id))
      .returning();
    return session || undefined;
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const crn = generateCRN();
    const [customer] = await db.insert(customers).values({
      ...insertCustomer,
      crn,
    }).returning();
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.barcode, barcode));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByPlatformId(platform: string, platformOrderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(
      and(eq(orders.platform, platform), eq(orders.platformOrderId, platformOrderId))
    );
    return order || undefined;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderId = generateOrderId();
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderId,
    }).returning();
    return order;
  }

  async updateOrder(id: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async getAllOrderItems(): Promise<OrderItem[]> {
    return await db.select().from(orderItems);
  }

  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(insertItem).returning();
    return item;
  }

  // Picklists
  async getPicklists(): Promise<Picklist[]> {
    return await db.select().from(picklists);
  }

  async getPicklist(id: string): Promise<Picklist | undefined> {
    const [picklist] = await db.select().from(picklists).where(eq(picklists.id, id));
    return picklist || undefined;
  }

  async createPicklist(insertPicklist: InsertPicklist): Promise<Picklist> {
    const picklistId = generatePicklistId();
    const [picklist] = await db.insert(picklists).values({
      ...insertPicklist,
      picklistId,
    }).returning();
    return picklist;
  }

  async updatePicklist(id: string, updates: Partial<InsertPicklist>): Promise<Picklist | undefined> {
    const updateData: Partial<InsertPicklist> & { pickedAt?: Date } = { ...updates };
    if (updates.status === "Picked") {
      updateData.pickedAt = new Date();
    }
    const [picklist] = await db.update(picklists)
      .set(updateData)
      .where(eq(picklists.id, id))
      .returning();
    return picklist || undefined;
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return await db.select().from(conversations).orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConv).returning();
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [conversation] = await db.update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessageByExternalId(externalMessageId: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages)
      .where(eq(messages.externalMessageId, externalMessageId));
    return message || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    
    await db.update(conversations)
      .set({
        lastMessage: insertMessage.content,
        lastMessageAt: new Date(),
        lastDirection: insertMessage.direction || "inbound",
      })
      .where(eq(conversations.id, insertMessage.conversationId));

    return message;
  }

  async updateMessage(id: string, updates: Partial<InsertMessage>): Promise<Message | undefined> {
    const [message] = await db.update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return message || undefined;
  }

  // Conversation Participants
  async getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    return await db.select().from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
  }

  async getConversationByExternalThread(channel: string, externalThreadId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations)
      .where(and(
        eq(conversations.channel, channel),
        eq(conversations.externalThreadId, externalThreadId)
      ));
    return conversation || undefined;
  }

  async getConversationByParticipant(platform: string, externalUserId: string): Promise<Conversation | undefined> {
    const [participant] = await db.select().from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.platform, platform),
        eq(conversationParticipants.externalUserId, externalUserId)
      ));
    
    if (participant) {
      return await this.getConversation(participant.conversationId);
    }
    return undefined;
  }

  async createConversationParticipant(insertParticipant: InsertConversationParticipant): Promise<ConversationParticipant> {
    const [participant] = await db.insert(conversationParticipants).values(insertParticipant).returning();
    return participant;
  }

  async updateConversationParticipant(id: string, updates: Partial<InsertConversationParticipant>): Promise<ConversationParticipant | undefined> {
    const [participant] = await db.update(conversationParticipants)
      .set(updates)
      .where(eq(conversationParticipants.id, id))
      .returning();
    return participant || undefined;
  }

  // Message Delivery Events
  async createMessageDeliveryEvent(insertEvent: InsertMessageDeliveryEvent): Promise<MessageDeliveryEvent> {
    const [event] = await db.insert(messageDeliveryEvents).values(insertEvent).returning();
    return event;
  }

  async getMessageDeliveryEvents(messageId: string): Promise<MessageDeliveryEvent[]> {
    return await db.select().from(messageDeliveryEvents)
      .where(eq(messageDeliveryEvents.messageId, messageId))
      .orderBy(messageDeliveryEvents.eventTimestamp);
  }

  // Platform Integrations
  async getPlatformIntegrations(): Promise<PlatformIntegration[]> {
    return await db.select().from(platformIntegrations);
  }

  async getPlatformIntegration(platform: string): Promise<PlatformIntegration | undefined> {
    const [integration] = await db.select().from(platformIntegrations)
      .where(eq(platformIntegrations.platform, platform));
    return integration || undefined;
  }

  async updatePlatformIntegration(platform: string, updates: Partial<InsertPlatformIntegration>): Promise<PlatformIntegration | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [integration] = await db.update(platformIntegrations)
      .set(updateData)
      .where(eq(platformIntegrations.platform, platform))
      .returning();
    return integration || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer;
  }

  // Sync Logs
  async getSyncLogs(platform?: string, limit: number = 50): Promise<SyncLog[]> {
    if (platform) {
      return await db.select().from(syncLogs)
        .where(eq(syncLogs.platform, platform))
        .orderBy(desc(syncLogs.startedAt))
        .limit(limit);
    }
    return await db.select().from(syncLogs)
      .orderBy(desc(syncLogs.startedAt))
      .limit(limit);
  }

  async createSyncLog(insertLog: InsertSyncLog): Promise<SyncLog> {
    const [log] = await db.insert(syncLogs).values(insertLog).returning();
    return log;
  }

  async updateSyncLog(id: string, updates: Partial<InsertSyncLog>): Promise<SyncLog | undefined> {
    const [log] = await db.update(syncLogs)
      .set(updates)
      .where(eq(syncLogs.id, id))
      .returning();
    return log || undefined;
  }

  // Notifications
  async getNotifications(options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]> {
    let query = db.select().from(notifications).orderBy(desc(notifications.createdAt));
    if (options?.unreadOnly) {
      // @ts-ignore - drizzle-orm type matching issue
      query = query.where(eq(notifications.isRead, false));
    }
    if (options?.limit) {
      // @ts-ignore
      query = query.limit(options.limit);
    }
    return await query;
  }

  async getUnreadNotificationCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, false));
    return Number(result[0].count);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsRead(): Promise<void> {
    await db.update(notifications).set({ isRead: true });
  }

  async hasUnreadNotificationForEntity(type: string, entityId: string): Promise<boolean> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.type, type),
        eq(notifications.entityId, entityId),
        eq(notifications.isRead, false)
      ));
    return Number(result[0].count) > 0;
  }
}

export const storage = new DatabaseStorage();
