import { addKeyword, EVENTS } from "@builderbot/bot";
import { Avac, loginAndGetCookies } from "../services";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { verificarTareasPendientesYNotificar } from "~/utils";

export const Registroflow = addKeyword<Provider>(EVENTS.ACTION)
  .addAnswer(
    [
      "🎓 *¡Bienvenido a Aurora!*",
      "",
      "Soy tu asistente virtual de la UPS, diseñada para ayudarte a gestionar tus tareas y mantenerte al día con tus actividades académicas.",
      "",
      "✨ *Primeros pasos:*",
      "Necesito que te registres con tu cuenta institucional:",
      "📧 Formato: nombre.apellido@est.ups.edu.ec",
      "",
      "Por favor, ingresa tu correo institucional:",
    ].join("\n"),
    { capture: true },
    async (ctx, { fallBack, state }) => {
      if (ctx.body.includes("_event_")) {
        return fallBack(
          "❌ *Error de formato*\n\nPor favor, ingresa tu correo institucional como texto.\n\nEjemplo: nombre.apellido@est.ups.edu.ec"
        );
      }

      if (!ctx.body.includes("@est.ups.edu.ec")) {
        return fallBack(
          "⚠️ *Correo no válido*\n\nPor favor, asegúrate de usar tu correo institucional UPS.\n\nEjemplo: nombre.apellido@est.ups.edu.ec"
        );
      }

      await state.update({ email: ctx.body });
    }
  )
  .addAnswer(
    [
      "✅ *¡Excelente!*",
      "",
      "🔐 Ahora necesito tu contraseña institucional para acceder al AVAC.",
      "Tu información está segura y solo se usa para consultar tus tareas.",
      "",
      "Por favor, ingresa tu contraseña:",
    ].join("\n"),
    {
      capture: true,
    },
    async (ctx, { fallBack, state, flowDynamic, gotoFlow }) => {
      try {
        if (ctx.body.includes("_event_")) {
          return fallBack(
            "❌ *Error de formato*\n\nPor favor, ingresa tu contraseña como texto."
          );
        }

        await state.update({ password: ctx.body });

        await flowDynamic(
          [
            "⌛ *Iniciando sesión...*",
            "",
            "Por favor, espera un momento mientras verifico tus credenciales.",
          ].join("\n")
        );

        const login = await loginAndGetCookies(
          ctx.from,
          await state.get("password"),
          await state.get("email")
        );

        if (!login) {
          await flowDynamic(
            "🚫 *Error de autenticación*\n\nLa contraseña ingresada no es correcta.\n\nPor favor, verifica e intenta nuevamente."
          );
          return gotoFlow(Registroflow);
        }

        await flowDynamic(
          [
            "🎉 *¡Registro exitoso!*",
            "",
            "A partir de ahora recibirás notificaciones sobre tus tareas pendientes.",
            "",
            "📚 Estoy verificando tus actividades...",
          ].join("\n")
        );

        const phone = ctx.from;
        await verificarTareasPendientesYNotificar(phone);
      } catch (error) {
        console.log("[RegistroFlow] Error al iniciar sesión:", error);
        return await flowDynamic(
          "⚠️ *Ocurrió un error*\n\nNo pudimos completar el registro. Por favor, intenta nuevamente más tarde."
        );
      }
    }
  );
