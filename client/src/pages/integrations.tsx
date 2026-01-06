import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ShoppingBag,
  ExternalLink,
  AlertCircle,
  Loader2,
  Settings,
  MessageSquare,
  Link as LinkIcon,
} from "lucide-react";
import { SiTiktok, SiShopee, SiFacebook, SiWhatsapp } from "react-icons/si";

interface PlatformIntegration {
  id: string;
  platform: string;
  shopId: string | null;
  isActive: boolean;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MetaIntegrationStatus {
  messenger: {
    configured: boolean;
    pageId: string | null;
  };
  whatsapp: {
    configured: boolean;
    phoneNumberId: string | null;
  };
  webhookVerifyToken: boolean;
  appSecretConfigured: boolean;
}

interface SyncLog {
  id: string;
  platform: string;
  syncType: string;
  status: string;
  recordsSynced: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

const platformIcons: Record<string, typeof SiTiktok | typeof ShoppingBag> = {
  "TikTok Shop": SiTiktok,
  "Shopee": SiShopee,
  "Lazada": ShoppingBag,
};

const platformColors: Record<string, string> = {
  "TikTok Shop": "bg-black text-white",
  "Shopee": "bg-orange-500 text-white",
  "Lazada": "bg-purple-600 text-white",
};

interface EcommercePlatformStatus {
  configured: boolean;
  sandbox: boolean;
  hasCredentials: boolean;
  hasTokens: boolean;
  shopId: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
}

interface EcommerceStatus {
  shopee: EcommercePlatformStatus;
  lazada: EcommercePlatformStatus;
  tiktok: EcommercePlatformStatus;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [shopIdInput, setShopIdInput] = useState("");
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const { data: integrations = [], isLoading } = useQuery<PlatformIntegration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: metaStatus } = useQuery<MetaIntegrationStatus>({
    queryKey: ["/api/integrations/meta/status"],
  });

