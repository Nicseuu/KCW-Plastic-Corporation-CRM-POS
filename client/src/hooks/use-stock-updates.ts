import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

interface StockUpdatePayload {
  productId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

interface WebSocketMessage {
  type: "STOCK_UPDATE" | "INVENTORY_REFRESH";
  payload?: StockUpdatePayload;
}

export function useStockUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Stock updates WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === "STOCK_UPDATE" && message.payload) {
            const payload = message.payload;
            queryClient.setQueryData(["/api/products"], (oldData: any[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((product) =>
                product.id === payload.productId
                  ? {
                      ...product,
                      totalStock: payload.totalStock,
                      reservedStock: payload.reservedStock,
                    }
                  : product
              );
            });
          } else if (message.type === "INVENTORY_REFRESH") {
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("Stock updates WebSocket disconnected, reconnecting in 3s...");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("Stock updates WebSocket error:", error);
        ws.close();
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return null;
}
