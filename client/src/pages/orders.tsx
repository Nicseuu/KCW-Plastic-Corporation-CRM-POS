import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Minus,
  Download,
  ShoppingCart,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Order, OrderItem, Product, Customer } from "@shared/schema";
import { ORDER_STATUSES, PLATFORMS } from "@shared/schema";
import { format } from "date-fns";

const orderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  platform: z.string().min(1, "Platform is required"),
  totalAmount: z.string().min(1, "Amount is required"),
  courier: z.string().optional(),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

function getStatusColor(status: string) {
  switch (status) {
    case "Completed":
    case "Delivered":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Shipped":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Paid":
    case "Packed":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "Pending":
    case "Processing":
    case "Ready to Ship":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "Cancelled":
    case "Refunded":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getCourierColor(courier: string | null): string {
  switch (courier) {
    case "J&T":
      return "bg-red-600 text-white";
    case "SPX":
      return "bg-orange-600 text-white";
    case "FLASH":
      return "bg-yellow-500 text-black";
    case "LBC":
      return "bg-red-700 text-white";
    case "Grab":
      return "bg-green-500 text-white";
    case "Lalamove":
      return "bg-orange-500 text-white";
    case "GoGo":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-400 text-white";
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "TikTok Shop":
      return "bg-black text-white";
    case "Shopee":
      return "bg-orange-500 text-white";
    case "Lazada":
      return "bg-purple-600 text-white";
    case "Manual":
      return "bg-blue-500 text-white";
    case "POS":
      return "bg-green-600 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

interface OrderLineItem {
  rowNumber: number;
  date: string;
  orderId: string;
  platformOrderId: string | null;
  platform: string;
  quantity: number;
  description: string;
  color: string | null;
  courier: string | null;
  status: string;
  amount: string;
  customerName: string;
}

interface OrderItemEntry {
  productId: string;
  quantity: number;
  price: string;
}

function AddOrderDialog({
  onClose,
  customers,
  products,
}: {
  onClose: () => void;
  customers: Customer[];
  products: Product[];
}) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [platform, setPlatform] = useState("Manual");
  const [courier, setCourier] = useState("");
  const [notes, setNotes] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItemEntry[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    
    const existing = orderItems.find(item => item.productId === selectedProduct);
    if (existing) {
      setOrderItems(orderItems.map(item => 
        item.productId === selectedProduct 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { 
        productId: selectedProduct, 
        quantity: 1, 
        price: product.price 
      }]);
    }
    setSelectedProduct("");
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(item => item.productId !== productId));
    } else {
      setOrderItems(orderItems.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ));
    }
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId));
  };

  const totalAmount = orderItems.reduce((sum, item) => 
    sum + (Number(item.price) * item.quantity), 0
  );

  const createOrder = useMutation({
    mutationFn: async () => {
      const orderId = `MAN-${Date.now()}`;
      const orderResponse = await apiRequest("POST", "/api/orders", {
        orderId,
        customerId,
        platform,
        courier: courier || undefined,
        notes: notes || undefined,
        totalAmount: totalAmount.toFixed(2),
        status: "Pending",
      });
      const order = await orderResponse.json();

      for (const item of orderItems) {
        await apiRequest("POST", `/api/orders/${order.id}/items`, {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        });
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-items"] });
      toast({ title: "Order created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create order", variant: "destructive" });
    },
  });

  const canSubmit = customerId && orderItems.length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Customer *</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="select-order-customer">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name} ({customer.crn})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Platform *</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger data-testid="select-order-platform">
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Courier</Label>
          <Select value={courier} onValueChange={setCourier}>
            <SelectTrigger data-testid="select-order-courier">
              <SelectValue placeholder="Select courier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="J&T">J&T</SelectItem>
              <SelectItem value="SPX">SPX</SelectItem>
              <SelectItem value="FLASH">FLASH</SelectItem>
              <SelectItem value="LBC">LBC</SelectItem>
              <SelectItem value="Grab">Grab</SelectItem>
              <SelectItem value="Lalamove">Lalamove</SelectItem>
              <SelectItem value="GoGo">GoGo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Order Items *</Label>
        <div className="flex gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="flex-1" data-testid="select-order-product">
              <SelectValue placeholder="Select product to add" />
            </SelectTrigger>
            <SelectContent>
              {products.filter(p => p.isActive).map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} - PHP {Number(product.price).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={addItem} disabled={!selectedProduct} data-testid="button-add-item">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {orderItems.length > 0 && (
          <div className="border rounded-md divide-y">
            {orderItems.map((item) => {
              const product = products.find(p => p.id === item.productId);
              return (
                <div key={item.productId} className="flex items-center gap-3 p-2" data-testid={`order-item-${item.productId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      PHP {Number(item.price).toFixed(2)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(item.productId)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between p-2 bg-muted/50 font-medium">
              <span>Total</span>
              <span>PHP {totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Order notes..."
          data-testid="input-order-notes"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => createOrder.mutate()}
          disabled={!canSubmit || createOrder.isPending}
          data-testid="button-save-order"
        >
          {createOrder.isPending ? "Creating..." : "Create Order"}
        </Button>
      </div>
    </div>
  );
}

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { token } = useAuth();

  const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: ["/api/order-items"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const orderLineItems = useMemo(() => {
    const items: OrderLineItem[] = [];
    let rowNumber = 0;

    orders.forEach((order) => {
      const orderItemsList = orderItems.filter((item) => item.orderId === order.id);
      const customer = customers.find((c) => c.id === order.customerId);

      if (orderItemsList.length === 0) {
        rowNumber++;
        items.push({
          rowNumber,
          date: order.createdAt ? format(new Date(order.createdAt), "yyMMdd") : "-",
          orderId: order.orderId,
          platformOrderId: order.platformOrderId,
          platform: order.platform,
          quantity: 0,
          description: "(No items)",
          color: null,
          courier: order.courier,
          status: order.status,
          amount: order.totalAmount,
          customerName: customer?.name || "Unknown",
        });
      } else {
        orderItemsList.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          rowNumber++;

          items.push({
            rowNumber,
            date: order.createdAt ? format(new Date(order.createdAt), "yyMMdd") : "-",
            orderId: order.orderId,
            platformOrderId: order.platformOrderId,
            platform: order.platform,
            quantity: item.quantity,
            description: product?.name || "Unknown Product",
            color: product?.color || null,
            courier: order.courier,
            status: order.status,
            amount: item.price,
            customerName: customer?.name || "Unknown",
          });
        });
      }
    });

    return items;
  }, [orders, orderItems, products, customers]);

  const filteredItems = useMemo(() => {
    return orderLineItems.filter((item) => {
      const matchesSearch =
        item.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.platformOrderId?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [orderLineItems, searchQuery, statusFilter, platformFilter]);

  const stats = useMemo(() => {
    const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const uniqueOrders = orders.length;
    const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
    return { totalAmount, uniqueOrders, totalItems };
  }, [orders, filteredItems]);

  const statusCounts = useMemo(() => {
    return ORDER_STATUSES.reduce((acc, status) => {
      acc[status] = orders.filter((o) => o.status === status).length;
      return acc;
    }, {} as Record<string, number>);
  }, [orders]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: "Orders exported to Excel" });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export orders", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = ordersLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-orders-title">
            <ShoppingCart className="w-6 h-6" />
            Order Management
          </h1>
          <p className="text-muted-foreground">
            Manage orders from all platforms
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export-orders"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-order">
                <Plus className="w-4 h-4 mr-2" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Manual Order</DialogTitle>
              </DialogHeader>
              <AddOrderDialog
                onClose={() => setDialogOpen(false)}
                customers={customers}
                products={products}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-orders">{stats.uniqueOrders}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-items">{stats.totalItems}</p>
                <p className="text-xs text-muted-foreground">Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Filter className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-line-items">{filteredItems.length}</p>
                <p className="text-xs text-muted-foreground">Line Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                <Truck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold" data-testid="text-total-amount">
                  PHP {stats.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Badge
          variant={statusFilter === "all" ? "default" : "outline"}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => setStatusFilter("all")}
        >
          All ({orders.length})
        </Badge>
        {ORDER_STATUSES.map((status) => (
          <Badge
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setStatusFilter(status)}
          >
            {status} ({statusCounts[status] || 0})
          </Badge>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-orders"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-platform-filter">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-semibold">Order Summary</CardTitle>
          <Badge variant="secondary">{filteredItems.length} items</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No orders found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first order to get started"}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead className="w-16 text-center">Qty</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow key={`${item.orderId}-${index}`} data-testid={`row-order-${index}`}>
                      <TableCell className="font-medium text-muted-foreground">{item.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{item.date}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.platformOrderId || item.orderId.slice(0, 16)}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{item.quantity}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>
                        {item.color ? (
                          <Badge variant="outline">{item.color}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.courier ? (
                          <Badge className={getCourierColor(item.courier)}>{item.courier}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        PHP {Number(item.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
