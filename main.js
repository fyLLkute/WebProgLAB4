import { Command } from 'commander';
import fs from 'node:fs';

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

fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  console.log('Файл даних знайдено:', options.input); // тимчасово, до кроку 6
});