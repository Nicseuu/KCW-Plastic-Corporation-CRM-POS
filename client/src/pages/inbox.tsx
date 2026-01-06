import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Check,
  CheckCheck,
  Loader2,
  Phone,
  Mail,
  User,
  ShoppingCart,
  ExternalLink,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Customer, Message } from "@shared/schema";
import { Link } from "wouter";

interface ConversationWithCustomer extends Conversation {
  customer?: Customer;
  messages?: Message[];
}

interface ConversationDetails extends Conversation {
  customer?: Customer;
  messages: Message[];
  participants: Array<{
    id: string;
    externalUserId: string;
    displayName: string | null;
    phoneNumber: string | null;
    profilePicUrl: string | null;
  }>;
}

function getChannelIcon(channel: string | null) {
  switch (channel) {
    case "facebook_messenger":
      return <SiFacebook className="w-3 h-3" />;
    case "whatsapp":
      return <SiWhatsapp className="w-3 h-3" />;
    default:
      return <MessageSquare className="w-3 h-3" />;
  }
}

function getChannelColor(channel: string | null) {
  switch (channel) {
    case "facebook_messenger":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "whatsapp":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getPlatformColor(platform: string) {
  switch (platform) {
    case "Facebook Messenger":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "WhatsApp":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "TikTok Shop":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400";
    case "Shopee":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Lazada":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function MessageStatusIcon({ status, direction }: { status: string | null; direction: string | null }) {
  if (direction !== "outbound") return null;
  
  switch (status) {
    case "pending":
      return <Loader2 className="w-3 h-3 animate-spin opacity-60" />;
    case "sent":
      return <Check className="w-3 h-3 opacity-60" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 opacity-60" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    case "failed":
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Check className="w-3 h-3 opacity-60" />;
  }
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationWithCustomer;
  isActive: boolean;
  onClick: () => void;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "New":
        return <AlertCircle className="w-3 h-3 text-blue-500" />;
      case "Waiting":
        return <Clock className="w-3 h-3 text-amber-500" />;
      case "Closed":
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      default:
        return null;
    }
  };

  const isUnread = conversation.status === "New" || 
    (conversation.lastDirection === "inbound" && conversation.status !== "Closed");

  return (
    <div
      className={`p-3 cursor-pointer border-b transition-colors hover-elevate ${
        isActive ? "bg-primary/10" : ""
      }`}
      onClick={onClick}
      data-testid={`conversation-${conversation.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary">
              {conversation.customer?.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full ${getChannelColor(conversation.channel)}`}>
            {getChannelIcon(conversation.channel)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
              {conversation.customer?.name || "Unknown Customer"}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {getStatusIcon(conversation.status)}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {conversation.lastDirection === "outbound" && (
              <Check className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
            <p className={`text-xs truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
              {conversation.lastMessage || "No messages yet"}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="secondary"
              className={`text-xs ${getPlatformColor(conversation.platform)}`}
            >
              {conversation.platform}
            </Badge>
            {conversation.lastMessageAt && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(new Date(conversation.lastMessageAt))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function ChatMessages({ 
  messages, 
  isLoading 
}: { 
  messages: Message[]; 
  isLoading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No messages in this conversation</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isOutbound = message.direction === "outbound" || message.sender === "agent";
            return (
              <div
                key={message.id}
                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isOutbound
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
                    <span className="text-xs opacity-70">
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ""}
                    </span>
                    <MessageStatusIcon status={message.status} direction={message.direction} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}

function CustomerDetails({ 
  customer, 
  conversation 
}: { 
  customer?: Customer;
  conversation?: ConversationDetails;
}) {
  if (!customer && !conversation) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select a conversation to view customer details</p>
      </div>
    );
  }

  const displayCustomer = customer || conversation?.customer;

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <Avatar className="h-16 w-16 mx-auto">
          <AvatarFallback className="bg-primary/10 text-primary text-xl">
            {displayCustomer?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold mt-2">{displayCustomer?.name || "Unknown"}</h3>
        {displayCustomer?.crn && (
          <p className="text-xs font-mono text-muted-foreground">{displayCustomer.crn}</p>
        )}
      </div>

      <div className="space-y-2">
        {displayCustomer?.stage && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Stage</span>
            <Badge variant="secondary">{displayCustomer.stage}</Badge>
          </div>
        )}
        {displayCustomer?.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{displayCustomer.email}</span>
          </div>
        )}
        {displayCustomer?.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span>{displayCustomer.phone}</span>
          </div>
        )}
        {displayCustomer?.platform && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Platform</span>
            <Badge variant="secondary" className={getPlatformColor(displayCustomer.platform)}>
              {displayCustomer.platform}
            </Badge>
          </div>
        )}
      </div>

      {conversation?.channel && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">Channel</p>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${getChannelColor(conversation.channel)}`}>
            {getChannelIcon(conversation.channel)}
            <span className="text-xs font-medium capitalize">
              {conversation.channel.replace("_", " ")}
            </span>
          </div>
        </div>
      )}

      <div className="pt-4 border-t space-y-2">
        {displayCustomer?.id && (
          <Link href={`/crm/${displayCustomer.id}`}>
            <Button variant="outline" className="w-full" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Full Profile
            </Button>
          </Link>
        )}
        <Button variant="outline" className="w-full" size="sm">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Create Order
        </Button>
      </div>
    </div>
  );
}

export default function Inbox() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "New" | "Waiting">("all");
  const { toast } = useToast();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationWithCustomer[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: conversationDetails, isLoading: detailsLoading } = useQuery<ConversationDetails>({
    queryKey: ["/api/conversations", selectedConversationId, "details"],
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/send`, { message });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversationId, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "NEW_MESSAGE" || data.type === "CONVERSATION_UPDATE") {
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          
          if (data.payload?.conversationId === selectedConversationId) {
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversationId, "details"] });
          }
        }
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedConversationId]);

  const conversationsWithCustomers = conversations.map((conv) => ({
    ...conv,
    customer: customers.find((c) => c.id === conv.customerId),
  }));

  const filteredConversations = conversationsWithCustomers.filter((conv) => {
    const matchesSearch = conv.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || conv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;
    
    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      message: messageInput.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedConversation = conversationsWithCustomers.find(c => c.id === selectedConversationId);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold mb-3" data-testid="text-inbox-title">
            Inbox
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        <div className="flex gap-2 p-3 border-b flex-wrap">
          <Badge 
            variant={statusFilter === "all" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setStatusFilter("all")}
            data-testid="filter-all"
          >
            All ({conversations.length})
          </Badge>
          <Badge 
            variant={statusFilter === "New" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setStatusFilter("New")}
            data-testid="filter-new"
          >
            New ({conversations.filter(c => c.status === "New").length})
          </Badge>
          <Badge 
            variant={statusFilter === "Waiting" ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setStatusFilter("Waiting")}
            data-testid="filter-waiting"
          >
            Waiting ({conversations.filter(c => c.status === "Waiting").length})
          </Badge>
        </div>

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations found</p>
              {searchQuery && (
                <p className="text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={selectedConversationId === conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedConversation.customer?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full ${getChannelColor(selectedConversation.channel)}`}>
                    {getChannelIcon(selectedConversation.channel)}
                  </div>
                </div>
                <div>
                  <h2 className="font-semibold">
                    {selectedConversation.customer?.name || "Unknown Customer"}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {selectedConversation.platform}
                    {selectedConversation.channel && (
                      <>
                        <span className="mx-1">via</span>
                        <span className="capitalize">{selectedConversation.channel.replace("_", " ")}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Badge
                variant={selectedConversation.status === "New" ? "default" : "secondary"}
              >
                {selectedConversation.status}
              </Badge>
            </div>

            <ChatMessages 
              messages={conversationDetails?.messages || []} 
              isLoading={detailsLoading}
            />

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1 min-h-[40px] max-h-32 resize-none"
                  rows={1}
                  data-testid="input-message"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Select a conversation</h3>
              <p className="text-sm">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="w-72 border-l bg-card hidden lg:block">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Customer Details</h3>
        </div>
        <CustomerDetails 
          customer={selectedConversation?.customer} 
          conversation={conversationDetails}
        />
      </div>
    </div>
  );
}
