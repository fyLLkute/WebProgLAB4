import { Command } from 'commander';
import fs from 'node:fs';
import http from 'node:http';

// ---------- 1. Параметри командного рядка ----------
const program = new Command();

program
  .name('lab4')
  .description('HTTP-сервер, що віддає дані про банки (варіант 1, bank_managers.json)')
  .helpOption('--help', 'показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл, у який записується остання надіслана відповідь');

program.parse();

const options = program.opts();
const port = Number(options.port);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Помилка: порт має бути цілим числом від 0 до 65535, отримано "${options.port}"`);
  process.exit(1);
}

// ---------- 2. Обробка даних ----------

// Перетворює значення на число. Число в рядку ("305880") теж стає числом.
// Відсутнє, null, порожнє чи нечислове значення → null.
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Текстове поле: обрізаємо пробіли; відсутнє, null або порожній рядок → null.
function toText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

// Розбирає вміст файлу: JSON-масив (починається з "[") або NDJSON (об'єкт на рядок).
function parseData(text) {
  const content = text.replace(/^\uFEFF/, '').trim();
  if (content.startsWith('[')) {
    return JSON.parse(content);
  }
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

// Варіант 1: фільтр normal (COD_STATE === 1) і поля mfo_code, name, state_code.
function processRecords(records, flags) {
  const result = [];
  for (const record of records) {
    if (record === null || typeof record !== 'object') continue;
    const stateCode = toNumber(record.COD_STATE);
    if (flags.normal && stateCode !== 1) continue;

    const item = {};
    if (flags.mfo) item.mfo_code = toNumber(record.MFO);
    item.name = toText(record.SHORTNAME);
    item.state_code = stateCode;
    result.push(item);
  }
  return result;
}

// ---------- 3. Відповідь клієнту ----------

// Відправляє готове тіло відповіді клієнту з правильним заголовком.
function send(req, res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
  console.log(`${req.method} ${req.url} -> ${statusCode}`);
}

// Формує JSON; якщо задано --output, спершу записує його у файл, а вже потім відправляє.
function reply(req, res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  if (!options.output) {
    send(req, res, statusCode, body);
    return;
  }

  fs.writeFile(options.output, body, 'utf8', (err) => {
    if (err) {
      const message = `Не вдалося записати відповідь у файл "${options.output}" (${err.code})`;
      send(req, res, 500, JSON.stringify({ error: message }, null, 2));
      return;
    }
    send(req, res, statusCode, body);
  });
}

// ---------- 4. Обробник запиту ----------

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname !== '/') {
    reply(req, res, 404, { error: `Маршрут ${url.pathname} не знайдено. Доступний лише маршрут /` });
    return;
  }

    // Дозволені лише GET і HEAD: сервер тільки віддає дані
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    reply(req, res, 405, { error: `Метод ${req.method} не підтримується. Дозволено: GET, HEAD` });
    return;
  }
  
  // Прапорець увімкнено лише при значенні рівно "true"
  const flags = {
    mfo: url.searchParams.get('mfo') === 'true',
    normal: url.searchParams.get('normal') === 'true',
  };

  // Файл читається заново при кожному запиті — асинхронно, через колбек (error-first)
  fs.readFile(options.input, 'utf8', (err, text) => {
    if (err) {
      const message = err.code === 'ENOENT'
        ? `Файл даних "${options.input}" не знайдено`
        : `Не вдалося прочитати файл даних (${err.code})`;
      reply(req, res, 500, { error: message });
      return;
    }

    let records;
    try {
      records = parseData(text);
    } catch {
      reply(req, res, 500, { error: `Файл даних "${options.input}" пошкоджений: це не коректний JSON/NDJSON` });
      return;
    }

    if (!Array.isArray(records)) {
      reply(req, res, 500, { error: 'Файл даних має містити масив об\'єктів' });
      return;
    }

    let result;
    try {
      result = processRecords(records, flags);
    } catch (processErr) {
      console.error(processErr);
      reply(req, res, 500, { error: 'Помилка під час обробки даних' });
      return;
    }

    reply(req, res, 200, result);
  });
}

// ---------- 5. Запуск сервера ----------

// Обгортка: синхронна помилка в обробнику не зупиняє сервер, а дає код 500
const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      reply(req, res, 500, { error: 'Внутрішня помилка сервера' });
    }
  }
});

// Помилка запуску (порт зайнятий, неіснуюча адреса тощо)
server.on('error', (err) => {
  console.error(`Не вдалося запустити сервер на ${options.host}:${port} (${err.code})`);
  process.exit(1);
});

fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  server.listen(port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${port}/`);
  });
});