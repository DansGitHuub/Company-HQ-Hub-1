import React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Users,
  FileText,
  Star,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface CustomerPhone {
  id: string;
  phone: string;
  phone_type: string | null;
  is_primary: boolean;
}

interface CustomerEmail {
  id: string;
  email: string;
  email_type: string | null;
  is_primary: boolean;
}

interface CustomerContact {
  id: string;
  first_name: string;
  last_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface Property {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  notes: string | null;
}

interface CustomerDetail {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  phones: CustomerPhone[];
  emails: CustomerEmail[];
  contacts: CustomerContact[];
  properties: Property[];
}

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function addressLine(city: string | null, state: string | null, zip: string | null) {
  return [city, state, zip].filter(Boolean).join(", ");
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: customer, isLoading, isError } = useQuery<CustomerDetail>({
    queryKey: ["/api/customers", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${id}`);
      if (!res.ok) throw new Error("Customer not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading customer…
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Customers
        </Button>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const fullName = `${customer.first_name} ${customer.last_name}`;
  const billingFull = [
    customer.billing_address,
    addressLine(customer.billing_city, customer.billing_state, customer.billing_zip),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/customers")}
        data-testid="button-back-customers"
        className="-ml-2"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Customers
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-lg font-bold shrink-0 dark:bg-green-900/30 dark:text-green-400">
          {getInitials(customer.first_name, customer.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customer-name">
            {fullName}
          </h1>
          {customer.company_name && (
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-0.5">
              <Building2 className="h-3.5 w-3.5" />
              {customer.company_name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {customer.source && (
              <Badge variant="secondary" data-testid="badge-source">
                {customer.source}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Added {format(new Date(customer.created_at), "MMMM d, yyyy")}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Body — two columns on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — spans 2 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.phones.length === 0 && customer.emails.length === 0 && (
                <p className="text-sm text-muted-foreground">No contact information recorded.</p>
              )}

              {customer.phones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Phone Numbers
                  </p>
                  {customer.phones.map((p) => (
                    <div key={p.id} className="flex items-center gap-2" data-testid={`phone-${p.id}`}>
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${p.phone}`}
                        className="text-sm hover:underline"
                      >
                        {p.phone}
                      </a>
                      {p.phone_type && (
                        <span className="text-xs text-muted-foreground">({p.phone_type})</span>
                      )}
                      {p.is_primary && (
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          <Star className="h-2.5 w-2.5 mr-1 fill-yellow-400 text-yellow-400" />
                          Primary
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {customer.phones.length > 0 && customer.emails.length > 0 && (
                <Separator />
              )}

              {customer.emails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email Addresses
                  </p>
                  {customer.emails.map((e) => (
                    <div key={e.id} className="flex items-center gap-2" data-testid={`email-${e.id}`}>
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`mailto:${e.email}`}
                        className="text-sm hover:underline"
                      >
                        {e.email}
                      </a>
                      {e.email_type && (
                        <span className="text-xs text-muted-foreground">({e.email_type})</span>
                      )}
                      {e.is_primary && (
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          <Star className="h-2.5 w-2.5 mr-1 fill-yellow-400 text-yellow-400" />
                          Primary
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billingFull ? (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {billingFull}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No billing address recorded.</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.notes ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {customer.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Properties */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Properties
                {customer.properties.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {customer.properties.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties recorded.</p>
              ) : (
                customer.properties.map((prop, i) => (
                  <div
                    key={prop.id}
                    data-testid={`property-${prop.id}`}
                    className={i > 0 ? "pt-3 border-t" : ""}
                  >
                    <p className="text-sm font-medium">
                      {prop.address}
                    </p>
                    {(prop.city || prop.state || prop.zip) && (
                      <p className="text-xs text-muted-foreground">
                        {addressLine(prop.city, prop.state, prop.zip)}
                      </p>
                    )}
                    {prop.property_type && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {prop.property_type}
                      </Badge>
                    )}
                    {prop.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{prop.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Additional Contacts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Contacts
                {customer.contacts.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {customer.contacts.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No additional contacts.</p>
              ) : (
                customer.contacts.map((contact, i) => (
                  <div
                    key={contact.id}
                    data-testid={`contact-${contact.id}`}
                    className={i > 0 ? "pt-3 border-t" : ""}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {contact.first_name}{contact.last_name ? ` ${contact.last_name}` : ""}
                        </p>
                        {contact.role && (
                          <p className="text-xs text-muted-foreground">{contact.role}</p>
                        )}
                      </div>
                    </div>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{contact.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
