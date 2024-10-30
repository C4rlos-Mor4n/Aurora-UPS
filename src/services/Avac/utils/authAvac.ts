import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Url, User } from "../../../services/Db";
import puppeteer from "puppeteer";
import FormData from "form-data";

const MAX_RETRY_COUNT = 1;

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  size?: number;
  httpOnly?: boolean;
  secure?: boolean;
  session?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

async function saveUserDataToDB(
  number: string,
  username: string,
  password: string,
  cookies: Cookie[],
  Model?: string
): Promise<void> {
  await User.findOneAndUpdate(
    { number },
    { number, username, password, cookies, Model },
    { upsert: true, new: true }
  );
  console.log("Datos del usuario y cookies guardados en la base de datos.");
}

async function readCookiesFromDB(number: string): Promise<Cookie[] | null> {
  const user = await User.findOne({ number });
  return user ? (user.cookies as any) : null;
}

async function loginAndGetCookies(
  number: string,
  password?: string,
  email?: string,
  forceLogin = false
): Promise<Cookie[]> {
  const user = await User.findOne({ number });

  if (user && !forceLogin) {
    const cookies = user.cookies;
    if (cookies) {
      console.log("Usando cookies existentes de la base de datos.");
      return cookies as any;
    }
  }

  if (!user && !email) {
    throw new Error(
      "No se encontró el usuario y no se proporcionó un correo para registrarlo."
    );
  }

  console.log("Realizando login para obtener nuevas cookies...");

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const page = await browser.newPage();

  try {
    let url = await Url.findOne({ name: "avac" });
    if (!url) {
      const newUrl = await Url.create({
        url: "https://avac.ups.edu.ec/presencial65/auth/oidc",
        name: "avac",
      });
      url = newUrl;
    }

    await page.goto(url.url, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("body", { timeout: 10000, visible: true });

    console.log("Iniciando sesión con credenciales...");
    await page.evaluate(() => {
      const emailInput = document.getElementById("i0116") as HTMLInputElement;
      if (emailInput) {
        emailInput.value = "";
      }
    });

    const emailUser = email ?? user!.username;
    const passwordUser = password ?? user!.password;

    await page.waitForSelector("#i0116", { visible: true, timeout: 5000 });
    await page.type("#i0116", emailUser);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      page.click("#idSIButton9"),
    ]);

    await page.focus("#i0118");

    await page.type("#i0118", passwordUser);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      page.click("#idSIButton9"),
    ]);

    try {
      await page.waitForSelector("#idSIButton9", {
        visible: true,
        timeout: 5000,
      });
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
        page.click("#idSIButton9"),
      ]);
    } catch (error) {
      console.log(
        "No se encontró la pantalla de 'Mantener sesión iniciada' o ya se procesó."
      );
    }

    try {
      const kmsiButton = await page.waitForSelector(
        'input#idSIButton9[value="Sí"]',
        { timeout: 10000 }
      );
      if (kmsiButton) {
        console.log("Haciendo clic en 'Sí' para mantener la sesión.");
        await kmsiButton.click();
        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 60000,
        });
      }
    } catch (kmsiError) {
      console.log(
        "No se mostró la opción 'Mantenerme conectado'. Continuando..."
      );
    }

    const newCookies = await page.cookies();
    const domainValid = newCookies.find(
      (cookie) =>
        cookie.domain === "avac.ups.edu.ec" && cookie.name === "MoodleSession"
    );

    if (!domainValid) {
      console.log("Error de autenticación: Cookie de sesión no encontrada.");
      return null;
    }

    console.log(
      "Autenticación exitosa, guardando nuevas cookies en la base de datos..."
    );
    await saveUserDataToDB(number, emailUser, passwordUser, newCookies);
    return newCookies;
  } catch (error) {
    console.error("Error durante el proceso de inicio de sesión:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function fetchWithRetry(
  url: string,
  number: string,
  password?: string,
  email?: string,
  method: "GET" | "POST" = "GET",
  body?: FormData | URLSearchParams | any,
  retryCount = 0
): Promise<any> {
  try {
    const cookies =
      (await readCookiesFromDB(number)) ||
      (await loginAndGetCookies(number, password, email, true)) ||
      (await loginAndGetCookies(number, "", "", true));

    const headers = {
      Cookie: cookies.map((ck) => `${ck.name}=${ck.value}`).join("; "),
    };

    const config: AxiosRequestConfig = {
      method,
      headers,
      data: body,
    };

    if (body instanceof URLSearchParams) {
      config.headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (body instanceof FormData) {
      config.headers = { ...config.headers, ...body.getHeaders() };
    }

    const response: AxiosResponse = await axios(url, config);

    if (!response.data.includes("window.location='login.php'")) {
      return response.data;
    } else {
      throw new Error("Sesión expirada, necesita re-autenticación.");
    }
  } catch (error: any) {
    console.error(`Error durante la solicitud a ${url}: ${error.message}`);

    const shouldRetry =
      retryCount < MAX_RETRY_COUNT &&
      (error.response?.status === 401 || // Unauthorized
        error.response?.status === 403 || // Forbidden
        !error.response || // Network or timeout errors
        error.message.includes("timeout"));

    if (shouldRetry) {
      console.log("Intentando reautenticación y reintento...");
      await loginAndGetCookies(number, "", "", true);
      return fetchWithRetry(
        url,
        number,
        password,
        email,
        method,
        body,
        retryCount + 1
      );
    } else {
      throw new Error(
        `Máximo de intentos alcanzado para ${url}: ${error.message}`
      );
    }
  }
}

async function getDataFromPage(
  url: string,
  number: string,
  password?: string,
  email?: string,
  method: "GET" | "POST" = "GET",
  body?: FormData | URLSearchParams | any
): Promise<any> {
  try {
    return await fetchWithRetry(url, number, password, email, method, body);
  } catch (error) {
    console.error("Error obteniendo datos:", error);
    return null;
  }
}

export { getDataFromPage, loginAndGetCookies };
