"use client";

/**
 * El correo que se acaba de escribir en `/recuperar`, para no pedirlo otra vez en
 * `/reset`.
 *
 * Es un detalle pequeño con un momento malo detrás: quien llega a escribir el código
 * viene de abrir su correo en otra pestaña o en otro aparato, y tener que teclear también
 * su dirección mientras copia ocho dígitos es donde la gente abandona.
 *
 * `sessionStorage` y NO la URL: una dirección en la barra acaba en los registros de
 * cualquier proxy, en el historial y en el `Referer` de la siguiente petición. Y
 * `sessionStorage` y no `localStorage` porque esto sobra en cuanto se cierra la pestaña —
 * lo que no se guarda no se filtra, que es la regla de todo el proyecto.
 *
 * Se borra sola al terminar. Si la persona abre el código en OTRO navegador no habrá
 * nada guardado y tendrá que escribir su correo, que es lo correcto: no hay nada que
 * recordar de una sesión que nunca existió aquí.
 */

const KEY = "helpmaps:reset:email";

export const rememberResetEmail = {
  write(email: string): void {
    try {
      sessionStorage.setItem(KEY, email);
    } catch {
      // Modo privado o almacenamiento bloqueado: se pide el correo, y ya está.
    }
  },
  read(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nada que limpiar */
    }
  },
};
