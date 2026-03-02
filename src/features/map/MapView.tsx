import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap, Marker } from "mapbox-gl";

import type { Pin, PinCategory } from "../pins/pinTypes";
import { createPin, listPins, toggleReaction, uploadPinImage, deletePin } from "../pins/pinApi";

import { ProfileModal } from "../profile/profileModal";
import { getMyProfile } from "../profile/profileApi";
import { supabase } from "../../lib/supabaseClient";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Centro demo (Lisbona)
const DEFAULT_CENTER = { lng: -9.142685, lat: 38.736946 };
const DEFAULT_ZOOM = 12;

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768;

type DraftPin = {
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: PinCategory;
  tips: string[];
  images: File[];
};

const CATEGORIES: { value: PinCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "nightlife", label: "Nightlife" },
  { value: "sight", label: "Sight" },
  { value: "shop", label: "Shop" },
  { value: "beach", label: "Beach" },
  { value: "other", label: "Other" },
];

function categoryEmoji(cat: PinCategory) {
  switch (cat) {
    case "food":
      return "🍜";
    case "nightlife":
      return "🎧";
    case "sight":
      return "📸";
    case "shop":
      return "🛍️";
    case "beach":
      return "🏖️";
    default:
      return "📍";
  }
}

// Custom hook for responsive viewport detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export function MapView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  // marker cache: pinId -> Marker
  const markersRef = useRef<Map<string, Marker>>(new Map());

  // popup ref
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // live refs for map click handler (avoid stale closures)
  const selectedPinIdRef = useRef<string | null>(null);
  const draftRef = useRef<DraftPin | null>(null);

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPin | null>(null);

  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);

  // Mobile state
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // filters
  const [activeCategory, setActiveCategory] = useState<PinCategory | "all">("all");
  const [pinnerFilter, setPinnerFilter] = useState<"all" | "traveler" | "hostel">("all");
  const [search, setSearch] = useState("");

  // profile modal + avatar
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // tips viewer
  const [tipsViewerOpen, setTipsViewerOpen] = useState(false);
  const [viewerTips, setViewerTips] = useState<string[]>([]);
  const [checkedTips, setCheckedTips] = useState<Set<number>>(new Set());

  // delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPinId, setDeleteConfirmPinId] = useState<string | null>(null);

  // current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId]
  );

  const filteredPins = useMemo(() => {
    const q = search.trim().toLowerCase();

    return pins.filter((p) => {
      const okCat = activeCategory === "all" ? true : p.category === activeCategory;
      const okPinner = pinnerFilter === "all" ? true : p.createdByType === pinnerFilter;

      const okSearch =
        q.length === 0
          ? true
          : (p.title + " " + p.description + " " + (p.createdByLabel ?? ""))
              .toLowerCase()
              .includes(q);

      return okCat && okPinner && okSearch;
    });
  }, [pins, activeCategory, pinnerFilter, search]);

  function forceReopenPopup(pinId: string) {
    setSelectedPinId(null);
    setTimeout(() => setSelectedPinId(pinId), 0);
  }

  async function reloadPins() {
    setLoading(true);
    try {
      const data = await listPins();
      setPins(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    selectedPinIdRef.current = selectedPinId;
  }, [selectedPinId]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    reloadPins();
  }, []);

  // Load avatar and current user once on mount
  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        setAvatarUrl(p.avatar_url ?? "");
      } catch {
        // ignore
      }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          setCurrentUserId(userData.user.id);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // init map once
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    if (!mapboxgl.accessToken) {
      console.error("Missing VITE_MAPBOX_TOKEN in .env");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: DEFAULT_ZOOM,
    });

    // Position navigation control based on viewport
    const isMobileVP = window.innerWidth < MOBILE_BREAKPOINT;
    map.addControl(new mapboxgl.NavigationControl(), isMobileVP ? "bottom-right" : "top-right");

    // click on map -> close popup first, second click opens add-pin modal
    map.on("click", (e) => {
      if (selectedPinIdRef.current) {
        setSelectedPinId(null);
        return;
      }
      if (draftRef.current) return;

      const { lng, lat } = e.lngLat;
      setDraft({
        lng,
        lat,
        title: "",
        description: "",
        category: "other",
        tips: [],
        images: [],
      });
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep markers in sync with filteredPins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markerMap = markersRef.current;

    // Remove markers not present anymore
    const keep = new Set(filteredPins.map((p) => p.id));
    for (const [id, marker] of markerMap.entries()) {
      if (!keep.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    }

    // Add/update markers
    for (const pin of filteredPins) {
      const existing = markerMap.get(pin.id);
      if (existing) {
        existing.setLngLat([pin.lng, pin.lat]);

        const el = existing.getElement();
        const badge = el.querySelector<HTMLDivElement>("[data-badge]");
        if (badge) badge.textContent = categoryEmoji(pin.category);
        continue;
      }

      // Custom marker element
      const el = document.createElement("div");
      el.style.width = "34px";
      el.style.height = "34px";
      el.style.borderRadius = "999px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";
      el.style.border = "2px solid white";
      el.style.background = pin.createdByType === "hostel" ? "#111" : "#2563eb";
      el.style.color = "white";
      el.style.userSelect = "none";

      const badge = document.createElement("div");
      badge.setAttribute("data-badge", "1");
      badge.textContent = categoryEmoji(pin.category);
      badge.style.fontSize = "16px";
      el.appendChild(badge);

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setDraft(null);
        setSelectedPinId(pin.id);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      markerMap.set(pin.id, marker);
    }
  }, [filteredPins]);

  // Popup for selected pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!selectedPin) return;

    const pin = selectedPin;

    const container = document.createElement("div");

    // Prevent popup clicks from reaching the map
    container.addEventListener("click", (ev) => ev.stopPropagation());
    container.addEventListener("mousedown", (ev) => ev.stopPropagation());
    container.addEventListener("touchstart", (ev) => ev.stopPropagation());

    const isMobileViewport = window.innerWidth < MOBILE_BREAKPOINT;
    container.style.width = "100%";
    container.style.maxWidth = "100%";
    container.style.minWidth = isMobileViewport ? "0" : "360px";
    container.style.color = "#111";
    container.style.fontFamily = "system-ui, Arial";
    container.style.position = "relative";
    container.style.fontSize = isMobileViewport ? "13px" : "14px";
    container.style.padding = "12px";
    container.style.boxSizing = "border-box";
    container.style.overflow = "hidden";

    container.innerHTML = `
      <div style="font-weight:800; margin-bottom:6px; font-size:${isMobileViewport ? '15px' : '16px'};">
        ${categoryEmoji(pin.category)} ${escapeHtml(pin.title)}
      </div>

      <div style="font-size:13px; opacity:0.9; margin-bottom:10px;">
        ${
          pin.description?.trim()
            ? escapeHtml(pin.description)
            : "<i style='opacity:0.7'>No description</i>"
        }
      </div>

      ${
        pin.imageUrls && pin.imageUrls.length > 0
          ? `<div style="margin-bottom:10px; position:relative; width:100%; box-sizing:border-box; overflow:hidden; border-radius:8px;">
               <img src="${escapeHtml(pin.imageUrls[0])}" style="width:100%;max-width:100%;height:${isMobileViewport ? '160px' : '140px'};object-fit:cover;display:block;" data-lightbox-url="${escapeHtml(pin.imageUrls[0])}" class="pin-image-preview" />
               ${
                 pin.imageUrls.length > 1
                   ? `<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:6px;font-weight:bold;font-size:12px;">+${pin.imageUrls.length - 1}</div>`
                   : ""
               }
               ${
                 pin.imageUrls.length > 1
                   ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;opacity:0;background:rgba(0,0,0,0.5);border-radius:8px;transition:opacity 0.2s;pointer-events:none;" class="pin-image-hover">👁️ Click to view all</div>`
                   : `<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;opacity:0;background:rgba(0,0,0,0.5);border-radius:8px;transition:opacity 0.2s;pointer-events:none;" class="pin-image-hover">👁️ Click to view!</div>`
               }
             </div>`
          : ""
      }

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
        <span style="padding:4px 8px; border-radius:999px; background:rgba(0,0,0,0.06); font-size:12px;">
          ${escapeHtml(pin.category)}
        </span>
        <span style="padding:4px 8px; border-radius:999px; background:rgba(37,99,235,0.12); font-size:12px;">
          ${
            pin.createdByType === "hostel"
              ? `Recommended by ${escapeHtml(pin.createdByLabel)}`
              : `Pinned by ${escapeHtml(pin.createdByLabel)}`
          }
        </span>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; min-width:0;">
        <button data-like style="flex:1 1 100px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.18); background:white; cursor:pointer; font-weight:800; color:#111; font-size:13px;">
          ❤️ <span style="margin-left:4px;">${pin.likesCount}</span>
        </button>
        <button data-dislike style="flex:1 1 100px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.18); background:white; cursor:pointer; font-weight:800; color:#111; font-size:13px;">
          💔 <span style="margin-left:4px;">${pin.dislikesCount}</span>
        </button>
        ${
          pin.tips && pin.tips.length > 0
            ? `<button data-tips style="flex:1 1 140px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,0.18); background:#fffaeb; cursor:pointer; font-weight:800; color:#b8860b; font-size:13px;">
                💡 Tips (${pin.tips.length})
              </button>`
            : ""
        }
        <button data-fly style="flex:1 1 100px; padding:8px 10px; border-radius:10px; border:none; background:#111; color:white; cursor:pointer; font-weight:800; font-size:13px;">
          Fly to
        </button>
        ${
          pin.createdById === currentUserId
            ? `<button data-delete style="padding:8px 10px; border-radius:10px; border:none; background:#dc2626; color:white; cursor:pointer; font-weight:800;">Delete</button>`
            : ""
        }
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 18,
      maxWidth: isMobileViewport ? "92vw" : "420px",
    })
      .setLngLat([pin.lng, pin.lat])
      .setDOMContent(container)
      .addTo(map);

    // Style the close button
    const closeBtn = popup.getElement()?.querySelector('.mapboxgl-popup-close-button') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.style.color = '#111';
      closeBtn.style.fontSize = '24px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.style.padding = '4px 8px';
    }

    const likeBtn = container.querySelector<HTMLButtonElement>("[data-like]");
    const dislikeBtn = container.querySelector<HTMLButtonElement>("[data-dislike]");
    const tipsBtn = container.querySelector<HTMLButtonElement>("[data-tips]");
    const flyBtn = container.querySelector<HTMLButtonElement>("[data-fly]");
    const deleteBtn = container.querySelector<HTMLButtonElement>("[data-delete]");

    likeBtn?.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await onReact(pin.id, "like");
      forceReopenPopup(pin.id);
    });

    dislikeBtn?.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await onReact(pin.id, "dislike");
      forceReopenPopup(pin.id);
    });

    tipsBtn?.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      setViewerTips(pin.tips ?? []);
      setCheckedTips(new Set());
      setTipsViewerOpen(true);
    });

    flyBtn?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      flyTo(pin);
    });

    deleteBtn?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      setDeleteConfirmPinId(pin.id);
      setDeleteConfirmOpen(true);
    });

    // Add click handlers for main image and hover effect
    const imagePreview = container.querySelector<HTMLImageElement>(".pin-image-preview");
    const imageHover = container.querySelector<HTMLDivElement>(".pin-image-hover");
    
    if (imagePreview) {
      imagePreview.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showImageLightbox(pin.imageUrls ?? []);
      });
      
      // Add hover effect
      if (imageHover) {
        imagePreview.addEventListener("mouseenter", () => {
          imageHover.style.opacity = "1";
        });
        
        imagePreview.addEventListener("mouseleave", () => {
          imageHover.style.opacity = "0";
        });
      }
    }

    popup.on("close", () => {
      setSelectedPinId(null);
      // Also close tips viewer when popup closes
      setTipsViewerOpen(false);
    });

    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, [selectedPin]);

  async function onSubmitDraft() {
    if (!draft) return;

    const title = draft.title.trim();
    if (!title) return;

    // ✅ Upload images via pinApi helper
    const imageUrls: string[] = [];
    for (const file of draft.images) {
      const url = await uploadPinImage(file);
      imageUrls.push(url);
    }

    // Filter out empty tips
    const tips = draft.tips.filter(t => t.trim());

    await createPin({
      title,
      description: draft.description.trim(),
      category: draft.category,
      lat: draft.lat,
      lng: draft.lng,
      tips,
      imageUrls,
    });

    setDraft(null);
    await reloadPins();
  }

  async function onReact(pinId: string, kind: "like" | "dislike") {
    await toggleReaction(pinId, kind);
    await reloadPins();
  }

  function flyTo(pin: Pin) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 14) });
  }

  async function onConfirmDelete(pinId: string) {
    try {
      await deletePin(pinId);
      setSelectedPinId(null);
      setDeleteConfirmOpen(false);
      setDeleteConfirmPinId(null);
      await reloadPins();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }

  function showImageLightbox(imageUrls: string | string[]) {
    // Handle both single string and array
    const urls = typeof imageUrls === "string" ? [imageUrls] : imageUrls;
    let currentIndex = 0;

    // Create lightbox container
    const lightbox = document.createElement("div");
    lightbox.style.position = "fixed";
    lightbox.style.inset = "0";
    lightbox.style.background = "rgba(0,0,0,0.85)";
    lightbox.style.display = "flex";
    lightbox.style.alignItems = "center";
    lightbox.style.justifyContent = "center";
    lightbox.style.zIndex = "10000";
    lightbox.style.padding = "16px";
    lightbox.style.cursor = "pointer";
    lightbox.style.flexDirection = "column";

    const img = document.createElement("img");
    img.style.maxWidth = "90vw";
    img.style.maxHeight = "70vh";
    img.style.objectFit = "contain";
    img.style.borderRadius = "8px";
    img.style.cursor = "default";

    const updateImage = () => {
      img.src = urls[currentIndex];
    };

    updateImage();

    lightbox.appendChild(img);

    // Add counter and navigation if multiple images
    if (urls.length > 1) {
      const controlsDiv = document.createElement("div");
      controlsDiv.style.display = "flex";
      controlsDiv.style.gap = "12px";
      controlsDiv.style.marginTop = "16px";
      controlsDiv.style.alignItems = "center";
      controlsDiv.style.color = "white";

      const counter = document.createElement("div");
      counter.style.fontSize = "14px";
      counter.textContent = `${currentIndex + 1} / ${urls.length}`;

      const prevBtn = document.createElement("button");
      prevBtn.textContent = "← Prev";
      prevBtn.style.padding = "8px 12px";
      prevBtn.style.borderRadius = "6px";
      prevBtn.style.border = "1px solid white";
      prevBtn.style.background = "rgba(255,255,255,0.2)";
      prevBtn.style.color = "white";
      prevBtn.style.cursor = "pointer";
      prevBtn.style.fontWeight = "bold";
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + urls.length) % urls.length;
        updateImage();
        counter.textContent = `${currentIndex + 1} / ${urls.length}`;
      });

      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Next →";
      nextBtn.style.padding = "8px 12px";
      nextBtn.style.borderRadius = "6px";
      nextBtn.style.border = "1px solid white";
      nextBtn.style.background = "rgba(255,255,255,0.2)";
      nextBtn.style.color = "white";
      nextBtn.style.cursor = "pointer";
      nextBtn.style.fontWeight = "bold";
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % urls.length;
        updateImage();
        counter.textContent = `${currentIndex + 1} / ${urls.length}`;
      });

      controlsDiv.appendChild(prevBtn);
      controlsDiv.appendChild(counter);
      controlsDiv.appendChild(nextBtn);
      lightbox.appendChild(controlsDiv);
    }

    // Close on background click
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        lightbox.remove();
      }
    });

    // Close on Escape key
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        lightbox.remove();
        document.removeEventListener("keydown", closeOnEscape);
      }
    };
    document.addEventListener("keydown", closeOnEscape);

    document.body.appendChild(lightbox);
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" }}>
      {/* Top bar - Responsive */}
      <div
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "white",
          color: "#111",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: isMobile ? 8 : 12,
            alignItems: "center",
            padding: isMobile ? "8px 10px" : "10px 12px",
            maxWidth: isMobile ? "100%" : 1100,
            margin: "0 auto",
            flexWrap: isMobile ? "nowrap" : "nowrap",
            justifyContent: isMobile ? "space-between" : "flex-start",
          }}
        >
          {/* Logo - Mobile only left placeholder */}
          {isMobile && <div style={{ width: 44, height: 44 }} />}
          
          {/* Centered Logo */}
          <div
            style={{
              position: isMobile ? "absolute" : "relative",
              left: isMobile ? "50%" : "auto",
              transform: isMobile ? "translateX(-50%)" : "none",
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontSize: isMobile ? 14 : 16,
            }}
          >
            🎒 travelBuddy
          </div>
          
          {!isMobile && <div style={{ flex: 1 }} />}

          {!isMobile && (
            <>
              {/* Desktop: Full search and filters */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pins…"
                style={{
                  width: 320,
                  maxWidth: "40vw",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  fontSize: 14,
                }}
              />

              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as any)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  minWidth: 170,
                  fontSize: 14,
                }}
              >
                <option value="all">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {categoryEmoji(c.value)} {c.label}
                  </option>
                ))}
              </select>

              <select
                value={pinnerFilter}
                onChange={(e) => setPinnerFilter(e.target.value as any)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  minWidth: 170,
                  fontSize: 14,
                }}
              >
                <option value="all">Everyone</option>
                <option value="traveler">Travelers 🎒</option>
                <option value="hostel">Hostels 🛌</option>
              </select>
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Mobile menu button with descending filter lines */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "white",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: 3,
                padding: "8px 6px",
              }}
              aria-label="Filters"
              title="Filters"
            >
              <div style={{ width: 20, height: 2, background: "#111", borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: "#111", borderRadius: 1 }} />
              <div style={{ width: 12, height: 2, background: "#111", borderRadius: 1 }} />
            </button>
          )}

          {/* Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            style={{
              width: isMobile ? 44 : 40,
              height: isMobile ? 44 : 40,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: "pointer",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            aria-label="Open profile"
            title="Profile"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 20 }}>🙂</span>
            )}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {isMobile && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 100,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                padding: "12px",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pins…"
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  fontSize: 14,
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 44,
                }}
              />

              <select
                value={activeCategory}
                onChange={(e) => {
                  setActiveCategory(e.target.value as any);
                  setMobileMenuOpen(false);
                }}
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  fontSize: 14,
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 44,
                }}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {categoryEmoji(c.value)} {c.label}
                  </option>
                ))}
              </select>

              <select
                value={pinnerFilter}
                onChange={(e) => {
                  setPinnerFilter(e.target.value as any);
                  setMobileMenuOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  fontSize: 14,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">Everyone</option>
                <option value="traveler">Travelers 🎒</option>
                <option value="hostel">Hostels 🛌</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Map container */}
      <div style={{ position: "relative", height: "100%" }}>
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

        {loading && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              fontSize: isMobile ? 13 : 14,
            }}
          >
            Loading pins…
          </div>
        )}

        {/* Add Pin Modal - Responsive */}
        {draft && (
          <div
            onClick={() => setDraft(null)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              padding: isMobile ? 0 : 16,
              zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: isMobile ? "100%" : "min(520px, 100%)",
                background: "white",
                borderRadius: isMobile ? "16px 16px 0 0" : 16,
                padding: isMobile ? "16px 16px 80px 16px" : 16,
                boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
                maxHeight: isMobile ? "90vh" : "auto",
                overflow: isMobile ? "auto" : "visible",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 16 : 16 }}>Add a pin</div>
                <button
                  onClick={() => setDraft(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: isMobile ? "8px" : "4px",
                    width: isMobile ? 44 : 32,
                    height: isMobile ? 44 : 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "unset",
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Title (required)"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    fontSize: 16,
                    minHeight: 44,
                  }}
                />

                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Description"
                  rows={3}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                    fontSize: 16,
                    fontFamily: "inherit",
                    minHeight: 100,
                  }}
                />

                {/* Tips Section */}
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                    💡 Tips (Max 5)
                  </div>
                  {draft.tips.map((tip, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 8,
                        marginBottom: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <textarea
                        value={tip}
                        onChange={(e) => {
                          const updated = [...draft.tips];
                          updated[idx] = e.target.value;
                          setDraft({ ...draft, tips: updated });
                        }}
                        placeholder={`Tip ${idx + 1}`}
                        rows={2}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.18)",
                          resize: "vertical",
                          flex: 1,
                          fontSize: 16,
                          fontFamily: "inherit",
                          minHeight: 80,
                        }}
                      />
                      {draft.tips.length > 1 && (
                        <button
                          onClick={() => {
                            const updated = draft.tips.filter((_, i) => i !== idx);
                            setDraft({ ...draft, tips: updated });
                          }}
                          style={{
                            padding: isMobile ? "10px 12px" : "10px 8px",
                            borderRadius: 8,
                            border: "1px solid rgba(220,38,38,0.35)",
                            background: "rgba(220,38,38,0.08)",
                            color: "#991b1b",
                            cursor: "pointer",
                            fontWeight: "bold",
                            marginTop: 10,
                            fontSize: 14,
                            minHeight: 44,
                          }}
                          title="Remove this tip"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.tips.length < 5 && (
                    <button
                      onClick={() => setDraft({ ...draft, tips: [...draft.tips, ""] })}
                      style={{
                        padding: "12px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.18)",
                        background: "#f5f5f5",
                        color: "#111",
                        cursor: "pointer",
                        fontWeight: 600,
                        width: "100%",
                        fontSize: 14,
                        minHeight: 44,
                      }}
                    >
                      + Add another tip
                    </button>
                  )}
                </div>

                {/* Image Upload Section */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: "#e8e8e8",
                      cursor: "pointer",
                      fontWeight: 600,
                      userSelect: "none",
                      color: "#111",
                      fontSize: 14,
                      width: "100%",
                      boxSizing: "border-box",
                      minHeight: 44,
                    }}
                  >
                    📷 Add pictures ({draft.images.length}/5)
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const newImages = Array.from(e.target.files ?? []);
                        const combined = [...draft.images, ...newImages];
                        // Keep only the last 5 images
                        const limited = combined.slice(-5);
                        setDraft({
                          ...draft,
                          images: limited,
                        });
                      }}
                      style={{
                        display: "none",
                      }}
                    />
                  </label>

                  {/* Image Preview Gallery */}
                  {draft.images.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 10,
                        overflow: "hidden",
                      }}
                    >
                      {draft.images.map((file, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: "relative",
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`preview-${idx}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                          <button
                            onClick={() => {
                              const updated = draft.images.filter((_, i) => i !== idx);
                              setDraft({ ...draft, images: updated });
                            }}
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "rgba(0,0,0,0.6)",
                              color: "white",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: "bold",
                            }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as PinCategory })}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    minHeight: 44,
                    fontSize: 16,
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Location: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </div>

                <button
                  onClick={onSubmitDraft}
                  disabled={!draft.title.trim()}
                  style={{
                    marginTop: 6,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    cursor: draft.title.trim() ? "pointer" : "not-allowed",
                    background: draft.title.trim() ? "#111" : "rgba(0,0,0,0.25)",
                    color: "white",
                    fontWeight: 700,
                    minHeight: 44,
                    fontSize: 16,
                  }}
                >
                  Create pin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile modal */}
        <ProfileModal
          open={profileOpen}
          onClose={async () => {
            setProfileOpen(false);
            try {
              const p = await getMyProfile();
              setAvatarUrl(p.avatar_url ?? "");
            } catch {
              // ignore
            }
          }}
          onSignedOut={() => {
            // App.tsx will switch to AuthPage automatically
          }}
        />

        {/* Tips Viewer Modal */}
        {tipsViewerOpen && viewerTips.length > 0 && (
          <div
            onClick={() => {
              setTipsViewerOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              zIndex: 10000,
              padding: isMobile ? 0 : 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>� Tips</div>
              <button
                onClick={() => {
                  setTipsViewerOpen(false);
                  // Show the post-it again when viewer is closed
                  const tipsPostit = document.querySelector<HTMLDivElement>('[data-tips-postit]');
                  if (tipsPostit) {
                    tipsPostit.style.display = 'flex';
                  }
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: 0,
                  color: "#333",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {viewerTips.map((tip, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 10,
                    cursor: "pointer",
                    alignItems: "flex-start",
                    padding: "6px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedTips.has(idx)}
                    onChange={(e) => {
                      const updated = new Set(checkedTips);
                      if (e.target.checked) {
                        updated.add(idx);
                      } else {
                        updated.delete(idx);
                      }
                      setCheckedTips(updated);
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: "pointer",
                      marginTop: 0,
                      accentColor: "#333",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ 
                    fontSize: 13, 
                    opacity: checkedTips.has(idx) ? 0.5 : 1, 
                    textDecoration: checkedTips.has(idx) ? "line-through" : "none",
                    lineHeight: "1.4",
                    wordBreak: "break-word",
                  }}>
                    {tip}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && deleteConfirmPinId && (
          <div
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmPinId(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(400px, 100%)",
                background: "white",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
                color: "#111",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, lineHeight: 1.4 }}>
                Are you sure you want to delete your pin? 😢
              </div>
              <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 24 }}>
                It looked like a great place!
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteConfirmPinId(null);
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "white",
                    color: "#111",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  No
                </button>
                <button
                  onClick={() => {
                    onConfirmDelete(deleteConfirmPinId);
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#dc2626",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}