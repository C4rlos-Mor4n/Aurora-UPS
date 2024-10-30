import { createFlow } from "@builderbot/bot";
import { Registroflow } from "./Registro.flow";
import { InitFlow } from "./InitFlow";

export default createFlow([InitFlow, Registroflow]);
