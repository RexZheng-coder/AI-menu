type UploadPreview = {
  file: File;
  previewUrl: string;
};

type UploadPanelProps = {
  files: UploadPreview[];
  error: string | null;
  parseState: "idle" | "validating_files" | "uploading" | "parsing" | "success" | "error";
  hasMenu: boolean;
  isRealMode: boolean;
  onFilesSelected: (files: File[]) => void;
  onClearFiles: () => void;
  onAnalyze: () => void;
  onRetry: () => void;
  onUseSampleMenu: () => void;
};

export function renderUploadPanel(props: UploadPanelProps): HTMLElement {
  const section = document.createElement("section");
  section.className = props.hasMenu ? "upload-panel upload-panel--compact" : "upload-panel";
  section.setAttribute("aria-label", "Upload menu images");

  const copy = document.createElement("div");
  copy.className = "upload-panel__copy";

  const eyebrow = document.createElement("p");
  eyebrow.className = "upload-panel__eyebrow";
  eyebrow.textContent = "Step 1";

  const title = document.createElement("h1");
  title.className = "upload-panel__title";
  title.textContent = props.hasMenu ? "Scan another menu" : "Upload a menu photo";

  const description = document.createElement("p");
  description.className = "upload-panel__description";
  description.textContent = props.isRealMode
    ? "Choose JPG, PNG, or WebP menu images. Real AI parsing runs through the secure local API route."
    : "Choose JPG, PNG, or WebP menu images. Mock mode returns the sample parsed menu for fast UI testing.";

  const modeLabel = document.createElement("p");
  modeLabel.className = "upload-panel__mode";
  modeLabel.textContent = props.isRealMode
    ? "Real AI Mode: uploaded images are parsed by MiMo through the backend."
    : "Mock Demo Mode: uploaded images return the sample parsed menu.";

  copy.append(eyebrow, title, description, modeLabel);

  const guidance = document.createElement("div");
  guidance.className = "upload-guidance";

  const guidanceTitle = document.createElement("p");
  guidanceTitle.className = "upload-guidance__title";
  guidanceTitle.textContent = "For best results";

  const tips = document.createElement("ul");
  tips.className = "upload-guidance__list";

  for (const tip of [
    "Take a clear photo",
    "Avoid glare and shadows",
    "Keep the menu flat",
    "Crop unrelated background",
    "Upload one menu page at a time",
  ]) {
    const item = document.createElement("li");
    item.textContent = tip;
    tips.append(item);
  }

  const privacyNote = document.createElement("p");
  privacyNote.className = "upload-guidance__note";
  privacyNote.textContent = props.isRealMode
    ? "Real AI mode sends uploaded images to the configured AI API."
    : "Mock demo mode uses a sample menu and does not call the AI API.";

  guidance.append(guidanceTitle, tips, privacyNote);
  copy.append(guidance);

  const controls = document.createElement("div");
  controls.className = "upload-panel__controls";

  const inputId = "menu-image-input";
  const pickerLabel = document.createElement("label");
  pickerLabel.className = "file-picker";
  pickerLabel.setAttribute("for", inputId);
  pickerLabel.textContent = "Choose Images";

  const input = document.createElement("input");
  input.id = inputId;
  input.className = "file-input";
  input.type = "file";
  input.accept = "image/jpeg,image/jpg,image/png,image/webp";
  input.multiple = true;
  input.disabled = isBusy(props.parseState);
  input.addEventListener("change", () => {
    props.onFilesSelected(Array.from(input.files ?? []));
    input.value = "";
  });

  const actions = document.createElement("div");
  actions.className = "upload-actions";

  const analyzeButton = document.createElement("button");
  analyzeButton.className = "analyze-button";
  analyzeButton.type = "button";
  analyzeButton.disabled = props.files.length === 0 || isBusy(props.parseState);
  analyzeButton.textContent = getAnalyzeButtonText(props.parseState);
  analyzeButton.addEventListener("click", props.onAnalyze);

  const clearButton = document.createElement("button");
  clearButton.className = "clear-upload-button";
  clearButton.type = "button";
  clearButton.disabled = props.files.length === 0 || isBusy(props.parseState);
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", props.onClearFiles);

  const sampleButton = document.createElement("button");
  sampleButton.className = "sample-menu-button";
  sampleButton.type = "button";
  sampleButton.disabled = isBusy(props.parseState);
  sampleButton.textContent = "Use Sample Menu";
  sampleButton.addEventListener("click", props.onUseSampleMenu);

  actions.append(analyzeButton, clearButton, sampleButton);
  controls.append(pickerLabel, input, actions);

  const status = document.createElement("div");
  status.className = "upload-status";
  status.append(renderParseStatus(props.parseState));
  status.append(renderSelectedFiles(props.files));

  if (props.error) {
    status.append(renderErrorPanel(props));
  }

  section.append(copy, controls, status);
  return section;
}

