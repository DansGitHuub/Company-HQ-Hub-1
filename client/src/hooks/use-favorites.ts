import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Favorite {
  id: number;
  user_id: string;
  entity_type: "report" | "customer" | "job";
  entity_id: string;
  created_at: string;
}

const ALL_KEY = ["/api/favorites", "all"] as const;

export function useFavorites(entityType?: "report" | "customer" | "job") {
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery<Favorite[]>({
    queryKey: ALL_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/favorites");
      return res.json();
    },
  });

  const filtered = entityType
    ? favorites.filter((f) => f.entity_type === entityType)
    : favorites;

  const addMut = useMutation({
    mutationFn: (vars: { entity_type: string; entity_id: string }) =>
      apiRequest("POST", "/api/favorites", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ALL_KEY }),
  });

  const removeMut = useMutation({
    mutationFn: (vars: { entity_type: string; entity_id: string }) =>
      apiRequest(
        "DELETE",
        `/api/favorites/by-entity?entity_type=${vars.entity_type}&entity_id=${encodeURIComponent(vars.entity_id)}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ALL_KEY }),
  });

  function isFavorited(type: string, id: string): boolean {
    return favorites.some((f) => f.entity_type === type && f.entity_id === id);
  }

  function toggleFavorite(type: "report" | "customer" | "job", id: string) {
    if (isFavorited(type, id)) {
      removeMut.mutate({ entity_type: type, entity_id: id });
    } else {
      addMut.mutate({ entity_type: type, entity_id: id });
    }
  }

  function favoritedIds(type: string): Set<string> {
    return new Set(favorites.filter((f) => f.entity_type === type).map((f) => f.entity_id));
  }

  return { favorites: filtered, allFavorites: favorites, isFavorited, toggleFavorite, favoritedIds };
}
