import { imgLightbox } from "../../lib/imageTransforms";

/**
 * Imperative full-screen image lightbox with prev/next controls.
 * Kept as plain DOM (not a React component) — it's a one-shot overlay
 * triggered from popup click handlers with no React state to synchronize.
 */
export function showImageLightbox(urls: string[]): void {
  if (!urls.length) return;
  let currentIndex = 0;

  const lightbox = document.createElement("div");
  Object.assign(lightbox.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: "10000", padding: "16px", cursor: "pointer",
    flexDirection: "column",
  } as CSSStyleDeclaration);

  const img = document.createElement("img");
  Object.assign(img.style, {
    maxWidth: "90vw", maxHeight: "70vh", objectFit: "contain",
    borderRadius: "8px", cursor: "default",
  } as CSSStyleDeclaration);

  const update = () => { img.src = imgLightbox(urls[currentIndex]); };
  update();
  lightbox.appendChild(img);

  if (urls.length > 1) {
    const controls = document.createElement("div");
    Object.assign(controls.style, {
      display: "flex", gap: "12px", marginTop: "16px",
      alignItems: "center", color: "white",
    } as CSSStyleDeclaration);

    const counter = document.createElement("div");
    counter.style.fontSize = "14px";
    counter.textContent = `${currentIndex + 1} / ${urls.length}`;

    const mkBtn = (label: string, delta: number) => {
      const b = document.createElement("button");
      b.textContent = label;
      Object.assign(b.style, {
        padding: "8px 12px", borderRadius: "6px", border: "1px solid white",
        background: "rgba(255,255,255,0.2)", color: "white",
        cursor: "pointer", fontWeight: "bold",
      } as CSSStyleDeclaration);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + delta + urls.length) % urls.length;
        update();
        counter.textContent = `${currentIndex + 1} / ${urls.length}`;
      });
      return b;
    };

    controls.appendChild(mkBtn("← Prev", -1));
    controls.appendChild(counter);
    controls.appendChild(mkBtn("Next →", +1));
    lightbox.appendChild(controls);
  }

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.remove();
  });
  const esc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      lightbox.remove();
      document.removeEventListener("keydown", esc);
    }
  };
  document.addEventListener("keydown", esc);
  document.body.appendChild(lightbox);
}
