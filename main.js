import { Command } from 'commander';

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