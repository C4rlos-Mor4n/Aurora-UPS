import { getDataFromPage } from "./utils/authAvac";
import { extraerSesskey } from "./utils/extracted";

class Avac {
  async GetSesskey(Phone: string): Promise<any> {
    try {
      if (!Phone) {
        throw new Error("Phone is required");
      }
      const url = "https://avac.ups.edu.ec/presencial65/my";
      const method = "GET";
      const data = await getDataFromPage(url, Phone, "", "", method);
      const sesskey = extraerSesskey(data);
      return sesskey;
    } catch (error) {
      console.log("[Avac] Error al obtener los periodos:", error);
    }
  }

  async GetTareasPendientes(Phone: string): Promise<any> {
    try {
      const sesskey = await this.GetSesskey(Phone);
      const url = `https://avac.ups.edu.ec/presencial65/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`;
      const method = "POST";
      const body = [
        {
          index: 0,
          methodname: "core_calendar_get_action_events_by_timesort",
          args: {
            limitnum: 26,
            timesortfrom: 1728968400,
            limittononsuspendedevents: true,
          },
        },
      ];

      const data = await getDataFromPage(url, Phone, "", "", method, body);
      return data;
    } catch (error) {
      console.log("[Avac] Error al obtener las tareas:", error);
    }
  }

  async GetTareasAtrasadas(Phone: string): Promise<any> {
    try {
      const sesskey = await this.GetSesskey(Phone);
      const url = `https://avac.ups.edu.ec/presencial65/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`;
      const method = "POST";
      const body = [
        {
          index: 0,
          methodname: "core_calendar_get_action_events_by_timesort",
          args: {
            limitnum: 26,
            timesortfrom: 1728968400,
            timesortto: 1730178000,
            limittononsuspendedevents: true,
          },
        },
      ];

      const data = await getDataFromPage(url, Phone, "", "", method, body);
      return data;
    } catch (error) {
      console.log("[Avac] Error al obtener las tareas atrasadas:", error);
    }
  }
}

export default Avac;
