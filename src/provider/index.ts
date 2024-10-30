import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { createProvider } from "@builderbot/bot";

export default createProvider(Provider, {
  experimentalStore: true,
  timeRelease: 43200000,
});
