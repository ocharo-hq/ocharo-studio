import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "@wow-two-beta/ui/foundation/hooks";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FolderHeart,
  Image,
  Layers3,
  Maximize,
  Minus,
  Moon,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scan,
  Shirt,
  Sun,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStudio } from "../application/studio/UseStudio";
import {
  GARMENTS,
  MATERIALS,
  getGarment,
  getMaterial,
} from "../domain/studio/catalog";
import { GarmentGlyph } from "../presentation/studio/GarmentGlyph";
import { StudioViewport } from "../presentation/studio/StudioViewport";
import type { StudioViewportApi } from "../presentation/studio/StudioViewport";
import "./index.css";

type LibraryTab = "garments" | "materials" | "looks";
export function App() {
  const studio = useStudio();
  const [lookName, setLookName] = useState(studio.document.name);
  const [tab, setTab] = useState<LibraryTab>("garments");
  const [filter, setFilter] = useState("All");
  const [dark, setDark] = usePersistentState("uzbek-studio.theme", false);
  const [dialog, setDialog] = useState<"export" | "help" | null>(null);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const scene = useRef<StudioViewportApi | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const garment = getGarment(studio.document.garmentId);
  const part =
    garment.parts.find((item) => item.id === studio.selectedPartId) ??
    garment.parts[0];
  const assignment = studio.document.parts[part.id]!;
  const material = getMaterial(assignment.materialId);

  useEffect(() => {
    setLookName(studio.document.name);
  }, [studio.document.name]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    setReady(false);
  }, [studio.document.garmentId]);
  useEffect(() => {
    if (studio.notice) setToast("");
  }, [studio.notice]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
      if ((event.target as HTMLElement)?.matches("input,textarea,select"))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? studio.redo() : studio.undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        studio.saveLook();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [studio]);

  function capture() {
    if (!scene.current) throw new Error("The preview is still loading.");
    return scene.current.capture();
  }
  function save() {
    try {
      studio.saveLook(makeThumbnail(capture()));
    } catch {
      studio.saveLook();
    }
  }
  function saveCopy() {
    try {
      studio.saveLookAsCopy(makeThumbnail(capture()));
    } catch {
      studio.saveLookAsCopy();
    }
  }
  function exportPreview() {
    studio.clearNotice();
    try {
      download(capture(), `${safeName(studio.document.name)}.png`);
      setToast("Preview exported.");
      setDialog(null);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Preview could not be exported.",
      );
    }
  }
  function exportDocument() {
    studio.clearNotice();
    const url = URL.createObjectURL(
      new Blob([studio.exportLook()], { type: "application/json" }),
    );
    download(url, `${safeName(studio.document.name)}.uzbek.json`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDialog(null);
    setToast("Editable design exported.");
  }

  return (
    <div className="studio-app">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Uzbek Studio home">
          <span className="brand-symbol">
            u<span>✳</span>
          </span>
          <div>
            <strong>
              uzbek<span>studio</span>
            </strong>
            <small>A SPACE TO MAKE IT YOURS</small>
          </div>
        </a>
        <div className="document-heading">
          <span className="document-dot" />
          <input
            aria-label="Look name"
            value={lookName}
            maxLength={80}
            onChange={(event) => setLookName(event.target.value)}
            onBlur={() => {
              if (lookName.trim()) studio.rename(lookName);
              else setLookName(studio.document.name);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span className="draft-status">
            {studio.isDirty ? "Draft" : "Saved"}
          </span>
        </div>
        <div className="header-actions">
          <IconButton
            icon={dark ? Sun : Moon}
            label={dark ? "Use light theme" : "Use dark theme"}
            onClick={() => setDark(!dark)}
          />
          <button
            className="button secondary save-button"
            aria-label="Save look"
            onClick={save}
          >
            <Save size={17} />
            <span>Save look</span>
          </button>
          <button
            className="button primary"
            onClick={() => setDialog("export")}
          >
            <span>Export</span>
            <ArrowDownToLine size={17} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="scene-area">
          <div className="scene-title">
            <span className="eyebrow">THE ATELIER / 01</span>
            <h1>Tradition, reimagined.</h1>
            <p>A silhouette. A textile. Your own expression.</p>
          </div>
          <div className="viewport">
            <StudioViewport
              document={studio.document}
              selectedPartId={part.id}
              onSelectPart={studio.setSelectedPartId}
              onReady={(api) => {
                scene.current = api;
                setReady(true);
              }}
              dark={dark}
            />
          </div>
          <div className="scene-caption">
            <span className="live-dot" /> {garment.name}
            <span className="caption-divider" />
            Fixed-size dress form
          </div>
        </div>

        <aside className="library island" aria-label="Design library">
          <div className="library-tabs" role="tablist" aria-label="Library">
            <Tab
              icon={Shirt}
              label="Garments"
              value="garments"
              current={tab}
              onChange={setTab}
            />
            <Tab
              icon={Palette}
              label="Textiles"
              value="materials"
              current={tab}
              onChange={setTab}
            />
            <Tab
              icon={FolderHeart}
              label="My looks"
              value="looks"
              current={tab}
              onChange={setTab}
            />
          </div>
          <div
            className="library-content"
            role="tabpanel"
            id="library-panel"
            aria-labelledby={`tab-${tab}`}
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR STARTING POINT</span>
                <h2>
                  {tab === "garments"
                    ? "Choose a silhouette"
                    : tab === "materials"
                      ? "The textile room"
                      : "Your collection"}
                </h2>
              </div>
              <span className="count-badge">
                {tab === "garments"
                  ? "05"
                  : tab === "materials"
                    ? "10"
                    : String(studio.looks.length).padStart(2, "0")}
              </span>
            </div>
            <p className="muted library-description">
              {tab === "garments"
                ? "Five forms. Endless possibilities."
                : tab === "materials"
                  ? `One click applies to ${part.name.toLowerCase()}.`
                  : "Saved on this browser. Export to keep a copy."}
            </p>
            {tab === "garments" && (
              <div className="garment-list">
                {GARMENTS.map((item, index) => (
                  <button
                    key={item.id}
                    className={`garment-card ${garment.id === item.id ? "selected" : ""}`}
                    aria-pressed={garment.id === item.id}
                    onClick={() => studio.chooseGarment(item.id)}
                  >
                    <span className={`garment-art art-${item.id}`}>
                      <GarmentGlyph id={item.id} />
                    </span>
                    <span className="garment-copy">
                      <span className="item-number">0{index + 1}</span>
                      <strong>{item.name}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    <span className="selection-dot">
                      {garment.id === item.id && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {tab === "materials" && (
              <>
                <div className="filter-row">
                  {["All", "Ikat", "Stripe", "Solid"].map((value) => (
                    <button
                      key={value}
                      className={filter === value ? "active" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="material-grid">
                  {MATERIALS.filter(
                    (item) => filter === "All" || item.family === filter,
                  ).map((item) => (
                    <button
                      key={item.id}
                      className={`material-card ${item.id === material.id ? "selected" : ""}`}
                      aria-pressed={item.id === material.id}
                      onClick={() => studio.applyMaterial(item.id)}
                    >
                      <span
                        className="material-swatch"
                        style={{
                          backgroundColor: item.color,
                          backgroundImage: item.textureUrl
                            ? `url(${item.textureUrl})`
                            : undefined,
                        }}
                      >
                        {item.id === material.id && (
                          <span className="swatch-check">
                            <Check size={13} />
                          </span>
                        )}
                      </span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.family === "Solid"
                          ? "Solid fabric"
                          : "Generated textile"}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {tab === "looks" && (
              <>
                <button
                  className="button import-button"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={16} />
                  Import a design
                </button>
                <button
                  className="button copy-button secondary"
                  onClick={saveCopy}
                >
                  <Plus size={16} />
                  Save as a new look
                </button>
                {!studio.looks.length ? (
                  <div className="empty-state">
                    <FolderHeart size={34} />
                    <h3>Room for your ideas.</h3>
                    <p>Save your first look to start a collection.</p>
                    <button className="button secondary" onClick={save}>
                      Save this look
                    </button>
                  </div>
                ) : (
                  <div className="saved-list">
                    {studio.looks.map((look) => (
                      <div className="saved-card" key={look.document.id}>
                        <button
                          onClick={() => studio.openLook(look.document.id)}
                          aria-label={`Open ${look.document.name}`}
                        >
                          <span className="saved-preview">
                            {look.thumbnail ? (
                              <img src={look.thumbnail} alt="" />
                            ) : (
                              <GarmentGlyph id={look.document.garmentId} />
                            )}
                          </span>
                          <strong>{look.document.name}</strong>
                          <small>
                            {getGarment(look.document.garmentId).name}
                          </small>
                        </button>
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${look.document.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete “${look.document.name}” from this browser?`,
                              )
                            )
                              studio.deleteLook(look.document.id);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="library-foot">
            <span className="little-star">✳</span>
            <span>
              Rooted in Uzbek craft.
              <br />
              <strong>Made for your imagination.</strong>
            </span>
          </div>
        </aside>

        <div className="context-toolbar island" aria-label="Editing tools">
          <span className="tool-label">
            <MousePointer2 size={17} />
            Select part
          </span>
          <div className="toolbar-divider" />
          <label className="part-select">
            <span className="sr-only">Selected garment part</span>
            <select
              value={part.id}
              onChange={(event) =>
                studio.setSelectedPartId(event.target.value as typeof part.id)
              }
            >
              {garment.parts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
          <div className="toolbar-divider" />
          <IconButton
            icon={Undo2}
            label="Undo"
            onClick={studio.undo}
            disabled={!studio.canUndo}
          />
          <IconButton
            icon={Redo2}
            label="Redo"
            onClick={studio.redo}
            disabled={!studio.canRedo}
          />
        </div>

        <aside
          className="inspector island"
          aria-label="Part and textile settings"
        >
          <div className="inspector-heading">
            <span className="eyebrow">MAKE IT YOURS</span>
            <Layers3 size={18} />
          </div>
          <h2>{part.name}</h2>
          <div className="part-chips">
            {garment.parts.map((item) => (
              <button
                key={item.id}
                className={part.id === item.id ? "active" : ""}
                aria-pressed={part.id === item.id}
                onClick={() => studio.setSelectedPartId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="panel-divider" />
          <div className="label-row">
            <h3>Material</h3>
            <button className="text-button" onClick={() => setTab("materials")}>
              Change <ArrowLeftRight size={12} />
            </button>
          </div>
          <button
            className="current-material"
            onClick={() => setTab("materials")}
          >
            <span
              style={{
                backgroundColor: material.color,
                backgroundImage: material.textureUrl
                  ? `url(${material.textureUrl})`
                  : undefined,
              }}
            />
            <div>
              <strong>{material.name}</strong>
              <small>
                {material.textureUrl ? "Patterned textile" : "Solid fabric"}
              </small>
            </div>
            <ChevronDown size={15} />
          </button>
          <div className="panel-divider" />
          <div className="label-row">
            <h3>Pattern placement</h3>
            <IconButton
              icon={RotateCcw}
              label="Reset pattern placement"
              onClick={studio.resetPlacement}
              disabled={!material.textureUrl}
            />
          </div>
          {material.textureUrl ? (
            <>
              <RangeControl
                onBegin={studio.beginPlacement}
                onEnd={studio.endPlacement}
                label="Rotation"
                icon={RotateCw}
                value={assignment.placement.rotation}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(rotation) => studio.setPlacement({ rotation })}
              />
              <div className="rotation-presets">
                {[-90, 0, 90].map((rotation) => (
                  <button
                    key={rotation}
                    onClick={() => studio.setPlacement({ rotation })}
                  >
                    {rotation}°
                  </button>
                ))}
              </div>
              <RangeControl
                onBegin={studio.beginPlacement}
                onEnd={studio.endPlacement}
                label="Horizontal"
                icon={ArrowLeftRight}
                value={assignment.placement.offsetX}
                min={-1}
                max={1}
                step={0.01}
                suffix=""
                onChange={(offsetX) => studio.setPlacement({ offsetX })}
              />
              <RangeControl
                onBegin={studio.beginPlacement}
                onEnd={studio.endPlacement}
                label="Vertical"
                icon={ArrowUpDown}
                value={assignment.placement.offsetY}
                min={-1}
                max={1}
                step={0.01}
                suffix=""
                onChange={(offsetY) => studio.setPlacement({ offsetY })}
              />
              <p className="control-hint">
                Move the pattern across this part.
                <br />
                The silhouette stays the same.
              </p>
            </>
          ) : (
            <p className="solid-hint">
              Choose a patterned textile to rotate or move its design.
            </p>
          )}
          <div className="attachment-note">
            <span>
              <Check size={14} />
            </span>
            <div>
              <strong>{garment.attachments}</strong>
              <small>Details belong to this silhouette.</small>
            </div>
          </div>
        </aside>

        <div className="camera-tools island" aria-label="Camera controls">
          <div className="camera-presets">
            {(["front", "back", "side"] as const).map((view) => (
              <button key={view} onClick={() => scene.current?.view(view)}>
                {view}
              </button>
            ))}
          </div>
          <div className="toolbar-divider" />
          <IconButton
            icon={Minus}
            label="Zoom out"
            onClick={() => scene.current?.zoom(-0.3)}
          />
          <IconButton
            icon={Plus}
            label="Zoom in"
            onClick={() => scene.current?.zoom(0.3)}
          />
          <IconButton
            icon={Maximize}
            label="Fit garment"
            onClick={() => scene.current?.reset()}
          />
          <IconButton
            icon={Scan}
            label="Inspect fabric detail"
            onClick={() => scene.current?.view("detail")}
          />
        </div>
        <div className="orbit-hint">
          <MousePointer2 size={13} />
          <span>Drag to orbit · Scroll to zoom · Click a part to edit</span>
        </div>
        <button
          className="help-button island"
          aria-label="Studio guide"
          onClick={() => setDialog("help")}
        >
          <CircleHelp size={19} />
        </button>
      </main>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.uzbek.json,application/json"
        className="sr-only"
        aria-label="Import design file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (file.size > 1024 * 1024)
              setToast("Choose a design JSON smaller than 1 MB.");
            else studio.importLook(await file.text());
          }
          event.target.value = "";
        }}
      />
      {(toast || studio.notice) && (
        <div className="toast island" role="status">
          <span>{toast || studio.notice}</span>
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => {
              setToast("");
              studio.clearNotice();
            }}
          />
        </div>
      )}
      {dialog && (
        <StudioDialog
          title={
            dialog === "export"
              ? "Take your idea with you."
              : "Welcome to your atelier."
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "export" ? (
            <>
              <p>Keep a picture, or keep every design decision.</p>
              <button
                className="export-choice"
                onClick={exportPreview}
                disabled={!ready}
              >
                <Image size={25} />
                <span>
                  <strong>Preview image</strong>
                  <small>A clean PNG of your current view</small>
                </span>
                <Download size={18} />
              </button>
              <button className="export-choice" onClick={exportDocument}>
                <Layers3 size={25} />
                <span>
                  <strong>Editable design</strong>
                  <small>A portable JSON file to reopen here</small>
                </span>
                <Download size={18} />
              </button>
              <small className="muted">
                Saved looks stay on this browser. Export a design for backup.
              </small>
            </>
          ) : (
            <>
              <ol className="guide-steps">
                <li>
                  <strong>Choose a silhouette.</strong>
                  <span>Pick one of five fixed-size garments.</span>
                </li>
                <li>
                  <strong>Select a part.</strong>
                  <span>Click the garment or use the part selector.</span>
                </li>
                <li>
                  <strong>Make it your own.</strong>
                  <span>Apply a textile, rotate it, and move its pattern.</span>
                </li>
                <li>
                  <strong>Keep the idea.</strong>
                  <span>
                    Save a look, export a preview, or share its design file.
                  </span>
                </li>
              </ol>
              <div className="guide-note">
                Garment shapes are authored interpretations. Textiles are
                original generated studies. This studio previews visual
                combinations; it does not simulate tailoring or fit.
              </div>
              <button
                className="button primary"
                onClick={() => setDialog(null)}
              >
                Back to creating
              </button>
            </>
          )}
        </StudioDialog>
      )}
    </div>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={1.7} />
    </button>
  );
}
function Tab({
  icon: Icon,
  label,
  value,
  current,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: LibraryTab;
  current: LibraryTab;
  onChange: (tab: LibraryTab) => void;
}) {
  return (
    <button
      role="tab"
      id={`tab-${value}`}
      aria-controls="library-panel"
      tabIndex={current === value ? 0 : -1}
      onKeyDown={(event) => {
        const values: LibraryTab[] = ["garments", "materials", "looks"];
        const index = values.indexOf(value);
        const next =
          event.key === "ArrowRight"
            ? values[(index + 1) % 3]
            : event.key === "ArrowLeft"
              ? values[(index + 2) % 3]
              : event.key === "Home"
                ? values[0]
                : event.key === "End"
                  ? values[2]
                  : undefined;
        if (next) {
          event.preventDefault();
          onChange(next);
          document.getElementById(`tab-${next}`)?.focus();
        }
      }}
      aria-selected={current === value}
      className={current === value ? "active" : ""}
      onClick={() => onChange(value)}
    >
      <Icon size={21} strokeWidth={1.6} />
      <span>{label}</span>
    </button>
  );
}
function RangeControl({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  onBegin,
  onEnd,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
  onBegin: () => void;
  onEnd: () => void;
}) {
  return (
    <label className="range-control">
      <span>
        <Icon size={15} />
        {label}
        <output>
          {step < 1 ? value.toFixed(2) : value}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={onBegin}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onBlur={onEnd}
        onKeyDown={(event) => {
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          )
            onBegin();
        }}
        onKeyUp={onEnd}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
function StudioDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="studio-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-title">
        <h2>{title}</h2>
        <IconButton icon={X} label="Close dialog" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
function download(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}
function safeName(name: string) {
  return (
    name
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .slice(0, 70) || "uzbek-look"
  );
}
function makeThumbnail(data: string): string {
  const source = document.querySelector<HTMLCanvasElement>(".viewport canvas");
  if (!source) return data;
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = Math.round((240 * source.height) / source.width);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.7);
}
