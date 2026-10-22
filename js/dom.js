// Ayudante mínimo para armar HTML desde JS sin librerías.
// h("button", { class: "btn", onclick: fn }, "Texto", otroNodo)
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}

/** Como contenedor.replaceChildren(...) pero acepta listas anidadas y valores vacíos. */
export function reemplazar(contenedor, ...hijos) {
  contenedor.replaceChildren(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
}