function renderParseStatus(parseState: UploadPanelProps["parseState"]): HTMLElement {
  const status = document.createElement("p");
  status.className = `parse-status parse-status--${parseState}`;
  status.textContent = getParseStatusText(parseState);
  return status;
}

function renderErrorPanel(props: UploadPanelProps): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "upload-error-panel";
  panel.setAttribute("role", "alert");

  const message = document.createElement("p");
  message.className = "upload-error";
  message.textContent = props.error ?? "Menu parsing failed. Please try again.";

  const actions = document.createElement("div");
  actions.className = "upload-error-actions";

  const retryButton = document.createElement("button");
  retryButton.className = "retry-upload-button";
  retryButton.type = "button";
  retryButton.disabled = props.files.length === 0 || isBusy(props.parseState);
  retryButton.textContent = "Retry";
  retryButton.addEventListener("click", props.onRetry);

  const clearButton = document.createElement("button");
  clearButton.className = "clear-upload-button";
  clearButton.type = "button";
  clearButton.disabled = isBusy(props.parseState);
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", props.onClearFiles);

  const sampleButton = document.createElement("button");
  sampleButton.className = "sample-menu-button";
  sampleButton.type = "button";
  sampleButton.disabled = isBusy(props.parseState);
  sampleButton.textContent = "Use Mock Demo Mode";
  sampleButton.addEventListener("click", props.onUseSampleMenu);

  actions.append(retryButton, clearButton, sampleButton);
  panel.append(message, actions);
  return panel;
}

function isBusy(parseState: UploadPanelProps["parseState"]): boolean {
  return parseState === "validating_files" || parseState === "uploading" || parseState === "parsing";
}

function getAnalyzeButtonText(parseState: UploadPanelProps["parseState"]): string {
  if (parseState === "validating_files") {
    return "Checking files...";
  }

  if (parseState === "uploading") {
    return "Uploading...";
  }

  if (parseState === "parsing") {
    return "Parsing menu...";
  }

  return "Scan Menu";
}

function getParseStatusText(parseState: UploadPanelProps["parseState"]): string {
  switch (parseState) {
    case "validating_files":
      return "Checking selected images...";
    case "uploading":
      return "Uploading images...";
    case "parsing":
      return "Parsing menu...";
    case "success":
      return "Menu parsed successfully.";
    case "error":
      return "Menu parsing needs attention.";
    case "idle":
      return "Ready to scan.";
  }
}

function renderSelectedFiles(files: UploadPreview[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "upload-preview-list";

  if (files.length === 0) {
    const empty = document.createElement("p");
    empty.className = "upload-empty";
    empty.textContent = "No images selected yet.";
    container.append(empty);
    return container;
  }

  for (const filePreview of files) {
    container.append(renderSelectedFile(filePreview));
  }

  return container;
}

function renderSelectedFile(filePreview: UploadPreview): HTMLElement {
  const item = document.createElement("article");
  item.className = "upload-preview";

  const image = document.createElement("img");
  image.className = "upload-preview__image";
  image.src = filePreview.previewUrl;
  image.alt = "";

  const meta = document.createElement("div");
  meta.className = "upload-preview__meta";

  const name = document.createElement("p");
  name.className = "upload-preview__name";
  name.textContent = filePreview.file.name;

  const size = document.createElement("p");
  size.className = "upload-preview__size";
  size.textContent = formatFileSize(filePreview.file.size);

  meta.append(name, size);
  item.append(image, meta);
  return item;
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 1 ? 1 : 2)} MB`;
}
