import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Users, Pencil, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CustomerFormModal } from "./CustomerFormModal";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  source: string | null;
  is_active: boolean;
  created_at: string;
  primary_phone: string | null;
  primary_email: string | null;
}

type StatusFilter = "active" | "archived" | "all";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "active",   label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all",      label: "All" },
];

export default function CustomerList() {
  const { t } = useTranslation("customers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [, setLocation] = useLocation();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { status }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers?status=${status}`);
      return res.json();
    },
  });

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.company_name?.toLowerCase().includes(q) ?? false) ||
      (c.primary_phone?.includes(q) ?? false) ||
      (c.primary_email?.toLowerCase().includes(q) ?? false) ||
      (c.source?.toLowerCase().includes(q) ?? false)
    );
  });

  const openAdd = () => { setEditingCustomer(null); setShowForm(true); };
  const openEdit = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setShowForm(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} {t("customer")}{customers.length !== 1 ? "s" : ""} {status === "all" ? "total" : status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation("/customers/import")}
            data-testid="btn-import-customers">
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <Button variant="outline" onClick={() => setLocation("/properties/import")}
            data-testid="btn-import-properties">
            <Upload className="h-4 w-4 mr-2" /> Import Properties
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white"
            onClick={openAdd} data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-2" /> {t("addCustomer")}
          </Button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2" data-testid="filter-status-chips">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setStatus(chip.value)}
            data-testid={`chip-status-${chip.value}`}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
              status === chip.value
                ? "bg-green-700 text-white border-green-700"
                : "bg-white text-gray-600 border-gray-300 hover:border-green-600 hover:text-green-700 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("searchPlaceholder")} value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9" data-testid="input-search-customers" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {t("loading")}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {status === "archived" ? "No archived customers." : t("noCustomersYet")}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {t("noSearchResults")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("company")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("sourceColumn")}</TableHead>
                  <TableHead>{t("dateAdded")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-customer-${customer.id}`}
                    onClick={() => setLocation(`/customers/${customer.id}`)}>
                    <TableCell className="font-medium">
                      {customer.first_name} {customer.last_name}
                      {!customer.is_active && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          Archived
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.company_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.primary_phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.primary_email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.source || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(customer.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <button onClick={(e) => openEdit(e, customer)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-edit-customer-${customer.id}`} title={t("editCustomer")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editingCustomer}
      />
    </div>
  );
}
