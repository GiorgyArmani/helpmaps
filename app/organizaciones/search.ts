/**
 * La búsqueda del directorio de `/organizaciones`, sin nada de servidor: la usa el buscador
 * en el teléfono mientras se escribe (`OrgFinder.tsx`). Son unos cientos de nombres, y
 * filtrarlos aquí es instantáneo; ir al servidor en cada tecla sería esperar a la señal.
 */

/** Minúsculas, sin tildes y sin signos: «Fundación "Amigos"» y «fundacion amigos» son lo mismo. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * Las que contienen TODAS las palabras buscadas, en cualquier orden. Primero las que
 * empiezan por lo escrito: quien teclea «casa hogar» busca «Casa Hogar …», no un punto
 * que dice «hogar» en mitad del nombre.
 */
export function searchDirectory<T extends { name: string }>(
  entries: T[],
  query: string,
  limit = 8,
): T[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const words = q.split(" ");
  return entries
    .map((e) => ({ e, n: fold(e.name) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((a, b) => Number(b.n.startsWith(q)) - Number(a.n.startsWith(q)) || a.n.localeCompare(b.n))
    .slice(0, limit)
    .map(({ e }) => e);
}
