/** Original pixel scenery. The game and title share this scene; no external assets. */
let backdrop: HTMLCanvasElement | null = null;
const W = 640, H = 360;
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function paintCity(g: CanvasRenderingContext2D) {
  const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const roof = (x: number, y: number, w: number, c = '#173d43') => {
    for (let i = 0; i < 9; i++) rect(x + i * 3, y - i * 2, w - i * 6, 3, c);
    rect(x - 6, y - 5, 9, 3, c); rect(x + w - 3, y - 5, 9, 3, c);
    rect(x - 3, y - 2, w + 6, 2, '#bd7853'); rect(x + 5, y + 2, w - 10, 3, '#582b33');
    for (let i = 12; i < w - 8; i += 9) rect(x + i, y - 7, 2, 5, '#285054');
  };
  const lantern = (x: number, y: number, size = 1) => {
    g.save(); g.translate(x, y); g.scale(size, size);
    rect(-1, -12, 1, 12, '#ad774f'); rect(-4, 0, 8, 2, '#f6cb72');
    rect(-7, 2, 14, 13, '#b83939'); rect(-9, 5, 18, 7, '#da4c37');
    rect(-5, 3, 10, 11, '#f3824d'); rect(-2, 3, 3, 11, '#ffc274');
    rect(-4, 15, 8, 2, '#e8b164'); rect(-1, 17, 1, 7, '#eeb46a'); rect(-3, 23, 5, 3, '#b84139'); g.restore();
  };
  const shop = (x: number, y: number, w: number, floors: number, label: string, teal = false) => {
    const h = floors * 35;
    rect(x, y, w, h, teal ? '#1c3a40' : '#4c2b39');
    rect(x + 4, y, w - 8, h, teal ? '#294447' : '#68383c');
    for (let f = 0; f < floors; f++) {
      const yy = y + f * 35;
      rect(x + 3, yy + 6, w - 6, 3, '#b66c4e');
      for (let win = 8; win < w - 13; win += 17) {
        rect(x + win, yy + 13, 12, 18, '#b77a52'); rect(x + win + 1, yy + 14, 10, 15, '#f6b26b');
        rect(x + win + 5, yy + 13, 2, 18, '#663b3b'); rect(x + win, yy + 21, 12, 2, '#663b3b');
      }
      rect(x, yy + 32, w, 3, '#291f31');
      if (f < floors - 1) roof(x - 6, yy + 35, w + 12);
    }
    roof(x - 8, y + 1, w + 16);
    rect(x + 10, y + h - 25, w - 20, 19, '#261f2c');
    rect(x + 12, y + h - 23, w - 24, 2, '#d8a45c');
    g.font = 'bold 10px serif'; g.fillStyle = '#f7cf8c'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h - 11);
    rect(x + 2, y + 5, 3, h, '#ca7750'); rect(x + w - 5, y + 5, 3, h, '#ca7750');
    lantern(x + 4, y + h - 10, .8); lantern(x + w - 4, y + h - 10, .8);
  };
  rect(0, 0, W, H, '#111c2e');
  for (let i = 0; i < 90; i++) rect(rnd(i) * W, rnd(i + 200) * 180, 1, 1, i % 3 ? '#5d667e' : '#b19c8b');
  // Stepped moon, clouds, and a far skyline.
  rect(446, 40, 32, 38, '#e3ba82'); rect(441, 47, 42, 24, '#e3ba82'); rect(450, 37, 24, 44, '#e3ba82');
  rect(453, 49, 6, 3, '#d3a57b'); rect(468, 64, 8, 4, '#d3a57b');
  for (let i = 0; i < 11; i++) {
    const x = i * 67 - 20, y = 91 + rnd(i + 5) * 60;
    rect(x, y, 54, 92, '#213146'); roof(x - 4, y, 62, '#243d4b');
    for (let j = 0; j < 5; j++) rect(x + 7 + j * 9, y + 12, 3, 7, '#6c5952');
  }
  for (let floor = 0; floor < 5; floor++) {
    const w = 81 - floor * 11, y = 195 - floor * 23;
    rect(352 - w / 2 + 9, y - 18, w - 18, 28, '#2c4149'); roof(352 - w / 2, y - 16, w, '#27434a');
    for (let j = 0; j < 3; j++) rect(340 + j * 10, y - 10, 5, 9, '#9e7355');
  }
  rect(351, 49, 2, 21, '#ba875f');
  rect(0, 228, W, 132, '#292534');
  // Paving and warm reflections give the street depth.
  for (let y = 234; y < H; y += 8) {
    const bw = 20 + (y - 234) / 4;
    for (let x = -bw; x < W; x += bw) {
      rect(x + (Math.floor(y / 8) % 2) * bw / 2, y, bw - 2, 1, '#453540');
      if (rnd(x + y * 2) > .79) rect(x, y + 2, bw / 2, 1, '#754b48');
    }
  }
  shop(-12, 133, 100, 3, '萬福茶樓'); shop(94, 188, 69, 2, '小籠包', true);
  shop(172, 210, 51, 1, '點心'); shop(495, 150, 79, 3, '龍門酒家', true);
  shop(580, 108, 78, 4, '中華飯店'); shop(434, 198, 52, 2, '茶');
  // Chinatown gate and engraved beams.
  rect(240, 207, 8, 77, '#963f3f'); rect(393, 207, 8, 77, '#963f3f');
  rect(242, 211, 2, 68, '#e7a362'); rect(395, 211, 2, 68, '#e7a362');
  rect(232, 200, 178, 10, '#a85540'); rect(238, 211, 166, 5, '#5c3136');
  for (let i = 249; i < 397; i += 11) rect(i, 203, 5, 3, '#edbd72');
  roof(226, 201, 190); roof(273, 183, 96);
  rect(293, 187, 56, 20, '#5f2b34'); rect(295, 189, 52, 1, '#e5b265');
  g.fillStyle = '#f4cd8b'; g.font = 'bold 12px serif'; g.textAlign = 'center'; g.fillText('中 華 街', 321, 202);
  rect(236, 279, 16, 7, '#73555a'); rect(389, 279, 16, 7, '#73555a');
  lantern(262, 217, .7); lantern(379, 217, .7);
  // Foreground shop signs, awnings, and rooftop ledges.
  rect(40, 167, 18, 55, '#b23d3e'); rect(42, 169, 14, 51, '#dd5b44');
  g.fillStyle = '#ffe1a0'; g.font = 'bold 11px serif'; ['龍', '鳳', '樓'].forEach((s, i) => g.fillText(s, 49, 183 + i * 15));
  rect(549, 191, 18, 54, '#245f62'); rect(551, 193, 14, 50, '#39827b');
  g.fillStyle = '#f7d58e'; ['夜', '市'].forEach((s, i) => g.fillText(s, 558, 211 + i * 16));
  for (let x = 91; x < 163; x += 9) rect(x, 252, 9, 8, (x - 91) % 18 ? '#b24742' : '#dfaa6b');
  rect(97, 260, 3, 22, '#975642'); rect(157, 260, 3, 22, '#975642');
  for (let i = 0; i < 8; i++) rect(105 + i * 6, 272, 4, 5, '#d4a174');
  // Strings of glowing paper lanterns.
  for (let x = 0; x < W; x += 2) {
    rect(x, 20 + Math.sin(x / W * Math.PI) * 32, 2, 1, '#94624b');
    rect(x, 147 + Math.sin(x / W * Math.PI) * 20, 2, 1, '#7a564a');
  }
  for (let i = 0; i < 9; i++) { const x = 25 + i * 75; lantern(x, 34 + Math.sin(x / W * Math.PI) * 32, 1.05); }
  for (let i = 0; i < 10; i++) { const x = 12 + i * 68; lantern(x, 158 + Math.sin(x / W * Math.PI) * 20, .55); }
  rect(0, 330, 125, 30, '#141c28'); roof(-15, 331, 160, '#1c353e');
  rect(543, 319, 100, 41, '#141c28'); roof(526, 320, 130, '#1c353e');
}

