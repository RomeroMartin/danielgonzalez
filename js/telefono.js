// Lleva cualquier teléfono argentino al formato de wa.me: 549 + característica + número (13 dígitos).
// Acepta: "221 555-1234", "0221 15 555 1234", "+54 9 221 555 1234", "11 15 5555 1234", etc.
// Devuelve null si no se puede interpretar.
// OJO: es la misma lógica que supabase/functions/crear-turno/index.ts; si se cambia una, cambiar la otra.
export function normalizarTelefono(entrada) {
  let d = String(entrada ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // Quita el "15" de celular que va después de la característica (11 → 2 dígitos; resto 3 o 4)
  if (d.length === 12) {
    const largos = d.startsWith("11") ? [2] : [3, 4];
    for (const a of largos) {
      if (d.slice(a, a + 2) === "15") { d = d.slice(0, a) + d.slice(a + 2); break; }
    }
  }
  return /^\d{10}$/.test(d) ? "549" + d : null;
}

/** "5492215551234" → "221 555-1234" para mostrar. */
export function formatearTelefono(t) {
  const d = String(t).replace(/^549/, "");
  if (d.length !== 10) return String(t);
  const a = d.startsWith("11") ? 2 : 3;   // característica de 2 o 3 dígitos
  const resto = d.slice(a);
  return `${d.slice(0, a)} ${resto.slice(0, -4)}-${resto.slice(-4)}`;
}
