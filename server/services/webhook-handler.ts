import { storage } from "../storage";
import { broadcastNewMessage, broadcastConversationUpdate } from "../routes";

export async function processUnifiedWebhook(payload: any) {
  const { platform, event, order_id, customer, items, total_amount, payment_status, created_at } = payload;
  
  console.log(`[Webhook] Received ${event} from ${platform}`);

  // Create sync log
  const syncLog = await storage.createSyncLog({
    platform,
    syncType: "orders",
    status: "running",
    recordsSynced: 0,
  });

  try {
    if (event === "order_created" || event === "order_updated") {
      // 1. Customer Matching
      let dbCustomer = await (storage as any).getCustomerByPhone(customer.phone);
      if (!dbCustomer) {
        // Try platform ID match in notes
        const customers = await storage.getCustomers();
        dbCustomer = customers.find(c => c.notes?.includes(`${platform}:${customer.platform_id}`));
        
        if (!dbCustomer) {
          dbCustomer = await storage.createCustomer({
            crn: `CRN-${Date.now()}`,
            name: customer.name,
            phone: customer.phone,
            platform,
            notes: `ext_id:${customer.platform_id} ${platform}:${customer.platform_id}`,
            stage: "Lead",
          });
        }
      }

      // 2. Order Processing
      const orderData = {
        orderId: `ORD-${platform.toUpperCase()}-${order_id}`,
        platformOrderId: order_id,
        customerId: dbCustomer.id,
        platform,
        status: "Pending",
        paymentStatus: payment_status === "paid" ? "Paid" : "Unpaid",
        totalAmount: total_amount.toString(),
        paidAmount: payment_status === "paid" ? total_amount.toString() : "0",
        createdAt: new Date(created_at),
      };

      let existingOrder = await storage.getOrderByPlatformId(order_id, platform);
      if (existingOrder) {
        await storage.updateOrder(existingOrder.id, orderData);
      } else {
        const newOrder = await storage.createOrder(orderData);
        
        // Create order items
        for (const item of items) {
          const product = await storage.getProductBySku(item.sku);
          if (product) {
            await storage.createOrderItem({
              orderId: newOrder.id,
              productId: product.id,
              quantity: item.quantity,
              price: item.price.toString(),
            });
            
            // Reserve stock logic
            await storage.updateProduct(product.id, {
              reservedStock: product.reservedStock + item.quantity
            });
          }
        }
      }

      await storage.updateSyncLog(syncLog.id, {
        status: "completed",
        recordsSynced: 1,
        completedAt: new Date(),
      });
    }

    if (event === "message_received") {
      // Message logic handled by existing messenger service but integrated here
      const { conversation_id, sender, message } = payload;
      // Normalization and storage would go here
    }

  } catch (error: any) {
    console.error(`[Webhook Error] ${error.message}`);
    await storage.updateSyncLog(syncLog.id, {
      status: "failed",
      errorMessage: error.message,
      completedAt: new Date(),
    });
    throw error;
  }
}
