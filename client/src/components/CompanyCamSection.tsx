import { useEffect, useRef, useState } from "react";
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
  description_override: string | null;
  description_source: string | null;
  hidden_on_estimate: boolean;
  work_area_group_id: string | null;
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

function effectiveDesc(ph: Photo): string | null {
  return ph.description_override ?? ph.description;
}

export function CompanyCamSection({ estimateId, linkedProjectId }: Props) {
  const qc = useQueryClient();

  // ref so the lightbox Esc listener can read editingNote without stale closure
  const editingNoteRef = useRef<string | null>(null);
  // ref to suppress onBlur-save when Esc cancels an edit
  const escCancelledRef = useRef(false);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const [showHidden, setShowHidden] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const wheelContainerRef = useRef<HTMLDivElement | null>(null);

  // keep ref in sync
  useEffect(() => { editingNoteRef.current = editingNote; }, [editingNote]);

  // debounce project search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // lightbox Esc — skip if currently editing a note
  useEffect(() => {
    if (!lightboxPhotoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingNoteRef.current) {
        setLightboxPhotoId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhotoId]);

  // reset zoom/pan when lightbox photo changes or closes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    dragStartRef.current = null;
  }, [lightboxPhotoId]);

  // native wheel listener — must be non-passive to call preventDefault
  useEffect(() => {
    const el = wheelContainerRef.current;
    if (!el || !lightboxPhotoId) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom(z => Math.max(1, Math.min(5, z * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [lightboxPhotoId]);

  // keyboard +/-/0 zoom — skip while editing a note
  useEffect(() => {
    if (!lightboxPhotoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (editingNoteRef.current) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(5, z * 1.25)); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(z => Math.max(1, z / 1.25)); }
      else if (e.key === '0') { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPhotoId]);

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

  const { data: groupsData } = useQuery({
    queryKey: ["estimate-work-area-groups", estimateId],
    queryFn: async () => {
      const r = await fetch(`/api/estimates/${estimateId}/work-area-groups`, { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      return r.json() as Promise<{ groups: { id: string; name: string; sort_order: number; created_at: string; photo_count: number }[] }>;
    },
    enabled: !!estimateId,
  });
  const groups = groupsData?.groups ?? [];

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

  const noteMutation = useMutation({
    mutationFn: async ({ photoId, note }: { photoId: string; note: string | null }) => {
      const r = await fetch(`/api/companycam/photos/${photoId}/note`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!r.ok) throw new Error("Note save failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: async ({ photoId, hidden }: { photoId: string; hidden: boolean }) => {
      const r = await fetch(`/api/companycam/photos/${photoId}/hidden`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!r.ok) throw new Error("Hide toggle failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`/api/estimates/${estimateId}/work-area-groups`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Create group failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-work-area-groups", estimateId] });
    },
  });

  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const r = await fetch(`/api/work-area-groups/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Rename group failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-work-area-groups", estimateId] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/work-area-groups/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("Delete group failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-work-area-groups", estimateId] });
    },
  });

  const assignPhotoMutation = useMutation({
    mutationFn: async ({ photoId, workAreaGroupId }: { photoId: string; workAreaGroupId: string | null }) => {
      const r = await fetch(`/api/companycam/photos/${photoId}/work-area-group`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_area_group_id: workAreaGroupId }),
      });
      if (!r.ok) throw new Error("Assign photo failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-photos", estimateId] });
      qc.invalidateQueries({ queryKey: ["estimate-work-area-groups", estimateId] });
    },
  });

  const photos = photosQ.data?.photos ?? [];
  const projects = projectsQ.data?.projects ?? [];
  const visiblePhotos = photos.filter((p) => !p.hidden_on_estimate);
  const hiddenPhotos = photos.filter((p) => p.hidden_on_estimate);
  const ungroupedPhotos = visiblePhotos.filter((p) => !p.work_area_group_id);
  const lightboxPhoto = lightboxPhotoId
    ? (photos.find((p) => p.companycam_photo_id === lightboxPhotoId) ?? null)
    : null;

  function startEdit(ph: Photo) {
    setEditingNote(ph.companycam_photo_id);
    setDraftNote(effectiveDesc(ph) ?? "");
  }

  function saveEdit() {
    const id = editingNoteRef.current;
    if (!id) return;
    const trimmed = draftNote.trim();
    noteMutation.mutate({ photoId: id, note: trimmed || null });
    setEditingNote(null);
    setDraftNote("");
  }

  function onNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      escCancelledRef.current = true;
      setEditingNote(null);
      setDraftNote("");
    }
  }

  function saveEditOnBlur() {
    if (escCancelledRef.current) {
      escCancelledRef.current = false;
      return;
    }
    saveEdit();
  }

  function closeLightbox() {
    setLightboxPhotoId(null);
    setEditingNote(null);
    setDraftNote("");
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const ds = dragStartRef.current;
    if (!ds) return;
    setPan({ x: ds.panX + (e.clientX - ds.x), y: ds.panY + (e.clientY - ds.y) });
  };
  const onMouseUp = () => { dragStartRef.current = null; };
  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 1) setZoom(2);
    else { setZoom(1); setPan({ x: 0, y: 0 }); }
  };

  function renderPhotoCard(ph: Photo, isHiddenSection: boolean) {
    const thumb = ph.photo_url_thumbnail || ph.photo_url_web || ph.photo_url_original;
    if (!thumb) return null;
    const desc = effectiveDesc(ph);
    const isEditingThis = editingNote === ph.companycam_photo_id;
    return (
      <div
        key={ph.companycam_photo_id}
        className="group relative w-[120px] text-left"
        draggable={!isHiddenSection}
        onDragStart={isHiddenSection ? undefined : (e) => {
          e.dataTransfer.setData("text/plain", ph.companycam_photo_id);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        <button
          type="button"
          className="block"
          onClick={() => setLightboxPhotoId(ph.companycam_photo_id)}
        >
          <img
            src={thumb}
            alt={`Photo by ${ph.captured_by_name}`}
            className="w-[120px] h-[120px] object-cover rounded border"
            loading="lazy"
          />
        </button>
        <button
          type="button"
          title={isHiddenSection ? "Show on estimate" : "Hide from estimate"}
          className="absolute top-1 right-1 w-7 h-7 hidden group-hover:flex items-center justify-center bg-black/60 rounded-full text-white text-sm leading-none"
          onClick={(e) => {
            e.stopPropagation();
            hideMutation.mutate({ photoId: ph.companycam_photo_id, hidden: !isHiddenSection });
          }}
        >
          {isHiddenSection ? "👁" : "🙈"}
        </button>
        <div className="text-xs mt-1 text-gray-700 truncate">{ph.captured_by_name}</div>
        <div className="text-[11px] text-gray-500">{relativeTime(ph.captured_at)}</div>
        {isEditingThis ? (
          <textarea
            autoFocus
            className="text-[11px] w-full mt-1 border rounded p-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={3}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onBlur={saveEditOnBlur}
            onKeyDown={onNoteKeyDown}
          />
        ) : (
          <p
            className="text-[11px] mt-1 line-clamp-3 whitespace-pre-wrap cursor-text"
            onClick={() => startEdit(ph)}
          >
            {desc ? (
              <>
                <span className="text-gray-700 italic">{desc}</span>
                {ph.description_override !== null && (
                  <span className="ml-1 text-gray-400 not-italic text-[10px]">(edited)</span>
                )}
              </>
            ) : (
              <span className="text-gray-400 italic">Add note...</span>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="border-t pt-6 mt-8">
      <h2 className="text-lg font-semibold mb-3">CompanyCam project</h2>

      {/* ── Project link / picker ────────────────────────────────────────────── */}
      {linkedProjectId ? (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="font-medium font-mono text-sm break-all">{linkedProjectId}</span>
          <a
            href={`https://app.companycam.com/projects/${linkedProjectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors no-underline"
          >
            Open in CompanyCam <span aria-hidden="true">→</span>
          </a>
          <button
            type="button"
            onClick={() => link.mutate(null)}
            disabled={link.isPending}
            className="inline-flex items-center px-4 py-1.5 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            Unlink
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mb-3">No CompanyCam project linked yet.</p>
      )}

      <div className="relative mb-4 max-w-md">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={linkedProjectId ? "Change linked project…" : "Pick a CompanyCam project…"}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        {open && projects.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-72 overflow-auto">
            {projects.map((p) => (
              <li
                key={p.companycam_project_id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onMouseDown={(e) => { e.preventDefault(); link.mutate(p.companycam_project_id); }}
              >
                <div className="font-medium">{p.name}</div>
                {p.address && <div className="text-xs text-gray-500">{p.address}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Gallery ─────────────────────────────────────────────────────────── */}
      {photos.length === 0 ? (
        <p className="text-sm text-gray-500">
          {linkedProjectId
            ? "No photos yet — photos taken in this CompanyCam project will appear here within seconds."
            : "No photos yet — link a CompanyCam project above, then photos taken in that project will appear here within seconds."}
        </p>
      ) : (
        <>
          {/* ── Ungrouped section — always visible ────────────────────────── */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverGroupId("ungrouped"); }}
            onDragLeave={(e) => { if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return; setDragOverGroupId(null); }}
            onDrop={(e) => { e.preventDefault(); const photoId = e.dataTransfer.getData("text/plain"); if (photoId) assignPhotoMutation.mutate({ photoId, workAreaGroupId: null }); setDragOverGroupId(null); }}
          >
            <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 mb-3 mt-2 transition-colors ${dragOverGroupId === "ungrouped" ? "ring-2 ring-blue-400 bg-blue-50/70" : "bg-stone-100 hover:bg-stone-200/70"}`}>
              <button
                type="button"
                onClick={() => setCollapsedGroups((s) => { const n = new Set(s); n.has("ungrouped") ? n.delete("ungrouped") : n.add("ungrouped"); return n; })}
                className="flex items-center gap-2 text-sm font-medium text-gray-800 flex-1 text-left"
              >
                <span className="text-gray-500">{collapsedGroups.has("ungrouped") ? "▸" : "▾"}</span>
                <span>Ungrouped</span>
                <span className="text-gray-500 text-xs font-normal">({ungroupedPhotos.length})</span>
              </button>
            </div>
            {!collapsedGroups.has("ungrouped") && (
              ungroupedPhotos.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2 pl-1">No unassigned photos.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {ungroupedPhotos.map((ph) => renderPhotoCard(ph, false))}
                </div>
              )
            )}
          </div>

          {/* ── Per-group sections ─────────────────────────────────────────── */}
          {[...groups]
            .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
            .map((group) => {
              const groupPhotos = visiblePhotos.filter((p) => p.work_area_group_id === group.id);
              const isCollapsed = collapsedGroups.has(group.id);
              const isEditingThisGroup = editingGroupId === group.id;
              return (
                <div
                  key={group.id}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverGroupId(group.id); }}
                  onDragLeave={(e) => { if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return; setDragOverGroupId(null); }}
                  onDrop={(e) => { e.preventDefault(); const photoId = e.dataTransfer.getData("text/plain"); if (photoId) assignPhotoMutation.mutate({ photoId, workAreaGroupId: group.id }); setDragOverGroupId(null); }}
                >
                  <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 mb-3 mt-4 transition-colors ${dragOverGroupId === group.id ? "ring-2 ring-blue-400 bg-blue-50/70" : "bg-stone-100 hover:bg-stone-200/70"}`}>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-gray-800 flex-1 text-left"
                      onClick={() => setCollapsedGroups((s) => {
                        const n = new Set(s);
                        n.has(group.id) ? n.delete(group.id) : n.add(group.id);
                        return n;
                      })}
                    >
                      <span className="text-gray-500">{isCollapsed ? "▸" : "▾"}</span>
                      {isEditingThisGroup ? (
                        <input
                          autoFocus
                          value={editingGroupName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() || group.name });
                              setEditingGroupId(null);
                            }
                            if (e.key === "Escape") setEditingGroupId(null);
                          }}
                          onBlur={() => {
                            renameGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() || group.name });
                            setEditingGroupId(null);
                          }}
                          className="px-2 py-0.5 rounded border border-gray-300 text-sm font-medium"
                        />
                      ) : (
                        <>
                          <span>{group.name}</span>
                          <span className="text-gray-500 text-xs font-normal">({groupPhotos.length})</span>
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Rename"
                        aria-label="Rename group"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-stone-300/60 text-gray-600 hover:text-gray-900 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                      >✎</button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label="Delete group"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete group "${group.name}"? Photos will be ungrouped.`)) {
                            deleteGroupMutation.mutate(group.id);
                          }
                        }}
                      >🗑</button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-wrap gap-3">
                      {groupPhotos.map((ph) => renderPhotoCard(ph, false))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* ── + New group ────────────────────────────────────────────────── */}
          {creatingGroup ? (
            <div className="mt-4 flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={newGroupName}
                placeholder="Group name..."
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGroupName.trim()) {
                    createGroupMutation.mutate(newGroupName.trim());
                    setCreatingGroup(false);
                    setNewGroupName("");
                  }
                  if (e.key === "Escape") { setCreatingGroup(false); setNewGroupName(""); }
                }}
                onBlur={() => { if (!newGroupName.trim()) { setCreatingGroup(false); setNewGroupName(""); } }}
                className="border rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => { setCreatingGroup(false); setNewGroupName(""); }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingGroup(true)}
              className="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <span className="text-lg leading-none">+</span> New group
            </button>
          )}

          {/* ── Hidden photos — collapsible section ───────────────────────── */}
          {hiddenPhotos.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between bg-stone-100 hover:bg-stone-200/70 transition-colors rounded-lg px-4 py-2.5 mb-3">
                <button
                  type="button"
                  onClick={() => setShowHidden((s) => !s)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-800 flex-1 text-left"
                >
                  <span className="text-gray-500">{showHidden ? "▾" : "▸"}</span>
                  <span>Hidden</span>
                  <span className="text-gray-500 text-xs font-normal">({hiddenPhotos.length})</span>
                </button>
              </div>
              {showHidden && (
                <div className="flex flex-wrap gap-3">
                  {hiddenPhotos.map((ph) => renderPhotoCard(ph, true))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
          className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 p-2 sm:p-4 cursor-zoom-out"
        >
          <div
            ref={wheelContainerRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={onDoubleClick}
            className="relative max-w-[96vw] max-h-[80vh] overflow-hidden flex items-center justify-center"
            style={{ cursor: zoom > 1 ? (dragStartRef.current ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              src={lightboxPhoto.photo_url_original || lightboxPhoto.photo_url_web || lightboxPhoto.photo_url_thumbnail || ""}
              alt="Full-size photo"
              draggable={false}
              className="max-w-[96vw] max-h-[80vh] object-contain pointer-events-none select-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragStartRef.current ? 'none' : 'transform 0.1s ease-out',
              }}
            />
          </div>

          {/* Lightbox note bar — always shown, always editable */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 max-w-[96vw] w-full max-w-lg bg-white text-gray-900 text-sm sm:text-base p-3 rounded shadow cursor-default"
          >
            {editingNote === lightboxPhoto.companycam_photo_id ? (
              <textarea
                autoFocus
                className="w-full border-none outline-none resize-none text-sm"
                rows={4}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onBlur={saveEditOnBlur}
                onKeyDown={onNoteKeyDown}
              />
            ) : (
              <p
                className={`cursor-text whitespace-pre-wrap${effectiveDesc(lightboxPhoto) ? " text-gray-900" : " text-gray-400 italic"}`}
                onClick={() => startEdit(lightboxPhoto)}
              >
                {effectiveDesc(lightboxPhoto) || "Add note..."}
                {lightboxPhoto.description_override !== null && effectiveDesc(lightboxPhoto) && (
                  <span className="ml-2 text-gray-400 text-xs not-italic">(edited)</span>
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-9 h-9 flex items-center justify-center text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>

          {/* Zoom controls — bottom right corner of lightbox */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 flex items-center gap-0.5 bg-black/70 text-white rounded-full px-1 py-1 select-none"
          >
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(1, z / 1.25))}
              className="w-9 h-9 flex items-center justify-center hover:bg-white/15 rounded-full text-lg leading-none"
              aria-label="Zoom out"
            >−</button>
            <span className="text-xs tabular-nums min-w-[3.5rem] text-center px-1">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(5, z * 1.25))}
              className="w-9 h-9 flex items-center justify-center hover:bg-white/15 rounded-full text-lg leading-none"
              aria-label="Zoom in"
            >+</button>
            <button
              type="button"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="w-9 h-9 flex items-center justify-center hover:bg-white/15 rounded-full text-base leading-none"
              aria-label="Reset zoom"
              title="Reset zoom (or press 0)"
            >⟲</button>
          </div>
        </div>
      )}
    </section>
  );
}