export function drawChinatown(g: CanvasRenderingContext2D, width: number, height: number, now = 0, camera = 0, title = false) {
  if (!backdrop) { backdrop = document.createElement('canvas'); backdrop.width = W; backdrop.height = H; paintCity(backdrop.getContext('2d')!); }
  const scale = Math.max(width / W, height / H);
  const sw = W * scale, sh = H * scale;
  const x = (width - sw) / 2 - (title ? 0 : Math.sin(camera / 2600) * 12);
  g.save(); g.imageSmoothingEnabled = false;
  g.fillStyle = '#111c2e'; g.fillRect(0, 0, width, height);
  g.drawImage(backdrop, x, (height - sh) / 2, sw, sh);
  for (let i = 0; i < (title ? 24 : 9); i++) {
    const px = ((rnd(i + 800) * width + Math.sin(now / 2500 + i) * 14) % width + width) % width;
    const py = height - ((now * .014 + rnd(i + 900) * height) % height);
    g.fillStyle = i % 3 ? '#e59759' : '#ffd38b'; g.globalAlpha = .3 + rnd(i) * .35;
    g.fillRect(Math.floor(px / 3) * 3, Math.floor(py / 3) * 3, 2, 3);
  }
  g.globalAlpha = title ? .09 : .37; g.fillStyle = '#0b1525'; g.fillRect(0, 0, width, height); g.restore();
}
