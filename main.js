import { Command } from 'commander';
import fs from 'node:fs';
import http from 'node:http';

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

function send(req, res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
  console.log(`${req.method} ${req.url} -> ${statusCode}`);
}

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname !== '/') {
    send(req, res, 404, JSON.stringify({ error: `Маршрут ${url.pathname} не знайдено. Доступний лише маршрут /` }, null, 2));
    return;
  }
  send(req, res, 200, JSON.stringify({ message: 'Сервер працює' })); // тимчасово, до кроку 7
}

const server = http.createServer(handleRequest);

fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  server.listen(port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${port}/`);
  });
});