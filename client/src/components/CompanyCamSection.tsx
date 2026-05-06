import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Project = { companycam_project_id: string; name: string; address: string | null };
type Photo = {
  companycam_photo_id: string;
  captured_at: string | null;
  captured_by_name: string;
  photo_url_original: string | null;
  photo_url_web: string | null;
  photo_url_thumbnail: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
};

interface Props {
  estimateId: string;
  linkedProjectId: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function CompanyCamSection({ estimateId, linkedProjectId }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxDesc, setLightboxDesc] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setLightboxUrl(null); setLightboxDesc(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const projectsQ = useQuery({
    queryKey: ["companycam-projects", debounced],
    enabled: open,
    queryFn: async () => {
      const r = await fetch(`/api/companycam/projects?q=${encodeURIComponent(debounced)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Search failed");
      return (await r.json()) as { projects: Project[] };
    },
  });

  const photosQ = useQuery({
    queryKey: ["estimate-photos", estimateId, linkedProjectId],
    queryFn: async () => {
      const r = await fetch(`/api/estimates/${estimateId}/photos`, { credentials: "include" });
      if (!r.ok) throw new Error("Photos failed");
      return (await r.json()) as { photos: Photo[] };
    },
    refetchOnWindowFocus: true,
  });

  const link = useMutation({
    mutationFn: async (newId: string | null) => {
      const r = await fetch(`/api/estimates/${estimateId}/companycam-project`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companycamProjectId: newId }),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries();
      setOpen(false);
      setQuery("");
    },
  });

  const photos = photosQ.data?.photos ?? [];
  const projects = projectsQ.data?.projects ?? [];

  return (
    <section className="border-t pt-6 mt-8">
      <h2 className="text-lg font-semibold mb-3">CompanyCam project</h2>
      {linkedProjectId ? (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="font-medium font-mono text-sm break-all">{linkedProjectId}</span>
          <a className="text-sm text-blue-600 underline" href={`https://app.companycam.com/projects/${linkedProjectId}`} target="_blank" rel="noreferrer">Open in CompanyCam &rarr;</a>
          <button type="button" className="text-sm text-red-600 underline" onClick={() => link.mutate(null)} disabled={link.isPending}>Unlink</button>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mb-3">No CompanyCam project linked yet.</p>
      )}
      <div className="relative mb-4 max-w-md">
        <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder={linkedProjectId ? "Change linked project…" : "Pick a CompanyCam project…"} className="w-full border rounded px-3 py-2 text-sm" />
        {open && projects.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-72 overflow-auto">
            {projects.map((p) => (
              <li key={p.companycam_project_id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); link.mutate(p.companycam_project_id); }}>
                <div className="font-medium">{p.name}</div>
                {p.address && <div className="text-xs text-gray-500">{p.address}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-gray-500">{linkedProjectId ? "No photos yet — photos taken in this CompanyCam project will appear here within seconds." : "No photos yet — link a CompanyCam project above, then photos taken in that project will appear here within seconds."}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {photos.map((ph) => {
            const thumb = ph.photo_url_thumbnail || ph.photo_url_web || ph.photo_url_original;
            const full = ph.photo_url_original || ph.photo_url_web || ph.photo_url_thumbnail;
            if (!thumb) return null;
            return (
              <button type="button" key={ph.companycam_photo_id} onClick={() => { setLightboxUrl(full); setLightboxDesc(ph.description); }} className="block w-[120px] text-left">
                <img src={thumb} alt={`Photo by ${ph.captured_by_name}`} className="w-[120px] h-[120px] object-cover rounded border" loading="lazy" />
                <div className="text-xs mt-1 text-gray-700 truncate">{ph.captured_by_name}</div>
                <div className="text-[11px] text-gray-500">{relativeTime(ph.captured_at)}</div>
                {ph.description && (<div className="text-[11px] text-gray-700 mt-1 italic line-clamp-3 whitespace-pre-wrap">{ph.description}</div>)}
              </button>
            );
          })}
        </div>
      )}
      {lightboxUrl && (
        <div role="dialog" aria-modal="true" onClick={() => { setLightboxUrl(null); setLightboxDesc(null); }} className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 p-2 sm:p-4 cursor-zoom-out">
          <img src={lightboxUrl} onClick={(e) => e.stopPropagation()} className="max-w-[96vw] max-h-[80vh] object-contain cursor-default" alt="Full-size photo" />
          {lightboxDesc && (
            <div onClick={(e) => e.stopPropagation()} className="mt-3 max-w-[96vw] bg-white text-gray-900 text-sm sm:text-base p-3 rounded shadow whitespace-pre-wrap max-h-[15vh] overflow-auto cursor-default">
              {lightboxDesc}
            </div>
          )}
          <button type="button" onClick={() => { setLightboxUrl(null); setLightboxDesc(null); }} className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-9 h-9 flex items-center justify-center text-xl leading-none" aria-label="Close">×</button>
        </div>
      )}
    </section>
  );
}
