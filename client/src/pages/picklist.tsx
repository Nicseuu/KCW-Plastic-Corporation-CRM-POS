import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Search,
  Download,
  Printer,
  ClipboardList,
  Package,
  RefreshCw,
  Filter,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Order, OrderItem, Product, Customer } from "@shared/schema";
import { PLATFORMS } from "@shared/schema";
import { format } from "date-fns";

const COURIERS = ["All", "J&T", "SPX", "FLASH", "LBC", "Grab", "Lalamove", "GoGo", "Other"] as const;

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

interface PicklistItem {
  rowNumber: number;
  date: string;
  orderId: string;
  platformOrderId: string | null;
  platform: string;
  quantity: number;
  description: string;
  color: string | null;
  size: string | null;
  courier: string | null;
  customerName: string;
}

export default function PicklistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [courierFilter, setCourierFilter] = useState<string>("All");

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

  const picklistItems = useMemo(() => {
    const pendingStatuses = ["Pending", "Processing", "Ready to Ship", "Paid", "Packed"];
    const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));

    const items: PicklistItem[] = [];
    let rowNumber = 0;

    pendingOrders.forEach((order) => {
      const orderItemsList = orderItems.filter((item) => item.orderId === order.id);
      const customer = customers.find((c) => c.id === order.customerId);

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
          size: product?.size || null,
          courier: order.courier,
          customerName: customer?.name || "Unknown",
        });
      });
    });

    return items;
  }, [orders, orderItems, products, customers]);

  const filteredItems = useMemo(() => {
    return picklistItems.filter((item) => {
      const matchesSearch =
        item.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.platformOrderId?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;
      const matchesCourier = courierFilter === "All" || item.courier === courierFilter;

      return matchesSearch && matchesPlatform && matchesCourier;
    });
  }, [picklistItems, searchQuery, platformFilter, courierFilter]);

  const stats = useMemo(() => {
    const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueOrders = new Set(filteredItems.map((item) => item.orderId)).size;
    return { totalItems, uniqueOrders };
  }, [filteredItems]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ["No.", "Date", "Order ID", "Quantity", "Description", "Color", "Courier"];
    const rows = filteredItems.map((item) => [
      item.rowNumber,
      item.date,
      item.platformOrderId || item.orderId,
      item.quantity,
      item.description,
      item.color || "-",
      item.courier || "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `picklist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = ordersLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-picklist-title">
            <ClipboardList className="w-6 h-6" />
            Picklist Summary
          </h1>
          <p className="text-muted-foreground">
            As of {format(new Date(), "MMMM dd, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-picklist">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExport} data-testid="button-export-picklist">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <ClipboardList className="w-5 h-5 text-blue-600" />
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
                <p className="text-xs text-muted-foreground">Total Items</p>
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
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <Truck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-couriers">
                  {new Set(filteredItems.map((i) => i.courier).filter(Boolean)).size}
                </p>
                <p className="text-xs text-muted-foreground">Couriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-picklist"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-platform-filter">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-courier-filter">
            <Truck className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Courier" />
          </SelectTrigger>
          <SelectContent>
            {COURIERS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg font-semibold">KCW Unbreakables - Picklist Summary</CardTitle>
          <Badge variant="secondary">{filteredItems.length} items</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No items in picklist</p>
              <p className="text-sm">Orders pending shipment will appear here</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow key={`${item.orderId}-${index}`} data-testid={`row-picklist-${index}`}>
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
