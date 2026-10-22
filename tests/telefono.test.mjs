// node tests/telefono.test.mjs
import assert from "node:assert/strict";
import { normalizarTelefono, formatearTelefono } from "../js/telefono.js";

const casos = {
  "221 555-1234": "5492215551234", "0221 15 555 1234": "5492215551234", "+54 9 221 555 1234": "5492215551234",
  "11 15 5555 1234": "5491155551234", "(011) 4555-1234": "5491145551234", "54 221 5551234": "5492215551234",
  "12345": null, "": null, "abc": null,
};
for (const [entrada, esperado] of Object.entries(casos)) assert.equal(normalizarTelefono(entrada), esperado, entrada);
assert.equal(formatearTelefono("5492215551234"), "221 555-1234");
assert.equal(formatearTelefono("5491155551234"), "11 5555-1234");
console.log("telefono: TODO OK");
