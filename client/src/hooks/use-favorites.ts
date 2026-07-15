import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Favorite {
  id: number;
  user_id: string;
  entity_type: "report" | "customer" | "job";
  entity_id: string;
  created_at: string;
}

const FAV_KEY = ["/api/favorites"] as const;

export function useFavorites(entityType?: "report" | "customer" | "job") {
  const qc = useQueryClient();

  const { data: allFavorites = [] } = useQuery<Favorite[]>({
    queryKey: FAV_KEY,
  });

  const filtered = entityType
    ? allFavorites.filter((f) => f.entity_type === entityType)
    : allFavorites;

  const addMut = useMutation({
    mutationFn: async (vars: { entity_type: string; entity_id: string }) => {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FAV_KEY }),
  });

  const removeMut = useMutation({
    mutationFn: async (vars: { entity_type: string; entity_id: string }) => {
      const res = await fetch(
        `/api/favorites/by-entity?entity_type=${vars.entity_type}&entity_id=${encodeURIComponent(vars.entity_id)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FAV_KEY }),
  });

  function isFavorited(type: string, id: string): boolean {
    return allFavorites.some((f) => f.entity_type === type && f.entity_id === id);
  }

  function toggleFavorite(type: "report" | "customer" | "job", id: string) {
    if (isFavorited(type, id)) {
      removeMut.mutate({ entity_type: type, entity_id: id });
    } else {
      addMut.mutate({ entity_type: type, entity_id: id });
    }
  }

  function favoritedIds(type: string): Set<string> {
    return new Set(allFavorites.filter((f) => f.entity_type === type).map((f) => f.entity_id));
  }

  return { favorites: filtered, allFavorites, isFavorited, toggleFavorite, favoritedIds };
}
