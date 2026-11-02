import cron from "node-cron";
import { refreshPrices } from "../services/priceService.ts";

// Lunes a viernes a las 16:00 hora México (después del cierre de BMV y NYSE)
export function startPriceJob() {
  cron.schedule(
    "0 16 * * 1-5",
    async () => {
      console.log("[priceJob] actualizando precios...");
      try {
        const { updated } = await refreshPrices();
        console.log(`[priceJob] ${updated} activos actualizados`);
      } catch (err) {
        console.error("[priceJob] error:", err);
      }
    },
    { timezone: "America/Mexico_City" }
  );
  console.log("[priceJob] cron registrado (lun-vie 16:00 CT)");
}
