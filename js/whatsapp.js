// Armado de mensajes y links de WhatsApp (wa.me). No usa ninguna API paga:
// el mensaje queda escrito y la persona solo toca "Enviar".

/** Reemplaza {clave} por su valor. Las claves sin valor se dejan tal cual. */
export function armarMensaje(plantilla, vars) {
  return plantilla.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== "" ? vars[k] : m));
}

/** Link wa.me con el texto ya cargado. El número va en formato 549 + característica + número. */
export function linkWhatsApp(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
