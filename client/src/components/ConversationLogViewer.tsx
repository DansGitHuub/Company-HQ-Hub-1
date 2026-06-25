import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Bot, User, Wrench, DollarSign, Loader2, ChevronDown, ChevronUp, Filter, ShieldAlert } from "lucide-react";

export default function ConversationLogViewer() {
  const [activeTab, setActiveTab] = useState<"sessions" | "blocked">("sessions");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [deniedUserFilter, setDeniedUserFilter] = useState("");
  const [deniedStartDate, setDeniedStartDate] = useState("");
  const [deniedEndDate, setDeniedEndDate] = useState("");
  const [showDeniedFilters, setShowDeniedFilters] = useState(false);

  const { data: usage, isLoading: usageLoading } = useQuery<any>({
    queryKey: ["/api/assistant/logs/usage"],
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/assistant/logs/sessions", userFilter, startDate, endDate, toolFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userFilter) params.set("userId", userFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (toolFilter) params.set("toolCalled", toolFilter);
      const res = await fetch(`/api/assistant/logs/sessions?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: sessionMessages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/assistant/logs/session", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      const res = await fetch(`/api/assistant/logs/session/${selectedSession}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedSession,
  });

  const { data: deniedLogs = [], isLoading: deniedLoading } = useQuery<any[]>({
    queryKey: ["/api/assistant/logs/denied", deniedUserFilter, deniedStartDate, deniedEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deniedUserFilter) params.set("userId", deniedUserFilter);
      if (deniedStartDate) params.set("startDate", deniedStartDate);
      if (deniedEndDate) params.set("endDate", deniedEndDate);
      const res = await fetch(`/api/assistant/logs/denied?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: activeTab === "blocked",
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      Admin: "bg-red-100 text-red-700",
      Manager: "bg-blue-100 text-blue-700",
      Crew: "bg-green-100 text-green-700",
      Customer: "bg-purple-100 text-purple-700",
      "Master Admin": "bg-red-100 text-red-800",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Usage Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-bold">{usage?.today?.messages || 0}</div>
                <p className="text-xs text-muted-foreground">Messages Today</p>
                <p className="text-xs text-green-600">${usage?.estimatedCost?.today || "0.00"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-bold">{usage?.week?.messages || 0}</div>
                <p className="text-xs text-muted-foreground">Messages This Week</p>
                <p className="text-xs text-green-600">${usage?.estimatedCost?.week || "0.00"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-bold">{usage?.month?.messages || 0}</div>
                <p className="text-xs text-muted-foreground">Messages This Month</p>
                <p className="text-xs text-green-600">${usage?.estimatedCost?.month || "0.00"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-bold text-amber-600">{usage?.deniedRequests30d || 0}</div>
                <p className="text-xs text-muted-foreground">Blocked Requests (30d)</p>
                <button
                  className="text-xs text-amber-600 hover:underline mt-0.5"
                  onClick={() => setActiveTab("blocked")}
                  data-testid="link-view-blocked"
                >
                  View →
                </button>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium">Top Tools</div>
                {usage?.topTools?.slice(0, 3).map((t: any) => (
                  <div key={t.tool_called} className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground truncate">{t.tool_called}</span>
                    <span className="font-medium">{t.count}</span>
                  </div>
                )) || <p className="text-xs text-muted-foreground">No tools used yet</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("sessions")}
          data-testid="tab-sessions"
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sessions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Conversation Sessions
        </button>
        <button
          onClick={() => setActiveTab("blocked")}
          data-testid="tab-blocked"
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "blocked"
              ? "border-destructive text-destructive"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Blocked Requests
          {(usage?.deniedRequests30d ?? 0) > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
              {usage.deniedRequests30d}
            </Badge>
          )}
        </button>
      </div>

      {/* ── Sessions tab ── */}
      {activeTab === "sessions" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> Conversation Sessions
                </CardTitle>
                <CardDescription>Browse all assistant conversations</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} data-testid="toggle-filters-btn">
                <Filter className="h-4 w-4 mr-1" /> Filters {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger data-testid="user-filter">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.filter((u: any) => u.role !== "Customer").map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start Date" data-testid="start-date-filter" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End Date" data-testid="end-date-filter" />
                <Input value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} placeholder="Tool name..." data-testid="tool-filter" />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No conversation sessions found</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session: any) => (
                  <div
                    key={session.session_id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${selectedSession === session.session_id ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => setSelectedSession(selectedSession === session.session_id ? null : session.session_id)}
                    data-testid={`session-${session.session_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{session.user_name || session.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{session.message_count} msgs</Badge>
                        <span className="text-xs text-muted-foreground">{formatTime(session.started_at)}</span>
                      </div>
                    </div>
                    {session.tools_used && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {session.tools_used.split(", ").map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    )}

                    {selectedSession === session.session_id && (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        {messagesLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          sessionMessages.map((msg: any, idx: number) => (
                            <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "" : ""}`}>
                              <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mt-0.5 ${msg.role === "user" ? "bg-primary/10" : "bg-muted"}`}>
                                {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium capitalize">{msg.role}</span>
                                  <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                                  {msg.tool_called && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Wrench className="h-3 w-3" /> {msg.tool_called}
                                    </Badge>
                                  )}
                                  {msg.tokens_used && (
                                    <span className="text-xs text-muted-foreground">{msg.tokens_used} tokens</span>
                                  )}
                                </div>
                                <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{msg.content}</p>
                                {msg.tool_result && (
                                  <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-x-auto max-h-24">
                                    {JSON.stringify(msg.tool_result, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Blocked Requests tab ── */}
      {activeTab === "blocked" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> Blocked Requests
                </CardTitle>
                <CardDescription>
                  Assistant requests blocked due to role or permission restrictions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDeniedFilters(!showDeniedFilters)} data-testid="toggle-denied-filters-btn">
                <Filter className="h-4 w-4 mr-1" /> Filters {showDeniedFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </div>
            {showDeniedFilters && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <Select value={deniedUserFilter} onValueChange={setDeniedUserFilter}>
                  <SelectTrigger data-testid="denied-user-filter">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={deniedStartDate} onChange={(e) => setDeniedStartDate(e.target.value)} placeholder="Start Date" data-testid="denied-start-date" />
                <Input type="date" value={deniedEndDate} onChange={(e) => setDeniedEndDate(e.target.value)} placeholder="End Date" data-testid="denied-end-date" />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {deniedLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : deniedLogs.length === 0 ? (
              <div className="text-center py-8">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No blocked requests found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Entries appear here when the AI assistant blocks a request due to role restrictions
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {deniedLogs.map((entry: any) => {
                  const toolResult = typeof entry.tool_result === "string"
                    ? (() => { try { return JSON.parse(entry.tool_result); } catch { return {}; } })()
                    : (entry.tool_result || {});
                  const reason = toolResult.reason || entry.tool_called ? `Blocked tool: ${entry.tool_called}` : "Access restricted";
                  const userRole = toolResult.user_role || entry.user_role || "Unknown";
                  return (
                    <div
                      key={entry.id}
                      className="border border-destructive/20 rounded-lg p-3 bg-destructive/5"
                      data-testid={`denied-entry-${entry.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {entry.user_name || entry.username || "Unknown user"}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getRoleBadgeColor(userRole)}`}>
                                {userRole}
                              </span>
                              {entry.tool_called && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Wrench className="h-3 w-3" /> {entry.tool_called}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm mt-1 break-words">
                              <span className="text-muted-foreground text-xs font-medium">Request: </span>
                              {entry.content || "—"}
                            </p>
                            <p className="text-xs text-destructive mt-0.5">
                              <span className="font-medium">Reason: </span>
                              {reason}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatTime(entry.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
