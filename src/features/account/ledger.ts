import type { Translate } from "@/i18n";

/**
 * "3 puntos guardados · 1 envío".
 *
 * Un recuento y no un saludo. La cabecera de una cuenta puede decir "Hola, Giorgy" —que no
 * informa de nada— o puede decir qué es esta cuenta en este mapa, y eso son dos números
 * que la persona puede comprobar tocándolos.
 *
 * El plural se elige acá y no con un `{n}` en el diccionario porque las cadenas son
 * planas: "1 puntos guardados" es el tipo de detalle que hace que una aplicación se lea
 * como una traducción automática justo en la pantalla que lleva tu nombre.
 */
export function savedLabel(t: Translate, n: number): string {
  if (n === 0) return t("account.countSavedNone");
  if (n === 1) return t("account.countSavedOne");
  return t("account.countSavedMany", { n });
}

export function sentLabel(t: Translate, n: number): string {
  if (n === 0) return t("account.countSentNone");
  if (n === 1) return t("account.countSentOne");
  return t("account.countSentMany", { n });
}
