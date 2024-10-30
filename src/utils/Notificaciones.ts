import { Avac } from "~/services";
import { Task } from "~/services/Db";
import { Document } from "mongoose";
import axios from "axios";
import config from "~/config";

interface TareaPendiente {
  name: string;
  timestart: number;
  description?: string;
}

interface TareaBD extends Document {
  _id: string;
  name: string;
  fecha: string;
  hora: string;
  description: string;
  userPhone: string;
  notifiedInitially: boolean;
  notifiedBeforeDeadline: boolean;
}

const obtenerFechaHora = (timestamp: number) => {
  if (!timestamp) return { fecha: "Fecha inválida", hora: "Hora inválida" };
  const fechaLocal = new Date(timestamp * 1000);
  return {
    fecha: fechaLocal.toLocaleDateString("es-ES", {
      timeZone: "America/Guayaquil",
    }),
    hora: fechaLocal.toLocaleTimeString("es-ES", {
      timeZone: "America/Guayaquil",
    }),
  };
};

function obtenerTextoPlano(html: string, maxLength: number = 200): string {
  if (!html) return "No hay descripción disponible.";

  // Eliminar etiquetas HTML
  let text = html.replace(/<[^>]*>/g, "");

  // Reemplazar entidades HTML comunes
  const entidades: { [key: string]: string } = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&lt;": "<",
    "&gt;": ">",
  };
  for (const entidad in entidades) {
    const regex = new RegExp(entidad, "g");
    text = text.replace(regex, entidades[entidad]);
  }

  // Truncar si es necesario
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "...";
  }

  return text.trim();
}

async function notificarUsuario(phone: string, mensaje: string) {
  try {
    console.log(`Enviando notificación a ${phone}: ${mensaje}`);
    const response = await axios.post(`${config.API_URL}/v1/messages`, {
      number: phone,
      message: mensaje,
    });
    console.log("[Notificaciones] Notificación enviada:", response.data);
  } catch (error: any) {
    console.error(`Error al enviar notificación a ${phone}: ${error.message}`);
  }
}

