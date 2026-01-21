import React, { useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ShoppingCart } from "lucide-react";

export default function Materials() {
  const { materials } = useApp();
  const [search, setSearch] = useState("");

  const filtered = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Materials Catalog</h1>
          <p className="text-muted-foreground">Inventory, Pricing & Suppliers</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filter</Button>
            <Button><ShoppingCart className="w-4 h-4 mr-2"/> Order List</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search materials by name or SKU..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map(item => (
          <Card key={item.id} className="overflow-hidden group hover:shadow-lg transition-all">
            <div className="h-40 bg-secondary relative">
                {item.image && <img src={item.image} className="w-full h-full object-cover" alt={item.name}/>}
                {!item.image && (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/50 text-muted-foreground">
                        No Image
                    </div>
                )}
                <div className="absolute top-2 right-2">
                    <Badge variant={item.stock < 10 ? "destructive" : "secondary"}>
                        {item.stock} {item.unit}
                    </Badge>
                </div>
            </div>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                 <Badge variant="outline" className="mb-2">{item.category}</Badge>
                 <span className="text-xs font-mono text-muted-foreground">{item.sku}</span>
              </div>
              <CardTitle className="text-lg">{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                    <p className="text-xs text-muted-foreground">Unit Price</p>
                    <p className="text-xl font-bold text-primary">${item.price}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/20 p-3">
                <Button variant="ghost" size="sm" className="w-full">View Details</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
