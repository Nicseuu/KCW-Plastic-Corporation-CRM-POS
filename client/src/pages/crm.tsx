import { useState, useRef } from "react";
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
  Filter,
  Download,
  Upload,
  User,
  Mail,
  Phone,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Customer } from "@shared/schema";
import { CUSTOMER_STAGES, PLATFORMS } from "@shared/schema";
import * as XLSX from "xlsx";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  stage: z.string(),
  platform: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

function CustomerCard({ customer }: { customer: Customer }) {
  const getStageColor = (stage: string) => {
    switch (stage) {
      case "VIP":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "Repeat":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Active":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-customer-${customer.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate" data-testid={`text-customer-name-${customer.id}`}>
                  {customer.name}
                </h3>
                <Badge
                  variant="secondary"
                  className={getStageColor(customer.stage)}
                >
                  {customer.stage}
                </Badge>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {customer.crn}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{customer.address}</span>
            </div>
          )}
        </div>

        {customer.platform && (
          <div className="mt-3 pt-3 border-t">
            <Badge variant="outline" className="text-xs">
              {customer.platform}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddCustomerDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      stage: "Lead",
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create customer", variant: "destructive" });
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => createCustomer.mutate(data))} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Customer name"
          data-testid="input-customer-name"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="email@example.com"
            data-testid="input-customer-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            {...register("phone")}
            placeholder="+63 XXX XXX XXXX"
            data-testid="input-customer-phone"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          {...register("address")}
          placeholder="Full address"
          data-testid="input-customer-address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Stage</Label>
          <Select
            defaultValue="Lead"
            onValueChange={(value) => setValue("stage", value)}
          >
            <SelectTrigger data-testid="select-customer-stage">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select onValueChange={(value) => setValue("platform", value)}>
            <SelectTrigger data-testid="select-customer-platform">
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Additional notes..."
          className="resize-none"
          data-testid="input-customer-notes"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createCustomer.isPending}
          data-testid="button-save-customer"
        >
          {createCustomer.isPending ? "Creating..." : "Create Customer"}
        </Button>
      </div>
    </form>
  );
}

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { token } = useAuth();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: "Customers exported to Excel" });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export customers", variant: "destructive" });
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
      const response = await apiRequest("POST", "/api/import/customers", { data });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Import complete",
        description: `${result.success} customers imported, ${result.failed} failed`,
      });
      setImportDialogOpen(false);
      setImportData([]);
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.crn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStage = stageFilter === "all" || customer.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

  const stageCounts = CUSTOMER_STAGES.reduce((acc, stage) => {
    acc[stage] = customers.filter((c) => c.stage === stage).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-crm-title">
            Customer Relationship Management
          </h1>
          <p className="text-muted-foreground">
            Manage your customers across all platforms
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export-customers"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-import-customers"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-customer">
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <AddCustomerDialog onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Customers</DialogTitle>
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
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CUSTOMER_STAGES.map((stage) => (
          <Card
            key={stage}
            className={`cursor-pointer ${
              stageFilter === stage ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setStageFilter(stageFilter === stage ? "all" : stage)}
            data-testid={`card-stage-${stage.toLowerCase()}`}
          >
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stage}</p>
              <p className="text-2xl font-bold">{stageCounts[stage] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, CRN, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-customers"
          />
        </div>
        <Button variant="outline" data-testid="button-filter-customers">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded mt-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-2/3 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No customers found</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery || stageFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by adding your first customer"}
            </p>
            {!searchQuery && stageFilter === "all" && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} />
          ))}
        </div>
      )}
    </div>
  );
}
