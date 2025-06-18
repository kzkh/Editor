const express = require('express');
const path    = require('path');
const multer  = require('multer');
const ffmpeg  = require('fluent-ffmpeg');
const fs      = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Мидлвары
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  // Извлекаем параметры из формы
  const {
    hue = 0,
    saturation = 1,
    contrast = 1,
    brightness = 1,
    startSecond = 0,
    endSecond   = 0,
    text = '',
    textSize = 24,
    textColor = 'ffffff',
    textPositionX = 50,
    textPositionY = 50,
    font = 'Arial',
    effectBlur = 0,
    effectGrayscale = '0',
    effectInvert = '0',
    volume = 1,

    // настройки рендера (присутствуют только при сохранении)
    format = 'mp4',
    resolution = ''
  } = req.body;

  console.log('Processing video with options:', {
    hue, saturation, contrast, brightness,
    startSecond, endSecond, text, textSize,
    textColor, textPositionX, textPositionY, font,
    effectBlur, effectGrayscale, effectInvert,
    volume, format, resolution
  });

  // Сохраняем входное видео во временный файл
  const tempPath = path.join(__dirname, 'temp.mp4');
  await fs.writeFile(tempPath, req.file.buffer);

  // Готовим путь к шрифту
  const fontFiles = {
    'Arial': 'Arial.ttf',
    'Roboto': 'Roboto.ttf',
    'Times New Roman': 'TimesNewRoman.ttf'
  };
  const fontFileName = fontFiles[font] || fontFiles['Arial'];
  const absFont = path.join(__dirname, 'fonts', fontFileName);
  const relFont = path.relative(process.cwd(), absFont)
                     .split(path.sep).join('/');

  // Вычисляем параметры фильтров
  const briFF       = (brightness - 1) * 2;
  const textSizeFF  = parseInt(textSize, 10) * 2;
  const blurVal     = parseFloat(effectBlur) || 0;
  const grayEnabled = effectGrayscale === '1';
  const invEnabled  = effectInvert === '1';

  // Собираем список видео-фильтров -vf
  const vfList = [
    `hue=h=${hue}`,
    `eq=saturation=${saturation}:contrast=${contrast}:brightness=${briFF}`
  ];
  if (blurVal > 0)      vfList.push(`boxblur=${blurVal}:1`);
  if (grayEnabled)      vfList.push('hue=s=0');
  if (invEnabled)       vfList.push('negate');

  // применяем пользовательский фильтр разрешения (если задан)
  if (resolution) vfList.push(resolution);

  // добавляем текстовый оверлей
  vfList.push(
    `drawtext=fontfile='${relFont}':` +
    `text='${text}':fontcolor=${textColor}:` +
    `fontsize=${textSizeFF}:` +
    `x=(w-text_w)*${textPositionX/100}:` +
    `y=(h-text_h)*${textPositionY/100}`
  );
  const vf = vfList.join(',');

  // Собираем список аудио-фильтров -af
  const vol = parseFloat(volume) || 1;
  const afList = [`volume=${vol}`];

  // Выбираем кодеки в зависимости от формата
  const vcodec = format === 'webm' ? 'libvpx-vp9' : 'libx264';
  const acodec = format === 'webm' ? 'libopus'    : 'aac';

  // Путь для выходного файла с нужным расширением
  const outPath = path.join(__dirname, 'public', `output.${format}`);

  // Запускаем FFmpeg
  ffmpeg()
    .input(tempPath)
    .setStartTime(parseFloat(startSecond))
    .setDuration(Math.max(0, parseFloat(endSecond) - parseFloat(startSecond)))
    .outputOptions([
      `-vf ${vf}`,
      `-af ${afList.join(',')}`,
      `-c:v ${vcodec}`,
      `-c:a ${acodec}`
    ])
    .output(outPath)
    .on('start', cmd => console.log('FFmpeg cmd:', cmd))
    .on('progress', p => console.log(`Processing: ${p.percent}%`))
    .on('end', async () => {
      // Скачиваем файл и чистим временные
      res.download(outPath, `output.${format}`, async () => {
        await fs.unlink(tempPath).catch(()=>{});
        await fs.unlink(outPath).catch(()=>{});
      });
    })
    .on('error', async err => {
      console.error('FFmpeg error:', err);
      await fs.unlink(tempPath).catch(()=>{});
      res.status(500).send('Error processing video');
    })
    .run();
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});