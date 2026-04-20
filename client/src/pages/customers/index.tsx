import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Users, Pencil } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

export default function CustomerList() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [, setLocation] = useLocation();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/customers");
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
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} customer{customers.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 text-white"
          onClick={openAdd} data-testid="button-add-customer">
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9" data-testid="input-search-customers" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No customers yet. Add your first customer.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              No customers match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date Added</TableHead>
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
                        data-testid={`button-edit-customer-${customer.id}`} title="Edit customer">
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
