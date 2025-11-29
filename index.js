const express = require('express');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const multer = require('multer');
const morgan = require('morgan');

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
  console.log(`Cache directory created: ${options.cache}`);
}

// Створення Express застосунку
const app = express();

// Підключаємо логер
app.use(morgan('dev'));

// Middleware для парсингу JSON та urlencoded даних
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, options.cache);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Сховище для інвентарю 
let inventory = [];
let nextId = 1;

// POST /register - Реєстрація нового пристрою
app.route('/register')
  .post(upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    // Перевірка наявності імені
    if (!inventory_name || inventory_name.trim() === '') {
      return res.status(400).send('Bad Request: Inventory name is required');
    }

    const newItem = {
      id: nextId++,
      inventory_name: inventory_name.trim(),
      description: description || '',
      photo: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    
    res.status(201).json({
      message: 'Inventory item registered successfully',
      item: {
        id: newItem.id,
        inventory_name: newItem.inventory_name,
        description: newItem.description,
        photo_url: newItem.photo ? `/inventory/${newItem.id}/photo` : null
      }
    });
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// GET /inventory - Отримання списку всіх інвентаризованих речей
app.route('/inventory')
  .get((req, res) => {
    const result = inventory.map(item => ({
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `/inventory/${item.id}/photo` : null
    }));

    res.status(200).json(result);
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// GET/PUT/DELETE /inventory/<ID> - Операції з конкретною річчю
app.route('/inventory/:id')
  .get((req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) {
      return res.status(404).send('Not Found: Inventory item does not exist');
    }

    res.status(200).json({
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `/inventory/${item.id}/photo` : null
    });
  })
  .put((req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) {
      return res.status(404).send('Not Found: Inventory item does not exist');
    }

    const { inventory_name, description } = req.body;

    if (inventory_name !== undefined) {
      item.inventory_name = inventory_name;
    }
    if (description !== undefined) {
      item.description = description;
    }

    res.status(200).json({
      message: 'Inventory item updated successfully',
      item: {
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo ? `/inventory/${item.id}/photo` : null
      }
    });
  })
  .delete((req, res) => {
    const id = parseInt(req.params.id);
    const itemIndex = inventory.findIndex(i => i.id === id);

    if (itemIndex === -1) {
      return res.status(404).send('Not Found: Inventory item does not exist');
    }

    const item = inventory[itemIndex];

    // Видалення фото, якщо воно існує
    if (item.photo) {
      const photoPath = path.resolve(options.cache, item.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    inventory.splice(itemIndex, 1);

    res.status(200).json({
      message: 'Inventory item deleted successfully',
      id: id
    });
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// GET/PUT /inventory/<ID>/photo - Операції з фото
app.route('/inventory/:id/photo')
  .get((req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item || !item.photo) {
      return res.status(404).send('Not Found: Photo does not exist');
    }

    const photoPath = path.resolve(options.cache, item.photo);

    if (!fs.existsSync(photoPath)) {
      return res.status(404).send('Not Found: Photo file does not exist');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.status(200).sendFile(photoPath);
  })
  .put(upload.single('photo'), (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) {
      return res.status(404).send('Not Found: Inventory item does not exist');
    }

    // Видалення старого фото, якщо воно існує
    if (item.photo) {
      const oldPhotoPath = path.resolve(options.cache, item.photo);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    item.photo = req.file ? req.file.filename : null;

    res.status(200).json({
      message: 'Photo updated successfully',
      photo_url: item.photo ? `/inventory/${item.id}/photo` : null
    });
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// GET /RegisterForm.html - Веб форма для реєстрації пристрою
app.route('/RegisterForm.html')
  .get((req, res) => {
    const formPath = path.resolve(__dirname, 'RegisterForm.html');
    
    if (!fs.existsSync(formPath)) {
      return res.status(404).send('Not Found: RegisterForm.html does not exist');
    }

    res.status(200).sendFile(formPath);
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// GET /SearchForm.html - Веб форма для пошуку пристрою
app.route('/SearchForm.html')
  .get((req, res) => {
    const formPath = path.resolve(__dirname, 'SearchForm.html');
    
    if (!fs.existsSync(formPath)) {
      return res.status(404).send('Not Found: SearchForm.html does not exist');
    }

    res.status(200).sendFile(formPath);
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// POST /search - Обробка запиту пошуку пристрою за ID
app.route('/search')
  .post((req, res) => {
    const id = parseInt(req.body.id);
    const hasPhoto = req.body.has_photo === 'on' || req.body.has_photo === 'true';

    const item = inventory.find(i => i.id === id);

    if (!item) {
      return res.status(404).send('Not Found: Inventory item does not exist');
    }

    let description = item.description;

    // Додавання посилання на фото до опису, якщо прапорець активований
    if (hasPhoto && item.photo) {
      const photoUrl = `${req.protocol}://${req.get('host')}/inventory/${item.id}/photo`;
      description += `\n\nPhoto URL: ${photoUrl}`;
    }

    res.status(200).json({
      id: item.id,
      inventory_name: item.inventory_name,
      description: description,
      photo_url: item.photo ? `/inventory/${item.id}/photo` : null
    });
  })
  .all((req, res) => {
    res.status(405).send('Method Not Allowed');
  });

// Обробка неіснуючих маршрутів
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Запуск сервера
app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
  console.log(`Cache directory: ${options.cache}`);
});