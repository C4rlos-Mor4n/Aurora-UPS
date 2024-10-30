import { addKeyword, EVENTS } from "@builderbot/bot";
import { User } from "../services";
import { Registroflow } from "./Registro.flow";
export const InitFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, { gotoFlow, flowDynamic }) => {
    const number = ctx.from;
    const findUser = await User.findOne({ number });
    if (!findUser) {
      return gotoFlow(Registroflow);
    }

    await flowDynamic(
      "✅ Ya estás registrado, te notificaremos cuando haya tareas pendientes o esten cercas de su fecha de entrega 📅"
    );
  }
);
