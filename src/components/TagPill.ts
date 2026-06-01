export function renderTagPill(label: string): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = label;
  return pill;
}