  const { data: ecommerceStatus } = useQuery<EcommerceStatus>({
    queryKey: ["/api/integrations/ecommerce/status"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ platform, updates }: { platform: string; updates: Partial<PlatformIntegration> }) => {
      const res = await apiRequest("PATCH", `/api/integrations/${encodeURIComponent(platform)}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setEditingPlatform(null);
      toast({ title: "Integration updated" });
    },
    onError: (error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (platform: string) => {
      const platformPath = platform === "TikTok Shop" ? "tiktok" : platform.toLowerCase();
      const res = await apiRequest("POST", `/api/integrations/${platformPath}/sync`, { syncType: "all" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Sync completed", description: `${data.ordersCount || 0} orders synced` });
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync failed", 
        description: error.message || "Please configure API credentials first",
        variant: "destructive" 
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const platformPath = platform === "TikTok Shop" ? "tiktok" : platform.toLowerCase();
      const res = await apiRequest("GET", `/api/integrations/${platformPath}/auth-url`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      setConnectingPlatform(null);
      toast({ 
        title: "Connection failed", 
        description: error.message || "Failed to start OAuth flow",
        variant: "destructive" 
      });
    },
  });

  const handleToggleActive = (platform: string, isActive: boolean) => {
    updateMutation.mutate({ platform, updates: { isActive } });
  };

  const handleSaveShopId = (platform: string) => {
    updateMutation.mutate({ platform, updates: { shopId: shopIdInput } });
  };

  const handleSync = (platform: string) => {
    syncMutation.mutate(platform);
  };

  const handleConnect = (platform: string) => {
    setConnectingPlatform(platform);
    connectMutation.mutate(platform);
  };

  const getPlatformStatus = (platform: string): EcommercePlatformStatus | null => {
    if (!ecommerceStatus) return null;
    switch (platform) {
      case "Shopee": return ecommerceStatus.shopee;
      case "Lazada": return ecommerceStatus.lazada;
      case "TikTok Shop": return ecommerceStatus.tiktok;
      default: return null;
    }
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return "Never synced";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Integrations</h1>
        <p className="text-muted-foreground">
          Connect your e-commerce and messaging platforms to manage orders, products, and customer conversations.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messaging Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect messaging platforms for unified customer inbox and real-time chat.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card data-testid="card-integration-facebook-messenger">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <SiFacebook className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Facebook Messenger</CardTitle>
                    <CardDescription className="text-xs">
                      {metaStatus?.messenger.configured ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <XCircle className="h-3 w-3" /> Not configured
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                {metaStatus?.messenger.configured && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Page ID:</span>
                  <span className="font-mono text-xs">
                    {metaStatus?.messenger.pageId || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">App Secret:</span>
                  <span className="text-xs">
                    {metaStatus?.appSecretConfigured ? (
                      <span className="text-green-600">Configured</span>
                    ) : (
                      <span className="text-amber-600">Missing</span>
                    )}
                  </span>
                </div>
              </div>

              {!metaStatus?.messenger.configured && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Required secrets:</p>
                  <ul className="text-xs space-y-1">
                    <li><code className="bg-muted px-1 rounded">META_PAGE_ACCESS_TOKEN</code></li>
                    <li><code className="bg-muted px-1 rounded">META_PAGE_ID</code></li>
                    <li><code className="bg-muted px-1 rounded">META_APP_SECRET</code></li>
                    <li><code className="bg-muted px-1 rounded">META_VERIFY_TOKEN</code></li>
                  </ul>
                </div>
              )}

              {metaStatus?.messenger.configured && (
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Webhook Status:</span>
                    {metaStatus?.webhookVerifyToken && metaStatus?.appSecretConfigured ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                      {window.location.origin}/webhooks/meta
                    </code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-integration-whatsapp">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500 text-white">
                    <SiWhatsapp className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">WhatsApp Business</CardTitle>
                    <CardDescription className="text-xs">
                      {metaStatus?.whatsapp.configured ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <XCircle className="h-3 w-3" /> Not configured
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                {metaStatus?.whatsapp.configured && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone Number ID:</span>
                  <span className="font-mono text-xs">
                    {metaStatus?.whatsapp.phoneNumberId || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Verify Token:</span>
                  <span className="text-xs">
                    {metaStatus?.webhookVerifyToken ? (
                      <span className="text-green-600">Configured</span>
                    ) : (
                      <span className="text-amber-600">Missing</span>
                    )}
                  </span>
                </div>
              </div>

              {!metaStatus?.whatsapp.configured && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Required secrets:</p>
                  <ul className="text-xs space-y-1">
                    <li><code className="bg-muted px-1 rounded">META_WHATSAPP_ACCESS_TOKEN</code></li>
                    <li><code className="bg-muted px-1 rounded">META_WHATSAPP_PHONE_NUMBER_ID</code></li>
                    <li><code className="bg-muted px-1 rounded">META_VERIFY_TOKEN</code></li>
                  </ul>
                </div>
              )}

              {metaStatus?.whatsapp.configured && (
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Webhook Status:</span>
                    {metaStatus?.webhookVerifyToken && metaStatus?.appSecretConfigured ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                      {window.location.origin}/webhooks/meta
                    </code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {(metaStatus?.messenger.configured || metaStatus?.whatsapp.configured) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Meta Webhook Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Callback URL</Label>
                  <code className="text-sm bg-muted px-2 py-1 rounded block mt-1 truncate">
                    {window.location.origin}/webhooks/meta
                  </code>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Verify Token</Label>
                  <p className="text-sm mt-1">
                    Use the value from your <code className="bg-muted px-1 rounded">META_VERIFY_TOKEN</code> secret
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this webhook URL in your Meta App Dashboard under Webhooks settings.
                Subscribe to <code className="bg-muted px-1 rounded">messages</code> and{" "}
                <code className="bg-muted px-1 rounded">messaging_postbacks</code> events.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            E-commerce Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect your e-commerce platforms to sync orders, products, and customers automatically.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>To connect a platform, you need to:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Create a developer account on the platform</li>
              <li>Register your application and get API credentials</li>
              <li>Add the credentials to your Secrets (in the Replit sidebar)</li>
            </ol>
            <p className="mt-3 font-medium text-foreground">Required secrets for each platform:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><code className="bg-muted px-1 rounded">TIKTOK_SHOP_APP_ID</code> and <code className="bg-muted px-1 rounded">TIKTOK_SHOP_APP_SECRET</code></li>
              <li><code className="bg-muted px-1 rounded">SHOPEE_APP_ID</code> and <code className="bg-muted px-1 rounded">SHOPEE_APP_SECRET</code></li>
              <li><code className="bg-muted px-1 rounded">LAZADA_APP_ID</code> and <code className="bg-muted px-1 rounded">LAZADA_APP_SECRET</code></li>
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const Icon = platformIcons[integration.platform] || ShoppingBag;
            const colorClass = platformColors[integration.platform] || "bg-gray-500 text-white";
            const isEditing = editingPlatform === integration.platform;

            return (
              <Card key={integration.id} data-testid={`card-integration-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.platform}</CardTitle>
                        <CardDescription className="text-xs">
                          {integration.hasCredentials ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> Credentials configured
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600">
                              <XCircle className="h-3 w-3" /> No credentials
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={integration.isActive}
                      onCheckedChange={(checked) => handleToggleActive(integration.platform, checked)}
                      disabled={!integration.hasCredentials}
                      data-testid={`switch-${integration.platform.toLowerCase().replace(/\s+/g, '-')}-active`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label htmlFor={`shop-id-${integration.id}`}>Shop ID</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`shop-id-${integration.id}`}
                          value={shopIdInput}
                          onChange={(e) => setShopIdInput(e.target.value)}
                          placeholder="Enter shop ID"
                          data-testid={`input-shop-id-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveShopId(integration.platform)}
                          disabled={updateMutation.isPending}
                          data-testid={`button-save-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPlatform(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Shop ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{integration.shopId || "Not set"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingPlatform(integration.platform);
                            setShopIdInput(integration.shopId || "");
                          }}
                          data-testid={`button-edit-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const status = getPlatformStatus(integration.platform);
                    const lastSync = status?.lastSyncAt || integration.lastSyncAt;
                    return (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          {status?.hasTokens ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : status?.hasCredentials ? (
                            <Badge variant="outline">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Not Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Configured
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last sync:</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatLastSync(lastSync)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    {(() => {
                      const status = getPlatformStatus(integration.platform);
                      if (status?.hasCredentials && !status?.hasTokens) {
                        return (
                          <Button
                            className="flex-1"
                            onClick={() => handleConnect(integration.platform)}
                            disabled={connectingPlatform === integration.platform}
                            data-testid={`button-connect-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {connectingPlatform === integration.platform ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <ExternalLink className="h-4 w-4 mr-2" />
                            )}
                            Connect Account
                          </Button>
                        );
                      }
                      return (
                        <Button
                          className="flex-1"
                          variant="outline"
                          disabled={!status?.hasTokens || !integration.isActive || syncMutation.isPending}
                          onClick={() => handleSync(integration.platform)}
                          data-testid={`button-sync-${integration.platform.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {syncMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sync Now
                        </Button>
                      );
                    })()}
                  </div>

                  {(() => {
                    const status = getPlatformStatus(integration.platform);
                    if (!status?.hasCredentials) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          Add API credentials in your Secrets to enable connection.
                        </p>
                      );
                    }
                    if (status?.hasCredentials && !status?.hasTokens) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          Click "Connect Account" to authorize access to your {integration.platform} store.
                        </p>
                      );
                    }
                    if (status?.sandbox) {
                      return (
                        <Badge variant="outline" className="text-xs">
                          Sandbox Mode
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                  {integration.hasCredentials && (
                    <div className="pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full gap-2"
                        onClick={() => handleConnect(integration.platform)}
                        disabled={connectingPlatform === integration.platform}
                      >
                        {connectingPlatform === integration.platform ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        Connect Account
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <SyncLogsSection />
    </div>
  );
}

function SyncLogsSection() {
  const { data: logs = [], isLoading } = useQuery<SyncLog[]>({
    queryKey: ["/api/integrations/all/logs"],
    queryFn: async () => {
      const allLogs: SyncLog[] = [];
      
      try {
        const res = await apiRequest("GET", "/api/integrations/TikTok%20Shop/logs");
        const tiktokLogs = await res.json();
        allLogs.push(...tiktokLogs);
      } catch {}
      
      try {
        const res2 = await apiRequest("GET", "/api/integrations/Shopee/logs");
        const shopeeLogs = await res2.json();
        allLogs.push(...shopeeLogs);
      } catch {}
      
      try {
        const res3 = await apiRequest("GET", "/api/integrations/Lazada/logs");
        const lazadaLogs = await res3.json();
        allLogs.push(...lazadaLogs);
      } catch {}
      
      return allLogs
        .sort((a: SyncLog, b: SyncLog) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20);
    },
  });

  if (isLoading || logs.length === 0) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sync Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-medium">{log.platform}</span>
                  <span className="text-muted-foreground text-sm ml-2">({log.syncType})</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {log.recordsSynced > 0 && (
                  <span className="text-sm text-muted-foreground">{log.recordsSynced} records</span>
                )}
                {getStatusBadge(log.status)}
                <span className="text-xs text-muted-foreground">
                  {new Date(log.startedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
