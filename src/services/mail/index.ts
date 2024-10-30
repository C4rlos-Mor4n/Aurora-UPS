import nodemailer from "nodemailer";
import config from "~/config";

async function sendFormattedEmail(data: {
  title: string;
  instructions?: string[];
  qr?: string;
  to: string;
  NAME_BOT: string;
  event: string;
}) {
  const transporter = nodemailer.createTransport({
    host: config.HOST_MAIL,
    port: config.PORT_MAIL,
    secure: false,
    auth: {
      user: config.USER_MAIL,
      pass: config.PASS_MAIL,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  let htmlContent;

  if (data.event === "require_action") {
    htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <div style="text-align: center;">
        <img src="https://i.imgur.com/EtoVk3L.png" alt="Logo" style="max-width: 150px; width: 100%; height: auto; margin-bottom: 20px;"
        media="screen and (max-width: 600px)" style="max-width: 100px;"/>
        </div>
        <h1 style="color: #FF4500; text-align: center;">⚡ACCIÓN REQUERIDA⚡</h1>
        <h2 style="margin-top: 30px;">BOT AFECTADO: ${data.NAME_BOT}</h2>
        <p>Por favor, escanee el código QR a continuación para activar el bot.</p>
        <ul style="list-style-type: square; padding-left: 20px;">
          <li>Recuerde escanear el código QR lo antes posible.</li>
          <li>El código QR se actualiza cada minuto por razones de seguridad.</li>
          <li>Si tiene algún problema, comuníquese con Carlos Morán al <a href="tel:+593959623351">+593 959623351</a>.</li>
        </ul>
        <div style="text-align: center; margin-top: 20px;">
          <h3>Escanee el Código QR</h3>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
            data.qr
          )}" alt="QR Code" style="margin-top: 20px;" />
        </div>
        <footer style="margin-top: 30px; text-align: center; font-size: 12px; color: #777;">
          <p>¿Necesita más ayuda? Contáctenos en <a href="mailto:Carlosmoran.v28@gmail.com">Carlosmoran.v28@gmail.com</a>.</p>
        </footer>
      </div>
    `;
  } else if (data.event === "ready") {
    htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <div style="text-align: center;">
              <img src="https://i.imgur.com/EtoVk3L.png" alt="Logo" style="max-width: 150px; width: 100%; height: auto; margin-bottom: 20px;"
              media="screen and (max-width: 600px)" style="max-width: 100px;"/>
              </div>
        <h1 style="color: #28a745; text-align: center;">✅ BOT CONECTADO</h1>
        <h2 style="margin-top: 30px;">BOT: ${data.NAME_BOT}</h2>
        <p>El bot se ha conectado exitosamente y está listo para usar.</p>
        <footer style="margin-top: 30px; text-align: center; font-size: 12px; color: #777;">
          <p>¿Necesita más ayuda? Contáctenos en <a href="mailto:Carlosmoran.v28@gmail.com">Carlosmoran.v28@gmail.com</a>.</p>
        </footer>
      </div>
    `;
  }

  const mailOptions = {
    from: `"JCC ¡Internet sin Límites!" <${config.USER_MAIL}>`,
    to: data.to,
    subject:
      data.event === "require_action"
        ? "🚀 Acción Requerida: Escanee el Código QR para Activar el Bot"
        : "✅ Bot Conectado Exitosamente",
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export { sendFormattedEmail };
