import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Upload,
  Receipt,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Order, Customer, Product } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { useMemo, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  testId,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
  icon: typeof ShoppingCart;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground" data-testid={`${testId}-label`}>
              {title}
            </p>
            <p className="text-3xl font-bold mt-1" data-testid={`${testId}-value`}>
              {value}
            </p>
            {change && (
              <div className="flex items-center gap-1 mt-2">
                {changeType === "positive" ? (
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    changeType === "positive" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {change}
                </span>
                <span className="text-sm text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/pos">
          <Button variant="outline" className="w-full h-20 flex-col gap-2" data-testid="quick-action-pos">
            <Receipt className="w-6 h-6" />
            <span className="text-xs">New Sale</span>
          </Button>
        </Link>
        <Link href="/orders">
          <Button variant="outline" className="w-full h-20 flex-col gap-2" data-testid="quick-action-order">
            <ShoppingCart className="w-6 h-6" />
            <span className="text-xs">New Order</span>
          </Button>
        </Link>
        <Link href="/inventory">
          <Button variant="outline" className="w-full h-20 flex-col gap-2" data-testid="quick-action-product">
            <Plus className="w-6 h-6" />
            <span className="text-xs">Add Product</span>
          </Button>
        </Link>
        <Link href="/inventory">
          <Button variant="outline" className="w-full h-20 flex-col gap-2" data-testid="quick-action-import">
            <Upload className="w-6 h-6" />
            <span className="text-xs">Import Stock</span>
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function SalesTrendChart({ orders }: { orders: Order[] }) {
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      const dayOrders = orders.filter((o) => {
        if (!o.createdAt) return false;
        const orderDate = startOfDay(new Date(o.createdAt));
        return orderDate.getTime() === date.getTime();
      });
      const sales = dayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      return {
        day: format(date, "EEE"),
        date: format(date, "MMM d"),
        sales,
        orders: dayOrders.length,
      };
    });
    return last7Days;
  }, [orders]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Sales Trend (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [`PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "Sales"]}
              />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderStatusChart({ orders }: { orders: Order[] }) {
  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    orders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Order Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={60}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
  items: number;
}

function SalesAnalyticsChart({ days }: { days: number }) {
  const { data: salesTrend = [], isLoading } = useQuery<SalesTrendData[]>({
    queryKey: ["/api/analytics/sales-trend", days],
  });

  const chartData = useMemo(() => {
    return salesTrend.map((d) => ({
      ...d,
      date: format(new Date(d.date), "MMM d"),
    }));
  }, [salesTrend]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Sales Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Sales Analytics ({days} Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                interval={Math.floor(chartData.length / 7)}
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => {
                  if (name === "sales") return [`PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "Revenue"];
                  return [value, name === "orders" ? "Orders" : "Items Sold"];
                }}
              />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#salesGradient)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface InventoryData {
  summary: {
    totalProducts: number;
    totalStock: number;
    totalReserved: number;
    totalAvailable: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  inventoryBreakdown: Array<{
    category: string;
    totalStock: number;
    reserved: number;
    available: number;
    count: number;
  }>;
  stockLevels: Array<{
    id: string;
    name: string;
    sku: string;
    totalStock: number;
    reserved: number;
    available: number;
    threshold: number;
    status: string;
  }>;
}

function InventoryAnalyticsChart() {
  const { data: inventoryData, isLoading } = useQuery<InventoryData>({
    queryKey: ["/api/analytics/inventory-trend"],
  });

  if (isLoading || !inventoryData) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Inventory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, inventoryBreakdown } = inventoryData;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Inventory by Category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-primary" data-testid="text-total-stock">
              {summary.totalStock.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Stock</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-green-600" data-testid="text-available-stock">
              {summary.totalAvailable.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Available</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-amber-600" data-testid="text-reserved-stock">
              {summary.totalReserved.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Reserved</p>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inventoryBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                dataKey="category" 
                type="category" 
                width={100} 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Bar dataKey="available" fill="hsl(var(--chart-1))" name="Available" stackId="a" />
              <Bar dataKey="reserved" fill="hsl(var(--chart-2))" name="Reserved" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface PlatformPerformance {
  platform: string;
  orders: number;
  revenue: number;
  avgOrder: number;
}

function PlatformPerformanceChart({ days }: { days: number }) {
  const { data: performance = [], isLoading } = useQuery<PlatformPerformance[]>({
    queryKey: ["/api/analytics/platform-performance", days],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Platform Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "TikTok Shop": return CHART_COLORS[0];
      case "Shopee": return CHART_COLORS[1];
      case "Lazada": return CHART_COLORS[2];
      case "POS": return CHART_COLORS[3];
      default: return CHART_COLORS[4];
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Platform Performance ({days} Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {performance.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="platform" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {performance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPlatformColor(entry.platform)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BestSellersWidget({ products, salesData }: { products: Product[]; salesData: Record<string, number> }) {
  const productSales = products
    .map((product) => ({
      ...product,
      sold: salesData[product.id] || 0,
    }))
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Best Selling Products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {productSales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No products yet</p>
        ) : (
          productSales.map((product, index) => (
            <div
              key={product.id}
              className="flex items-center gap-3"
              data-testid={`best-seller-${product.id}`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.sku}</p>
              </div>
              <Badge variant="secondary">{product.sold} sold</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SalesByChannelWidget({ orders }: { orders: Order[] }) {
  const channels = ["TikTok Shop", "Shopee", "Lazada", "Manual", "POS"];
  const channelData = channels.map((channel) => {
    const channelOrders = orders.filter((o) => o.platform === channel);
    const total = channelOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    return { channel, count: channelOrders.length, total };
  }).filter((c) => c.count > 0);

  const maxTotal = Math.max(...channelData.map((c) => c.total), 1);

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "TikTok Shop":
        return { bg: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400", bar: "bg-pink-500" };
      case "Shopee":
        return { bg: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", bar: "bg-orange-500" };
      case "Lazada":
        return { bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", bar: "bg-purple-500" };
      case "POS":
        return { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", bar: "bg-blue-500" };
      default:
        return { bg: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", bar: "bg-gray-500" };
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Sales by Channel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {channelData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No sales data yet</p>
        ) : (
          channelData.map((data) => {
            const colors = getChannelColor(data.channel);
            const percentage = (data.total / maxTotal) * 100;
            return (
              <div
                key={data.channel}
                className="space-y-2"
                data-testid={`channel-${data.channel.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className={colors.bg}>
                    {data.channel}
                  </Badge>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{data.count} orders</span>
                    <span className="text-sm font-medium">
                      PHP {data.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function RecentOrdersTable({ orders }: { orders: Order[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Shipped":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "TikTok Shop":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400";
      case "Shopee":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "Lazada":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "POS":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
        <Link href="/orders">
          <Button variant="outline" size="sm" data-testid="button-view-all-orders">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium px-4 py-3">Order ID</th>
                <th className="text-left font-medium px-4 py-3">Platform</th>
                <th className="text-left font-medium px-4 py-3">Amount</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    No orders yet
                  </td>
                </tr>
              ) : (
                orders.slice(0, 5).map((order) => (
                  <tr
                    key={order.id}
                    className="border-t hover-elevate"
                    data-testid={`row-order-${order.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{order.orderId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={getPlatformColor(order.platform)}
                      >
                        {order.platform}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      PHP {Number(order.totalAmount).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={getStatusColor(order.status)}
                      >
                        {order.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LowStockProductsWidget({ products }: { products: Product[] }) {
  const lowStockProducts = products
    .map((p) => ({
      ...p,
      availableStock: p.totalStock - p.reservedStock,
    }))
    .filter((p) => p.availableStock < (p.lowStockThreshold || 10) && p.availableStock > 0)
    .sort((a, b) => a.availableStock - b.availableStock)
    .slice(0, 5);

  const outOfStockProducts = products
    .filter((p) => p.totalStock - p.reservedStock <= 0)
    .slice(0, 3);

  if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Low Stock Products
        </CardTitle>
        <Link href="/inventory">
          <Button variant="outline" size="sm" data-testid="button-view-all-low-stock">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {outOfStockProducts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-red-600">Out of Stock</p>
            {outOfStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20"
                data-testid={`low-stock-product-${product.id}`}
              >
                <Package className="w-4 h-4 text-red-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <Badge variant="destructive">0</Badge>
              </div>
            ))}
          </div>
        )}
        {lowStockProducts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-600">Low Stock</p>
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20"
                data-testid={`low-stock-product-${product.id}`}
              >
                <Package className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  {product.availableStock}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsWidget({ lowStockCount, pendingOrders }: { lowStockCount: number; pendingOrders: number }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Low Stock Alert</p>
            <p className="text-xs text-muted-foreground">{lowStockCount} products below threshold</p>
          </div>
          <Link href="/inventory">
            <Button variant="ghost" size="sm" data-testid="button-view-low-stock">
              View
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Pending Orders</p>
            <p className="text-xs text-muted-foreground">{pendingOrders} orders awaiting processing</p>
          </div>
          <Link href="/orders">
            <Button variant="ghost" size="sm" data-testid="button-view-pending">
              View
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">System Status</p>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<string>("7");

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: productSales = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/product-sales"],
  });

  const days = parseInt(dateRange);

  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.createdAt!).toDateString() === today);
  const todaySales = todayOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const lowStockCount = products.filter(
    (p) => p.totalStock - p.reservedStock < (p.lowStockThreshold || 10)
  ).length;

  const pendingOrders = orders.filter((o) => o.status === "Pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome to KCW Plastic Corporation CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Date Range:</span>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32" data-testid="select-date-range">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={`PHP ${todaySales.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}`}
          icon={TrendingUp}
          testId="stat-today-sales"
        />
        <StatCard
          title="Orders Today"
          value={todayOrders.length.toString()}
          icon={ShoppingCart}
          testId="stat-orders-today"
        />
        <StatCard
          title="Total Customers"
          value={customers.length.toString()}
          icon={Users}
          testId="stat-customers"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockCount.toString()}
          changeType={lowStockCount > 0 ? "negative" : "positive"}
          icon={Package}
          testId="stat-low-stock"
        />
      </div>

      <QuickActions />

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList data-testid="tabs-analytics">
          <TabsTrigger value="sales" data-testid="tab-sales">Sales Analytics</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="platform" data-testid="tab-platform">Platform</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesAnalyticsChart days={days} />
            <SalesTrendChart orders={orders} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesByChannelWidget orders={orders} />
            <OrderStatusChart orders={orders} />
          </div>
        </TabsContent>
        
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InventoryAnalyticsChart />
            <LowStockProductsWidget products={products} />
          </div>
          <BestSellersWidget products={products} salesData={productSales} />
        </TabsContent>
        
        <TabsContent value="platform" className="space-y-6">
          <PlatformPerformanceChart days={days} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesByChannelWidget orders={orders} />
            <OrderStatusChart orders={orders} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentOrdersTable orders={orders} />
        </div>
        <div className="space-y-6">
          <AlertsWidget lowStockCount={lowStockCount} pendingOrders={pendingOrders} />
        </div>
      </div>
    </div>
  );
}
