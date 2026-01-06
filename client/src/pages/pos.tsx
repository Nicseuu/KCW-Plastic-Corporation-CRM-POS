import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Receipt,
  ShoppingBag,
  X,
  CheckCircle2,
  Printer,
  Keyboard,
  Camera,
} from "lucide-react";
import { BarcodeScannerButton } from "@/components/barcode-scanner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Product, Customer, PaymentMethod } from "@shared/schema";

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product) => void;
}) {
  const availableStock = product.totalStock - product.reservedStock;
  const isOutOfStock = availableStock <= 0;

  return (
    <Card
      className={`cursor-pointer hover-elevate transition-all ${
        isOutOfStock ? "opacity-50" : ""
      }`}
      onClick={() => !isOutOfStock && onAdd(product)}
      data-testid={`product-card-${product.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.sku}</p>
            </div>
            {isOutOfStock && (
              <Badge variant="destructive" className="text-xs">
                Out
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-primary">
              PHP {Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-muted-foreground">{availableStock} in stock</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const subtotal = Number(item.product.price) * item.quantity - item.discount;

  return (
    <div className="flex items-center gap-3 py-3" data-testid={`cart-item-${item.product.id}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">
          PHP {Number(item.product.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })} each
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.quantity - 1)}
          disabled={item.quantity <= 1}
          data-testid={`cart-decrease-${item.product.id}`}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.quantity + 1)}
          data-testid={`cart-increase-${item.product.id}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="w-24 text-right font-medium">
        PHP {subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onRemove}
        data-testid={`cart-remove-${item.product.id}`}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  cart,
  customer,
  onComplete,
  subtotal,
  discount,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  customer: Customer | null;
  onComplete: (paymentMethod: string, amountPaid: number, reference?: string) => void;
  subtotal: number;
  discount: number;
  total: number;
}) {
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>(total.toFixed(2));
  const [reference, setReference] = useState("");

  useEffect(() => {
    setAmountPaid(total.toFixed(2));
  }, [total]);

  const change = Number(amountPaid) - total;

  const quickAmounts = [50, 100, 200, 500, 1000, 2000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>Complete the sale</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>PHP {subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-PHP {discount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>PHP {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("cash")}
                className="flex-col h-16 gap-1"
                data-testid="payment-method-cash"
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs">Cash</span>
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => setPaymentMethod("card")}
                className="flex-col h-16 gap-1"
                data-testid="payment-method-card"
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Card</span>
              </Button>
              <Button
                variant={paymentMethod === "ewallet" ? "default" : "outline"}
                onClick={() => setPaymentMethod("ewallet")}
                className="flex-col h-16 gap-1"
                data-testid="payment-method-ewallet"
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs">E-Wallet</span>
              </Button>
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount Received</label>
              <Input
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="text-right text-lg font-bold"
                data-testid="input-amount-paid"
              />
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountPaid(amount.toString())}
                    data-testid={`quick-amount-${amount}`}
                  >
                    {amount}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountPaid(total.toFixed(2))}
                  data-testid="quick-amount-exact"
                >
                  Exact
                </Button>
              </div>
              {change >= 0 && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p className="text-2xl font-bold text-green-600">
                    PHP {change.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          )}

          {(paymentMethod === "card" || paymentMethod === "ewallet") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference Number</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Enter transaction reference"
                data-testid="input-payment-reference"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={paymentMethod === "cash" && Number(amountPaid) < total}
              onClick={() => onComplete(paymentMethod, Number(amountPaid), reference)}
              data-testid="button-complete-payment"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Sale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  open,
  onOpenChange,
  orderId,
  cart,
  customer,
  subtotal,
  discount,
  total,
  paymentMethod,
  amountPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  cart: CartItem[];
  customer: Customer | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
}) {
  const change = amountPaid - total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <p className="font-medium text-lg">Sale Complete!</p>

          <div className="text-left p-4 rounded-lg bg-muted/50 font-mono text-sm">
            <p className="text-center font-bold mb-2">KCW PLASTIC CORP.</p>
            <p className="text-center text-xs text-muted-foreground mb-4">
              {new Date().toLocaleString("en-PH")}
            </p>

            <Separator className="my-2" />

            <p className="text-xs">Order: {orderId}</p>
            {customer && <p className="text-xs">Customer: {customer.name}</p>}

            <Separator className="my-2" />

            {cart.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs">
                <span>
                  {item.quantity}x {item.product.name}
                </span>
                <span>
                  {(Number(item.product.price) * item.quantity).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}

            <Separator className="my-2" />

            <div className="flex justify-between text-xs">
              <span>Subtotal:</span>
              <span>{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs">
                <span>Discount:</span>
                <span>-{discount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>TOTAL:</span>
              <span>PHP {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between text-xs">
              <span>Payment ({paymentMethod}):</span>
              <span>{amountPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
            {paymentMethod === "cash" && change > 0 && (
              <div className="flex justify-between text-xs font-bold">
                <span>Change:</span>
                <span>{change.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <p className="text-center text-xs mt-4">Thank you for shopping!</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)} data-testid="button-new-sale">
              New Sale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function POS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    orderId: string;
    paymentMethod: string;
    amountPaid: number;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const filteredProducts = products.filter(
    (p) =>
      p.isActive &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)))
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
    searchInputRef.current?.focus();
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(
      (p) => p.barcode === barcode || p.sku === barcode
    );
    if (product) {
      const availableStock = product.totalStock - product.reservedStock;
      if (availableStock > 0) {
        addToCart(product);
        toast({ title: "Product added", description: product.name });
      } else {
        toast({ title: "Out of stock", description: product.name, variant: "destructive" });
      }
    } else {
      toast({ title: "Product not found", description: `Barcode: ${barcode}`, variant: "destructive" });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(
        cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setOrderDiscount(0);
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = Math.min(itemDiscounts + orderDiscount, subtotal);
  const total = Math.max(0, subtotal - totalDiscount);

  const createOrderMutation = useMutation({
    mutationFn: async ({
      paymentMethod,
      amountPaid,
      reference,
    }: {
      paymentMethod: string;
      amountPaid: number;
      reference?: string;
    }) => {
      const orderId = `POS-${Date.now()}`;

      let customerId = selectedCustomer?.id;
      if (!customerId) {
        const walkInResponse = await apiRequest("POST", "/api/customers", {
          crn: `WALKIN-${Date.now()}`,
          name: "Walk-in Customer",
          isWalkIn: true,
          stage: "Customer",
        });
        const walkIn = await walkInResponse.json();
        customerId = walkIn.id;
      }

      const orderResponse = await apiRequest("POST", "/api/orders", {
        orderId,
        customerId,
        platform: "POS",
        status: "Completed",
        paymentStatus: "Paid",
        totalAmount: total.toString(),
        paidAmount: amountPaid.toString(),
        discount: totalDiscount.toString(),
        cashierId: user?.id,
        notes: reference ? `Payment ref: ${reference}` : undefined,
      });
      const order = await orderResponse.json();

      for (const item of cart) {
        await apiRequest("POST", "/api/order-items", {
          orderId: order.id,
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        });
      }

      return { orderId, order };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setLastOrder({
        orderId: result.orderId,
        paymentMethod: variables.paymentMethod,
        amountPaid: variables.amountPaid,
      });
      setPaymentDialogOpen(false);
      setReceiptDialogOpen(true);
      toast({ title: "Sale complete!", description: `Order ${result.orderId} created` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
    },
  });

  const handlePaymentComplete = (paymentMethod: string, amountPaid: number, reference?: string) => {
    createOrderMutation.mutate({ paymentMethod, amountPaid, reference });
  };

  const handleReceiptClose = () => {
    setReceiptDialogOpen(false);
    clearCart();
    setLastOrder(null);
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (paymentDialogOpen || receiptDialogOpen) return;

      if (e.key === "F1" || (e.key === "/" && !e.ctrlKey && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (e.key === "F2" || (e.key === "Enter" && e.ctrlKey)) {
        e.preventDefault();
        if (cart.length > 0 && !createOrderMutation.isPending) {
          setPaymentDialogOpen(true);
        }
      }

      if (e.key === "F3") {
        e.preventDefault();
        if (cart.length > 0) {
          clearCart();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, paymentDialogOpen, receiptDialogOpen, createOrderMutation.isPending]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col border-r">
        <div className="p-4 border-b bg-background">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search products or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-pos-search"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <BarcodeScannerButton onScan={handleBarcodeScan} testId="button-pos-scanner" />
              </TooltipTrigger>
              <TooltipContent>Scan barcode</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-keyboard-shortcuts">
                  <Keyboard className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p><kbd className="px-1 rounded bg-muted">F1</kbd> or <kbd className="px-1 rounded bg-muted">/</kbd> Focus search</p>
                  <p><kbd className="px-1 rounded bg-muted">F2</kbd> or <kbd className="px-1 rounded bg-muted">Ctrl+Enter</kbd> Pay now</p>
                  <p><kbd className="px-1 rounded bg-muted">F3</kbd> Clear cart</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="w-96 flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Current Sale
            </h2>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                data-testid="button-clear-cart"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <Select
            value={selectedCustomer?.id || ""}
            onValueChange={(value) => {
              const customer = customers.find((c) => c.id === value);
              setSelectedCustomer(customer || null);
            }}
          >
            <SelectTrigger data-testid="select-customer">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select customer (optional)" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Cart is empty</p>
                <p className="text-sm mt-1">Add products to begin</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <CartItemRow
                    key={item.product.id}
                    item={item}
                    onQuantityChange={(qty) => updateQuantity(item.product.id, qty)}
                    onRemove={() => removeFromCart(item.product.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal ({cart.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
              <span>PHP {subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>
                  -PHP{" "}
                  {totalDiscount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-xl">
              <span>Total</span>
              <span>PHP {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg"
            disabled={cart.length === 0 || createOrderMutation.isPending}
            onClick={() => setPaymentDialogOpen(true)}
            data-testid="button-checkout"
          >
            {createOrderMutation.isPending ? (
              "Processing..."
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay Now
              </>
            )}
          </Button>
        </div>
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        cart={cart}
        customer={selectedCustomer}
        onComplete={handlePaymentComplete}
        subtotal={subtotal}
        discount={totalDiscount}
        total={total}
      />

      {lastOrder && (
        <ReceiptDialog
          open={receiptDialogOpen}
          onOpenChange={handleReceiptClose}
          orderId={lastOrder.orderId}
          cart={cart}
          customer={selectedCustomer}
          subtotal={subtotal}
          discount={totalDiscount}
          total={total}
          paymentMethod={lastOrder.paymentMethod}
          amountPaid={lastOrder.amountPaid}
        />
      )}
    </div>
  );
}
