import { FACTORY_ROOT } from "@/lib/config";

/**
 * Foundation placeholder. The real Dashboard ("Inicio", FRD-18) and the tabs
 * (Board, Portfolio, Achievements, Configuration, Manual) are built in the
 * work-order phase. This Server Component only proves the app boots and can
 * resolve the factory root from disk (read-only; it never calls Claude).
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Pandacorp Mission Control</h1>
      <p className="mt-2 text-sm opacity-70">
        Cimiento listo. Las vistas (Inicio, Tablero, Cartera, Logros, Configuración, Manual) se
        construyen en la fase de work orders.
      </p>
      <p className="mt-4 text-xs opacity-50">
        Raíz de la fábrica: <code>{FACTORY_ROOT}</code>
      </p>
    </main>
  );
}
