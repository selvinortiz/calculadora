import { randomBytes, randomInt, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

const WORDS = [
  "abeja", "acero", "agua", "alba", "aldea", "aliso", "arena", "arpa",
  "ave", "barco", "bosque", "brisa", "cafe", "campo", "canal", "canto",
  "cedro", "cielo", "cima", "ciruela", "clave", "cobre", "colina", "coral",
  "costa", "cristal", "dalia", "duna", "eco", "faro", "flor", "fuego",
  "girasol", "grano", "hoja", "isla", "jade", "jardin", "lago", "laurel",
  "lima", "lirio", "loma", "luna", "maiz", "mapa", "mar", "menta",
  "miel", "monte", "nido", "norte", "nube", "olivo", "onda", "palma",
  "papel", "piedra", "pino", "playa", "pluma", "prado", "puente", "rama",
  "rio", "roble", "roca", "rosa", "ruta", "sal", "selva", "sol",
  "sur", "tierra", "trigo", "valle", "vela", "verde", "via", "viento",
  "azul", "bambu", "bahia", "cacao", "camino", "canelo", "cascada", "cerezo",
  "coco", "cometa", "espejo", "estrella", "fruta", "gaviota", "granito", "hiedra",
  "higo", "laguna", "lucero", "mango", "mesa", "molino", "ocaso", "orilla",
  "pasto", "perla", "pilar", "pueblo", "rayo", "semilla", "sendero", "sierra",
  "tamarindo", "teja", "tesoro", "tulipan", "uva", "ventana", "violeta", "volcan",
  "amaranto", "ambar", "canela", "cipres", "granada", "jazmin", "limon", "naranja",
];

export function generateMemorableCode() {
  const words = Array.from(
    { length: 4 },
    () => WORDS[randomInt(WORDS.length)],
  );
  return words.join("-");
}

export function createCodeHash(code) {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function readPortalUsersFromEnv(source) {
  const assignment = findPortalUsersAssignment(source);
  if (!assignment) return [];
  return parsePortalUsersValue(assignment.value);
}

export function writePortalUsersToEnv(source, users) {
  const assignment = findPortalUsersAssignment(source);
  const lines = source.split(/\r?\n/);
  const replacement = formatPortalUsersAssignment(users);

  if (assignment) {
    lines.splice(
      assignment.startLine,
      assignment.endLine - assignment.startLine + 1,
      replacement,
    );
    return `${lines.join("\n").replace(/\n+$/, "")}\n`;
  }

  const prefix = source.trimEnd();
  return `${prefix}${prefix ? "\n\n" : ""}${replacement}\n`;
}

function findPortalUsersAssignment(source) {
  const lines = source.split(/\r?\n/);
  const startLine = lines.findIndex((line) => /^PORTAL_USERS\s*=/.test(line));
  if (startLine < 0) return null;

  const initialValue = lines[startLine].replace(/^PORTAL_USERS\s*=\s*/, "");
  let value = initialValue;

  for (let endLine = startLine; endLine < lines.length; endLine += 1) {
    if (endLine > startLine) value += `\n${lines[endLine]}`;
    try {
      parsePortalUsersValue(value);
      return { startLine, endLine, value };
    } catch {
      // Continue until the complete JSON value has been collected.
    }
  }

  throw new Error("PORTAL_USERS en .env.local no contiene JSON válido.");
}

function parsePortalUsersValue(value) {
  const trimmed = value.trim();
  let json = trimmed;

  if (trimmed.startsWith('"')) {
    json = JSON.parse(trimmed.replaceAll("\\$", "$"));
  } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    json = trimmed.slice(1, -1).replaceAll("\\$", "$");
  } else {
    json = trimmed.replaceAll("\\$", "$");
  }

  const users = JSON.parse(json);
  if (!Array.isArray(users)) {
    throw new Error("PORTAL_USERS debe ser una lista JSON.");
  }
  return users;
}

function formatPortalUsersAssignment(users) {
  const json = JSON.stringify(users);
  return `PORTAL_USERS=${json.replaceAll("$", "\\$")}`;
}

async function runInteractive() {
  const prompts = createInterface({ input: process.stdin, output: process.stdout });

  try {
    process.stdout.write("Configurar acceso de operador\n\n");
    const email = await askForEmail(prompts);
    const name = (await prompts.question("Nombre (opcional): ")).trim();
    const company = (await prompts.question("Empresa (opcional): ")).trim();
    const requestedCode = (
      await prompts.question("Código (opcional; presiona Enter para generarlo): ")
    ).trim();
    const code = requestedCode || generateMemorableCode();

    if (code.length < 4 || code.length > 128) {
      throw new Error("El código debe contener entre 4 y 128 caracteres.");
    }

    const envPath = resolve(process.cwd(), ".env.local");
    const envSource = await readOptionalFile(envPath);
    const users = readPortalUsersFromEnv(envSource);
    const normalizedEmail = email.toLocaleLowerCase("en-US");
    const existingIndex = users.findIndex(
      (user) =>
        typeof user?.email === "string" &&
        user.email.trim().toLocaleLowerCase("en-US") === normalizedEmail,
    );

    if (existingIndex >= 0) {
      const confirmation = (
        await prompts.question("Ese correo ya existe. ¿Reemplazar su acceso? (s/N): ")
      ).trim().toLocaleLowerCase("es-GT");
      if (confirmation !== "s" && confirmation !== "si" && confirmation !== "sí") {
        process.stdout.write("No se realizaron cambios.\n");
        return;
      }
    }

    const existing = existingIndex >= 0 ? users[existingIndex] : undefined;
    const operator = {
      name: name || existing?.name || email,
      company: company || existing?.company || "Prestamista independiente",
      email,
      codeHash: createCodeHash(code),
    };
    const updatedUsers = [...users];
    if (existingIndex >= 0) updatedUsers[existingIndex] = operator;
    else updatedUsers.push(operator);

    await writeFile(
      envPath,
      writePortalUsersToEnv(envSource, updatedUsers),
      { encoding: "utf8", mode: 0o600 },
    );

    process.stdout.write(
      `\nAcceso ${existingIndex >= 0 ? "actualizado" : "creado"}.\n` +
        `Correo: ${email}\n` +
        `Nombre: ${operator.name}\n` +
        `Empresa: ${operator.company}\n` +
        `Código de acceso: ${code}\n\n` +
        "PORTAL_USERS se guardó en .env.local.\n\n" +
        "Valor para Vercel (sin escapar los signos $):\n" +
        `${JSON.stringify(updatedUsers)}\n`,
    );
  } finally {
    prompts.close();
  }
}

async function askForEmail(prompts) {
  while (true) {
    const email = (await prompts.question("Correo electrónico: ")).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254) {
      return email;
    }
    process.stdout.write("Ingresa un correo electrónico válido.\n");
  }
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return "";
    throw error;
  }
}

async function run() {
  const codeWasProvided = process.argv.length >= 3;
  if (!codeWasProvided) {
    await runInteractive();
    return;
  }

  const code = process.argv[2];

  if (code.length < 4 || code.length > 128) {
    process.stderr.write(
      "El código debe contener entre 4 y 128 caracteres.\n",
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${createCodeHash(code)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
