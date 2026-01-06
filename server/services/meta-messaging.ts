import { createHmac } from "crypto";
import { storage } from "../storage";
import type { InsertMessage, InsertConversation, InsertConversationParticipant } from "@shared/schema";

const META_GRAPH_API_BASE = process.env.META_GRAPH_API_BASE || "https://graph.facebook.com/v20.0";

export interface MetaWebhookEntry {
  id: string;
  time: number;
  messaging?: MetaMessagingEvent[];
  changes?: MetaWhatsAppChange[];
}

export interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: { url: string };
    }>;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
  read?: {
    watermark: number;
  };
}

export interface MetaWhatsAppChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: Array<{
      profile: { name: string };
      wa_id: string;
    }>;
    messages?: Array<{
      from: string;
      id: string;
      timestamp: string;
      type: string;
      text?: { body: string };
      image?: { id: string; mime_type: string; sha256: string; caption?: string };
      document?: { id: string; mime_type: string; sha256: string; filename: string };
    }>;
    statuses?: Array<{
      id: string;
      status: string;
      timestamp: string;
      recipient_id: string;
    }>;
  };
  field: string;
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.warn("META_APP_SECRET not configured - skipping signature verification");
    return true;
  }

  const expectedSignature = createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}

export function verifyWebhookChallenge(mode: string, token: string, challenge: string): string | null {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}

function generateCRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CRN-${timestamp}${random}`;
}

async function findOrCreateCustomer(platform: string, externalUserId: string, displayName?: string, phoneNumber?: string) {
  const customers = await storage.getCustomers();
  
  // Look for existing customer by phone number (most reliable) or by notes containing external ID
  let customer = customers.find(c => {
    // Match by phone if both have phones
    if (phoneNumber && c.phone && c.phone === phoneNumber) {
      return true;
    }
    // Match by external ID stored in notes field (for Messenger users without phone)
    if (c.notes && c.notes.includes(`ext_id:${externalUserId}`)) {
      return true;
    }
    return false;
  });

  if (!customer) {
    // Generate a unique CRN for the new customer
    const crn = generateCRN();
    
    // Store external ID in notes for future lookup (Messenger users don't have phone numbers)
    const notesWithId = `ext_id:${externalUserId}`;
    
    customer = await storage.createCustomer({
      name: displayName || `${platform} User`,
      phone: phoneNumber || null,
      platform,
      stage: "Lead",
      crn,
      email: null,
      address: null,
      tags: null,
      notes: notesWithId,
      isWalkIn: false,
      storeId: null,
    });
  }

  return customer;
}

async function findOrCreateConversation(
  channel: string,
  platform: string,
  externalThreadId: string,
  externalUserId: string,
  displayName?: string,
  phoneNumber?: string,
  profilePicUrl?: string
) {
  let conversation = await storage.getConversationByExternalThread(channel, externalThreadId);

  if (!conversation) {
    const customer = await findOrCreateCustomer(platform, externalUserId, displayName, phoneNumber);
    
    conversation = await storage.createConversation({
      customerId: customer.id,
      platform,
      channel,
      externalThreadId,
      status: "New",
      lastMessage: null,
      lastDirection: null,
      assignedTo: null,
    });

    await storage.createConversationParticipant({
      conversationId: conversation.id,
      platform,
      externalUserId,
      displayName: displayName || null,
      profilePicUrl: profilePicUrl || null,
      phoneNumber: phoneNumber || null,
      isPrimary: true,
    });
  }

  return conversation;
}

export async function processMessengerWebhook(entries: MetaWebhookEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.messaging) continue;

    for (const event of entry.messaging) {
      if (event.message) {
        const existing = await storage.getMessageByExternalId(event.message.mid);
        if (existing) continue;

        const conversation = await findOrCreateConversation(
          "facebook_messenger",
          "Facebook Messenger",
          event.sender.id,
          event.sender.id
        );

        const attachments = event.message.attachments?.map(att => ({
          type: att.type,
          url: att.payload.url,
        }));

        await storage.createMessage({
          conversationId: conversation.id,
          content: event.message.text || "[Attachment]",
          sender: "customer",
          direction: "inbound",
          status: "delivered",
          externalMessageId: event.message.mid,
          externalTimestamp: new Date(event.timestamp),
          attachments: attachments ? JSON.stringify(attachments) : null,
          metadata: null,
        });

        if (conversation.status === "Closed") {
          await storage.updateConversation(conversation.id, { status: "New" });
        }
      }

      if (event.delivery) {
        for (const mid of event.delivery.mids) {
          const message = await storage.getMessageByExternalId(mid);
          if (message && message.direction === "outbound") {
            await storage.updateMessage(message.id, { status: "delivered" });
            await storage.createMessageDeliveryEvent({
              messageId: message.id,
              status: "delivered",
              platform: "facebook_messenger",
              rawPayload: event.delivery as any,
            });
          }
        }
      }

      if (event.read) {
        const messages = await storage.getMessages(event.sender.id);
        for (const message of messages) {
          if (message.direction === "outbound" && message.status !== "read") {
            const msgTime = message.externalTimestamp ? new Date(message.externalTimestamp).getTime() : 0;
            if (msgTime <= event.read.watermark) {
              await storage.updateMessage(message.id, { status: "read" });
            }
          }
        }
      }
    }
  }
}

export async function processWhatsAppWebhook(entries: MetaWebhookEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.changes) continue;

    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      
      if (value.messages) {
        for (const msg of value.messages) {
          const existing = await storage.getMessageByExternalId(msg.id);
          if (existing) continue;

          const contact = value.contacts?.[0];
          const phoneNumber = msg.from;
          
          const conversation = await findOrCreateConversation(
            "whatsapp",
            "WhatsApp",
            phoneNumber,
            phoneNumber,
            contact?.profile.name,
            phoneNumber
          );

          let content = "";
          let attachments: any[] = [];

          switch (msg.type) {
            case "text":
              content = msg.text?.body || "";
              break;
            case "image":
              content = msg.image?.caption || "[Image]";
              attachments = [{
                type: "image",
                mediaId: msg.image?.id,
                mimeType: msg.image?.mime_type,
              }];
              break;
            case "document":
              content = `[Document: ${msg.document?.filename}]`;
              attachments = [{
                type: "document",
                mediaId: msg.document?.id,
                filename: msg.document?.filename,
                mimeType: msg.document?.mime_type,
              }];
              break;
            default:
              content = `[${msg.type}]`;
          }

          await storage.createMessage({
            conversationId: conversation.id,
            content,
            sender: "customer",
            direction: "inbound",
            status: "delivered",
            externalMessageId: msg.id,
            externalTimestamp: new Date(parseInt(msg.timestamp) * 1000),
            attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
            metadata: null,
          });

          if (conversation.status === "Closed") {
            await storage.updateConversation(conversation.id, { status: "New" });
          }
        }
      }

      if (value.statuses) {
        for (const status of value.statuses) {
          const message = await storage.getMessageByExternalId(status.id);
          if (message) {
            let newStatus: string;
            switch (status.status) {
              case "sent":
                newStatus = "sent";
                break;
              case "delivered":
                newStatus = "delivered";
                break;
              case "read":
                newStatus = "read";
                break;
              case "failed":
                newStatus = "failed";
                break;
              default:
                continue;
            }
            
            await storage.updateMessage(message.id, { status: newStatus });
            await storage.createMessageDeliveryEvent({
              messageId: message.id,
              status: newStatus,
              platform: "whatsapp",
              rawPayload: status as any,
            });
          }
        }
      }
    }
  }
}

export async function sendMessengerMessage(
  recipientId: string,
  message: string,
  conversationId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!pageAccessToken || !pageId) {
    return { success: false, error: "Facebook Messenger credentials not configured" };
  }

  const storedMessage = await storage.createMessage({
    conversationId,
    content: message,
    sender: "agent",
    direction: "outbound",
    status: "pending",
    externalMessageId: null,
    externalTimestamp: null,
    attachments: null,
    metadata: null,
  });

  try {
    const response = await fetch(`${META_GRAPH_API_BASE}/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    });

    const data = await response.json();

    if (response.ok && data.message_id) {
      await storage.updateMessage(storedMessage.id, {
        status: "sent",
        externalMessageId: data.message_id,
        externalTimestamp: new Date(),
      });
      return { success: true, messageId: data.message_id };
    } else {
      await storage.updateMessage(storedMessage.id, { status: "failed" });
      return { success: false, error: data.error?.message || "Failed to send message" };
    }
  } catch (error: any) {
    await storage.updateMessage(storedMessage.id, { status: "failed" });
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  conversationId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: "WhatsApp Business credentials not configured" };
  }

  const storedMessage = await storage.createMessage({
    conversationId,
    content: message,
    sender: "agent",
    direction: "outbound",
    status: "pending",
    externalMessageId: null,
    externalTimestamp: null,
    attachments: null,
    metadata: null,
  });

  try {
    const response = await fetch(`${META_GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      await storage.updateMessage(storedMessage.id, {
        status: "sent",
        externalMessageId: data.messages[0].id,
        externalTimestamp: new Date(),
      });
      return { success: true, messageId: data.messages[0].id };
    } else {
      await storage.updateMessage(storedMessage.id, { status: "failed" });
      return { success: false, error: data.error?.message || "Failed to send message" };
    }
  } catch (error: any) {
    await storage.updateMessage(storedMessage.id, { status: "failed" });
    return { success: false, error: error.message };
  }
}

export function getIntegrationStatus() {
  return {
    messenger: {
      configured: !!(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID),
      pageId: process.env.META_PAGE_ID ? "***" + process.env.META_PAGE_ID.slice(-4) : null,
    },
    whatsapp: {
      configured: !!(
        (process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN) &&
        process.env.META_WHATSAPP_PHONE_NUMBER_ID
      ),
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID 
        ? "***" + process.env.META_WHATSAPP_PHONE_NUMBER_ID.slice(-4) 
        : null,
    },
    webhookVerifyToken: !!process.env.META_VERIFY_TOKEN,
    appSecretConfigured: !!process.env.META_APP_SECRET,
  };
}
