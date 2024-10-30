import * as cheerio from "cheerio";

function extraerSesskey(html: string): string | null {
  const $ = cheerio.load(html);

  const scriptContent = $("script")
    .toArray()
    .map((el) => $(el).html())
    .find((text) => text && text.includes("sesskey"));

  if (!scriptContent) {
    return null;
  }

  const match = scriptContent.match(/"sesskey":"(.*?)"/);
  return match ? match[1] : null;
}

export { extraerSesskey };