async function verificarTareasPendientesYNotificar(phone: string) {
  const avac = new Avac();

  let tareasPendientes: TareaPendiente[] = [];
  let tareasAtrasadas: TareaPendiente[] = [];

  try {
    const pendientesDataArray = await avac.GetTareasPendientes(phone);
    const atrasadasDataArray = await avac.GetTareasAtrasadas(phone);

    if (
      Array.isArray(pendientesDataArray) &&
      pendientesDataArray.length > 0 &&
      !pendientesDataArray[0].error &&
      pendientesDataArray[0].data &&
      Array.isArray(pendientesDataArray[0].data.events)
    ) {
      tareasPendientes = pendientesDataArray[0].data.events;
    }

    if (
      Array.isArray(atrasadasDataArray) &&
      atrasadasDataArray.length > 0 &&
      !atrasadasDataArray[0].error &&
      atrasadasDataArray[0].data &&
      Array.isArray(atrasadasDataArray[0].data.events)
    ) {
      tareasAtrasadas = atrasadasDataArray[0].data.events;
    }
  } catch (error: any) {
    console.error(`Error al obtener tareas para ${phone}: ${error.message}`);
    return;
  }

  const tareasBD: TareaBD[] = await Task.find({ userPhone: phone });

  // Notificación inicial si no hay tareas previas en la BD
  if (tareasBD.length === 0 && tareasPendientes.length > 0) {
    const logInicial = tareasPendientes
      .filter((tarea) => tarea.name && tarea.timestart)
      .map((tarea) => {
        const { fecha, hora } = obtenerFechaHora(tarea.timestart);
        const descripcion = obtenerTextoPlano(tarea.description);
        return `- ${tarea.name}\nFecha de entrega: ${fecha} a las ${hora}\nDescripción: ${descripcion}`;
      })
      .join("\n\n");

    await notificarUsuario(
      phone,
      `A partir de ahora, te notificaremos cuando haya nuevas tareas, si alguna cambia de fecha, si está próxima a vencer o si está atrasada. ¡Estamos aquí para ayudarte a mantenerte al día!, aquí tienes tus tareas actuales:`
    );
  }

  const nombresTareasPendientes = tareasPendientes.map((tarea) => tarea.name);

  // Identificar tareas completadas
  const tareasCompletadas = tareasBD.filter(
    (t) => !nombresTareasPendientes.includes(t.name)
  );

  if (tareasCompletadas.length > 0) {
    await Task.deleteMany({
      _id: { $in: tareasCompletadas.map((t) => t._id) },
    });
    console.log(
      `Tareas completadas eliminadas de la base de datos: ${tareasCompletadas.length}`
    );

    // Notificar al usuario sobre tareas completadas
    const nombresCompletadas = tareasCompletadas
      .map((t) => `- ${t.name}`)
      .join("\n");
    await notificarUsuario(
      phone,
      `✅ ¡Buen trabajo! Has completado las siguientes tareas:\n${nombresCompletadas}`
    );
  }

  for (const tareaBD of tareasBD) {
    const tareaActualizada = tareasPendientes.find(
      (t) => t.name === tareaBD.name
    );

    if (tareaActualizada) {
      const { fecha, hora } = obtenerFechaHora(tareaActualizada.timestart);
      if (fecha !== tareaBD.fecha || hora !== tareaBD.hora) {
        const descripcion = obtenerTextoPlano(tareaActualizada.description);

        tareaBD.fecha = fecha;
        tareaBD.hora = hora;
        tareaBD.description = descripcion;
        tareaBD.notifiedInitially = false;
        tareaBD.notifiedBeforeDeadline = false;
        await tareaBD.save();
        await notificarUsuario(
          phone,
          `🗓️ La fecha de entrega de la tarea *${tareaBD.name}* ha sido actualizada.\nNueva fecha de entrega: ${fecha} a las ${hora}\n\n📝 Descripción actualizada:\n${descripcion}`
        );
      }
    }

    const esAtrasada = tareasAtrasadas.some(
      (tarea) => tarea.name === tareaBD.name
    );
    if (esAtrasada) {
      console.log(
        `Tarea ${tareaBD.name} está atrasada, no se enviará recordatorio.`
      );
      await notificarUsuario(
        phone,
        `⚠️ La tarea *${tareaBD.name}* está atrasada.\nPor favor, verifica si aún puedes completarla.`
      );
      await Task.deleteOne({ _id: tareaBD._id });
      continue;
    }

    const fechaActual = new Date();

    // Convertir fecha y hora de tareaBD a objeto Date
    const [day, month, year] = tareaBD.fecha.split("/").map(Number);
    const [hours, minutes, seconds] = tareaBD.hora.split(":").map(Number);
    const fechaEntrega = new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds || 0
    );

    const diferenciaDias =
      (fechaEntrega.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24);

    if (!tareaBD.notifiedInitially) {
      const descripcion = tareaBD.description;

      await notificarUsuario(
        phone,
        `🔔 Nueva tarea asignada:\n\n📌 *${tareaBD.name}*\n🗓 Fecha de entrega: ${tareaBD.fecha} a las ${tareaBD.hora}\n\n📝 Descripción:\n${descripcion}\n\nTe notificaremos cuando se acerque la fecha de entrega. ¡No olvides completarla a tiempo!`
      );
      tareaBD.notifiedInitially = true;
      await tareaBD.save();
    } else if (!tareaBD.notifiedBeforeDeadline && diferenciaDias <= 1) {
      await notificarUsuario(
        phone,
        `⏰ Recordatorio: la tarea *${tareaBD.name}* vence pronto.\nFecha de entrega: ${tareaBD.fecha} a las ${tareaBD.hora}\n¡Aún estás a tiempo de completarla!`
      );
      tareaBD.notifiedBeforeDeadline = true;
      await tareaBD.save();
    }
  }

  // Guardar nuevas tareas que aún no están en la base de datos
  const tareasEnBD = tareasBD.map((t) => ({
    name: t.name,
    fecha: t.fecha,
    hora: t.hora,
  }));

  const tareasNuevas = tareasPendientes.filter((tarea) => {
    const { fecha, hora } = obtenerFechaHora(tarea.timestart);
    return !tareasEnBD.some(
      (t) => t.name === tarea.name && t.fecha === fecha && t.hora === hora
    );
  });

  for (const tarea of tareasNuevas) {
    if (tarea.name && tarea.timestart) {
      const { fecha, hora } = obtenerFechaHora(tarea.timestart);
      const descripcion = obtenerTextoPlano(tarea.description);

      const nuevaTarea = new Task({
        name: tarea.name,
        fecha,
        hora,
        description: descripcion,
        userPhone: phone,
        notifiedInitially: true,
        notifiedBeforeDeadline: false,
      });
      await nuevaTarea.save();

      await notificarUsuario(
        phone,
        `🔔 Nueva tarea asignada:\n\n📌 *${tarea.name}*\n🗓 Fecha de entrega: ${fecha} a las ${hora}\n\n📝 Descripción:\n${descripcion}\n\n¡No olvides comenzar a trabajar en ella!`
      );
    }
  }
}

export { verificarTareasPendientesYNotificar };
