import { verificarTareasPendientesYNotificar } from "./utils";
import { MemoryDB as Database } from "@builderbot/bot";
import { createBot } from "@builderbot/bot";
import { Task } from "./services/Db";
import templates from "./templates";
import { Avac } from "./services";
import provider from "./provider";
import config from "./config";
import cron from "node-cron";
import { sendFormattedEmail } from "./services/mail";

const main = async () => {
  const { httpServer, handleCtx } = await createBot(
    {
      flow: templates,
      provider: provider,
      database: new Database(),
    },
    {
      extensions: {
        avac: new Avac(),
      },
    }
  );

  provider.on("message", async (payload) => {
    try {
      await provider.sendPresenceUpdate(payload.from, "composing");
      await provider.vendor.readMessages([payload.key]);
    } catch (error) {
      console.error(error);
    }
  });

  provider.on("require_action", async (payload) => {
    const Send_mail = await sendFormattedEmail({
      title: "⚡Acción Requerida⚡",
      instructions: [
        "Recuerde escanear el código QR lo antes posible.",
        "El código QR se actualiza cada minuto por razones de seguridad.",
        "Si tiene algún problema, comuníquese con Carlos Morán.",
      ],
      qr: payload.payload.qr,
      to: `cmoranv1@est.ups.edu.ec, dpazminom3@est.ups.edu.ec`,
      NAME_BOT: "NOTIFICADOR DE TAREAS",
      event: "require_action",
    });

    if (Send_mail.success) {
      console.log("[INFO]: Email enviado correctamente");
      return;
    } else {
      console.log("[ERROR]: Error al enviar el email:", Send_mail.error);
    }
  });

  provider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end("sended");
    })
  );

  httpServer(+config.PORT);

  cron.schedule("* * * * *", async () => {
    const usuarios = await Task.distinct("userPhone");
    for (const phone of usuarios) {
      await verificarTareasPendientesYNotificar(phone);
    }
  });
};

main();
