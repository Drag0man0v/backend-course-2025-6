const http = require('http');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

// Налаштування Commander.js для парсингу аргументів командного рядка
const program = new Command();

program
  .requiredOption('-h, --host <host>', 'Server host address')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Path to cache directory');


// Налаштування кастомного виводу помилок
program.configureOutput({
  writeErr: (str) => {
    const error = str.toLowerCase();
    if (error.includes("required option '-h, --host' not specified")) {
      console.error("Помилка: Не вказано обов'язковий параметр --host (-h).");
    } else if (error.includes("option '-h, --host' argument missing")) {
      console.error("Помилка: Для параметра --host (-h) не вказано значення.");
    } else if (error.includes("required option '-p, --port' not specified")) {
      console.error("Помилка: Не вказано обов'язковий параметр --port (-p).");
    } else if (error.includes("option '-p, --port' argument missing")) {
      console.error("Помилка: Для параметра --port (-p) не вказано значення.");
    } else if (error.includes("required option '-c, --cache' not specified")) {
      console.error("Помилка: Не вказано обов'язковий параметр --cache (-c).");
    } else if (error.includes("option '-c, --cache' argument missing")) {
      console.error("Помилка: Для параметра --cache (-c) не вказано значення.");
    } else {
      console.error(str);
    }
    process.exit(1);
  }
});

program.parse(process.argv);
const options = program.opts();
// Перевірка та створення директорії для кешу, якщо вона не існує
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Директорія для кешу створена: ${options.cache}`);
}

// Створення HTTP сервера
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Поки що простий тестовий обробник
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Сервіс інвентаризації запущено!\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

// Запуск сервера з параметрами з командного рядка
server.listen(options.port, options.host, () => {
  console.log(`Сервер http://${options.host}:${options.port}/ запущено`);
  console.log(`Директорія кешу: ${options.cache}`);
});

// Обробка помилок на сервері
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});