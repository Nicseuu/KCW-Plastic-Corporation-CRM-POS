import { useState, useRef } from "react";
import { useStockUpdates } from "@/hooks/use-stock-updates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Download,
  Upload,
  Package,
  AlertTriangle,
  TrendingDown,
  FileSpreadsheet,
  Pencil,
  LayoutGrid,
  List,
  Camera,
  Check,
  X,
  Settings2,
  FileText,
} from "lucide-react";
import { BarcodeScannerButton } from "@/components/barcode-scanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Product } from "@shared/schema";
import * as XLSX from "xlsx";

const productFormSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  cost: z.string().optional(),
  totalStock: z.string().default("0"),
  lowStockThreshold: z.string().default("10"),
});

type ProductFormData = z.infer<typeof productFormSchema>;

function ProductCard({ product, onEdit }: { product: Product; onEdit: (product: Product) => void }) {
  const availableStock = product.totalStock - product.reservedStock;
  const isLowStock = availableStock < (product.lowStockThreshold || 10);
  const isOutOfStock = availableStock <= 0;

  return (
    <Card
      className={`hover-elevate ${
        isOutOfStock
          ? "border-red-200 dark:border-red-900"
          : isLowStock
          ? "border-amber-200 dark:border-amber-900"
          : ""
      }`}
      data-testid={`card-product-${product.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOutOfStock ? (
              <Badge variant="destructive">Out of Stock</Badge>
            ) : isLowStock ? (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Low Stock
              </Badge>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEdit(product)}
              data-testid={`button-edit-product-${product.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p
              className={`text-lg font-bold ${
                isOutOfStock
                  ? "text-red-600"
                  : isLowStock
                  ? "text-amber-600"
                  : ""
              }`}
            >
              {availableStock}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reserved</p>
            <p className="text-lg font-bold">{product.reservedStock}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {product.color && (
            <Badge variant="outline" className="text-xs">
              {product.color}
            </Badge>
          )}
          {product.size && (
            <Badge variant="outline" className="text-xs">
              {product.size}
            </Badge>
          )}
        </div>

        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Price</p>
          <p className="font-semibold">
            PHP{" "}
            {Number(product.price).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AddProductDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      totalStock: "0",
      lowStockThreshold: "10",
    },
  });

  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("POST", "/api/products", {
        ...data,
        price: data.price,
        cost: data.cost || null,
        totalStock: parseInt(data.totalStock) || 0,
        reservedStock: 0,
        lowStockThreshold: parseInt(data.lowStockThreshold) || 10,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => createProduct.mutate(data))}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU *</Label>
          <Input
            id="sku"
            {...register("sku")}
            placeholder="e.g., KCW-001"
            data-testid="input-product-sku"
          />
          {errors.sku && (
            <p className="text-sm text-destructive">{errors.sku.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Product name"
            data-testid="input-product-name"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Product description..."
          className="resize-none"
          data-testid="input-product-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            {...register("color")}
            placeholder="e.g., Blue"
            data-testid="input-product-color"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Input
            id="size"
            {...register("size")}
            placeholder="e.g., Large"
            data-testid="input-product-size"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price (PHP) *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            {...register("price")}
            placeholder="0.00"
            data-testid="input-product-price"
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Cost (PHP)</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            {...register("cost")}
            placeholder="0.00"
            data-testid="input-product-cost"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="totalStock">Initial Stock</Label>
          <Input
            id="totalStock"
            type="number"
            {...register("totalStock")}
            placeholder="0"
            data-testid="input-product-stock"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Low Stock Alert</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            {...register("lowStockThreshold")}
            placeholder="10"
            data-testid="input-product-threshold"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createProduct.isPending}
          data-testid="button-save-product"
        >
          {createProduct.isPending ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </form>
  );
}

function EditProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      color: product.color || "",
      size: product.size || "",
      price: product.price,
      cost: product.cost || "",
      totalStock: product.totalStock.toString(),
      lowStockThreshold: (product.lowStockThreshold || 10).toString(),
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("PATCH", `/api/products/${product.id}`, {
        ...data,
        price: data.price,
        cost: data.cost || null,
        totalStock: parseInt(data.totalStock) || 0,
        lowStockThreshold: parseInt(data.lowStockThreshold) || 10,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => updateProduct.mutate(data))}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-sku">SKU *</Label>
          <Input
            id="edit-sku"
            {...register("sku")}
            placeholder="e.g., KCW-001"
            data-testid="input-edit-product-sku"
          />
          {errors.sku && (
            <p className="text-sm text-destructive">{errors.sku.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-name">Product Name *</Label>
          <Input
            id="edit-name"
            {...register("name")}
            placeholder="Product name"
            data-testid="input-edit-product-name"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          {...register("description")}
          placeholder="Product description..."
          className="resize-none"
          data-testid="input-edit-product-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-color">Color</Label>
          <Input
            id="edit-color"
            {...register("color")}
            placeholder="e.g., Blue"
            data-testid="input-edit-product-color"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-size">Size</Label>
          <Input
            id="edit-size"
            {...register("size")}
            placeholder="e.g., Large"
            data-testid="input-edit-product-size"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-price">Price (PHP) *</Label>
          <Input
            id="edit-price"
            type="number"
            step="0.01"
            {...register("price")}
            placeholder="0.00"
            data-testid="input-edit-product-price"
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-cost">Cost (PHP)</Label>
          <Input
            id="edit-cost"
            type="number"
            step="0.01"
            {...register("cost")}
            placeholder="0.00"
            data-testid="input-edit-product-cost"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-totalStock">Total Stock</Label>
          <Input
            id="edit-totalStock"
            type="number"
            {...register("totalStock")}
            placeholder="0"
            data-testid="input-edit-product-stock"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-lowStockThreshold">Low Stock Alert</Label>
          <Input
            id="edit-lowStockThreshold"
            type="number"
            {...register("lowStockThreshold")}
            placeholder="10"
            data-testid="input-edit-product-threshold"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={updateProduct.isPending}
          data-testid="button-update-product"
        >
          {updateProduct.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

const ALL_COLUMNS = ["sku", "name", "variant", "price", "available", "reserved", "status", "actions"] as const;
type ColumnKey = typeof ALL_COLUMNS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  sku: "SKU",
  name: "Name",
  variant: "Variant",
  price: "Price",
  available: "Available",
  reserved: "Reserved",
  status: "Status",
  actions: "Actions",
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditField, setQuickEditField] = useState<"name" | "price" | "totalStock" | null>(null);
  const [quickEditValue, setQuickEditValue] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(ALL_COLUMNS));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { token } = useAuth();
  
  useStockUpdates();

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((prev) => {
      const newColumns = new Set(prev);
      if (newColumns.has(column)) {
        newColumns.delete(column);
      } else {
        newColumns.add(column);
      }
      return newColumns;
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(
      (p) => p.barcode === barcode || p.sku === barcode
    );
    if (product) {
      setSearchQuery(barcode);
      handleEditProduct(product);
      toast({ title: "Product found", description: product.name });
    } else {
      toast({ title: "Product not found", description: `Barcode: ${barcode}`, variant: "destructive" });
    }
  };

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: "Products exported to Excel" });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export products", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setImportData(jsonData);
        setImportDialogOpen(true);
      } catch (error) {
        toast({ title: "Invalid file", description: "Could not read Excel file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await apiRequest("POST", "/api/import/products", { data });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Import complete",
        description: `${result.success} products imported, ${result.failed} failed`,
      });
      setImportDialogOpen(false);
      setImportData([]);
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  const quickEditMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest("PATCH", `/api/products/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated successfully" });
      setQuickEditId(null);
      setQuickEditField(null);
      setQuickEditValue("");
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const handleQuickEditSave = (productId: string) => {
    if (!quickEditField) return;

    let value: any = quickEditValue;
    if (quickEditField === "price") {
      const price = parseFloat(quickEditValue);
      if (isNaN(price) || price < 0) {
        toast({ title: "Invalid price value", variant: "destructive" });
        return;
      }
      value = price.toString();
    } else if (quickEditField === "totalStock") {
      const stock = parseInt(quickEditValue);
      if (isNaN(stock) || stock < 0) {
        toast({ title: "Invalid stock value", variant: "destructive" });
        return;
      }
      value = stock;
    } else if (quickEditField === "name" && !quickEditValue.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }

    quickEditMutation.mutate({ 
      id: productId, 
      updates: { [quickEditField]: value } 
    });
  };

  const startQuickEdit = (product: Product, field: "name" | "price" | "totalStock") => {
    setQuickEditId(product.id);
    setQuickEditField(field);
    setQuickEditValue(field === "name" ? product.name : 
                     field === "price" ? product.price : 
                     String(product.totalStock));
  };

  const cancelQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditField(null);
    setQuickEditValue("");
  };

  const exportInventoryCSV = () => {
    const csvData = products.map(p => ({
      SKU: p.sku,
      Name: p.name,
      Description: p.description || "",
      Color: p.color || "",
      Size: p.size || "",
      Barcode: p.barcode || "",
      Price: p.price,
      Cost: p.cost || "",
      "Total Stock": p.totalStock,
      "Reserved Stock": p.reservedStock,
      "Available Stock": p.totalStock - p.reservedStock,
      "Low Stock Threshold": p.lowStockThreshold,
    }));
    
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => headers.map(h => {
        const val = String(row[h as keyof typeof row] || "");
        return val.includes(",") ? `"${val}"` : val;
      }).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: "CSV exported successfully" });
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

    const availableStock = product.totalStock - product.reservedStock;
    const isLowStock = availableStock < (product.lowStockThreshold || 10);
    const isOutOfStock = availableStock <= 0;

    const matchesFilter =
      stockFilter === "all" ||
      (stockFilter === "low" && isLowStock && !isOutOfStock) ||
      (stockFilter === "out" && isOutOfStock) ||
      (stockFilter === "available" && !isLowStock);

    return matchesSearch && matchesFilter;
  });

  const lowStockCount = products.filter((p) => {
    const available = p.totalStock - p.reservedStock;
    return available > 0 && available < (p.lowStockThreshold || 10);
  }).length;

  const outOfStockCount = products.filter(
    (p) => p.totalStock - p.reservedStock <= 0
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-inventory-title">
            Inventory Management
          </h1>
          <p className="text-muted-foreground">
            Manage your products and stock levels
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
            data-testid="input-import-file"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                data-testid="button-export-inventory"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport} data-testid="menu-export-excel">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportInventoryCSV} data-testid="menu-export-csv">
                <FileText className="w-4 h-4 mr-2" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-import-inventory"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <AddProductDialog onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Products</DialogTitle>
                <DialogDescription>
                  Review the data below before importing
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{importData.length} rows found</span>
                </div>
                <div className="max-h-60 overflow-auto border rounded-md p-3">
                  <pre className="text-xs">
                    {JSON.stringify(importData.slice(0, 5), null, 2)}
                    {importData.length > 5 && "\n...and more"}
                  </pre>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => importMutation.mutate(importData)}
                    disabled={importMutation.isPending}
                    data-testid="button-confirm-import"
                  >
                    {importMutation.isPending ? "Importing..." : "Import"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingProduct(null);
          }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>
                  Update the product details below
                </DialogDescription>
              </DialogHeader>
              {editingProduct && (
                <EditProductDialog
                  product={editingProduct}
                  onClose={() => {
                    setEditDialogOpen(false);
                    setEditingProduct(null);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer ${
            stockFilter === "low" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer ${
            stockFilter === "out" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => setStockFilter(stockFilter === "out" ? "all" : "out")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-products"
          />
        </div>
        <BarcodeScannerButton onScan={handleBarcodeScan} testId="button-inventory-scanner" />
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-stock-filter">
            <SelectValue placeholder="All Stock Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock Levels</SelectItem>
            <SelectItem value="available">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "card" ? "default" : "ghost"}
            size="icon"
            onClick={() => setViewMode("card")}
            data-testid="button-view-card"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="icon"
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
        {viewMode === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-column-settings">
                <Settings2 className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ALL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={visibleColumns.has(col)}
                  onCheckedChange={() => toggleColumn(col)}
                  data-testid={`checkbox-column-${col}`}
                >
                  {COLUMN_LABELS[col]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-8 bg-muted rounded" />
                    <div className="h-8 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No products found</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery || stockFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by adding your first product"}
            </p>
            {!searchQuery && stockFilter === "all" && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onEdit={handleEditProduct} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {visibleColumns.has("sku") && <th className="text-left p-3 font-medium text-sm">SKU</th>}
                    {visibleColumns.has("name") && <th className="text-left p-3 font-medium text-sm">Name</th>}
                    {visibleColumns.has("variant") && <th className="text-left p-3 font-medium text-sm">Variant</th>}
                    {visibleColumns.has("price") && <th className="text-right p-3 font-medium text-sm">Price</th>}
                    {visibleColumns.has("available") && <th className="text-right p-3 font-medium text-sm">Available</th>}
                    {visibleColumns.has("reserved") && <th className="text-right p-3 font-medium text-sm">Reserved</th>}
                    {visibleColumns.has("status") && <th className="text-center p-3 font-medium text-sm">Status</th>}
                    {visibleColumns.has("actions") && <th className="text-center p-3 font-medium text-sm">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const availableStock = product.totalStock - product.reservedStock;
                    const isLowStock = availableStock < (product.lowStockThreshold || 10);
                    const isOutOfStock = availableStock <= 0;
                    return (
                      <tr
                        key={product.id}
                        className="border-b last:border-0 hover-elevate"
                        data-testid={`row-product-${product.id}`}
                      >
                        {visibleColumns.has("sku") && (
                          <td className="p-3 font-mono text-sm">{product.sku}</td>
                        )}
                        {visibleColumns.has("name") && (
                          <td className="p-3">
                            {quickEditId === product.id && quickEditField === "name" ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={quickEditValue}
                                  onChange={(e) => setQuickEditValue(e.target.value)}
                                  className="h-8 min-w-[200px]"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleQuickEditSave(product.id);
                                    if (e.key === "Escape") cancelQuickEdit();
                                  }}
                                  data-testid={`input-quick-name-${product.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleQuickEditSave(product.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  onClick={cancelQuickEdit}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center group gap-2">
                                <span className="font-medium">{product.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startQuickEdit(product, "name")}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.has("variant") && (
                          <td className="p-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {product.color && (
                                <Badge variant="outline" className="text-xs">
                                  {product.color}
                                </Badge>
                              )}
                              {product.size && (
                                <Badge variant="outline" className="text-xs">
                                  {product.size}
                                </Badge>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.has("price") && (
                          <td className="p-3 text-right">
                            {quickEditId === product.id && quickEditField === "price" ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  value={quickEditValue}
                                  onChange={(e) => setQuickEditValue(e.target.value)}
                                  className="w-24 h-8 text-right"
                                  step="0.01"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleQuickEditSave(product.id);
                                    if (e.key === "Escape") cancelQuickEdit();
                                  }}
                                  data-testid={`input-quick-price-${product.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleQuickEditSave(product.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  onClick={cancelQuickEdit}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end group gap-2">
                                <span>PHP {Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startQuickEdit(product, "price")}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.has("available") && (
                          <td className="p-3 text-right">
                            {quickEditId === product.id && quickEditField === "totalStock" ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  value={quickEditValue}
                                  onChange={(e) => setQuickEditValue(e.target.value)}
                                  className="w-20 h-8 text-right"
                                  min="0"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleQuickEditSave(product.id);
                                    if (e.key === "Escape") cancelQuickEdit();
                                  }}
                                  data-testid={`input-quick-stock-${product.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleQuickEditSave(product.id)}
                                  disabled={quickEditMutation.isPending}
                                  data-testid={`button-save-stock-${product.id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  onClick={cancelQuickEdit}
                                  data-testid={`button-cancel-stock-${product.id}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end group gap-2">
                                <span
                                  className={`font-medium ${
                                    isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : ""
                                  }`}
                                  data-testid={`text-stock-${product.id}`}
                                >
                                  {availableStock}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startQuickEdit(product, "totalStock")}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.has("reserved") && (
                          <td className="p-3 text-right text-muted-foreground">
                            {product.reservedStock}
                          </td>
                        )}
                        {visibleColumns.has("status") && (
                          <td className="p-3 text-center">
                            {isOutOfStock ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : isLowStock ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                In Stock
                              </Badge>
                            )}
                          </td>
                        )}
                        {visibleColumns.has("actions") && (
                          <td className="p-3 text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditProduct(product)}
                              data-testid={`button-edit-table-${product.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
