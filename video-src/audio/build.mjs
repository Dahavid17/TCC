// Gera os dados das legendas (dados.js) e a trilha final (audio/mix.wav):
// locução (audio/voz, gerada por tts.ps1) + trilha lo-fi + efeitos sonoros,
// todos sintetizados aqui, nos tempos do roteiro.
// Uso: node audio/build.mjs   (precisa do ffmpeg no PATH)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOZ = join(RAIZ, 'audio', 'voz');
const SR = 44100;
const DURACAO = 54.5;

// Início (s) de cada frase da locução no vídeo.
const FALAS = {
  s1: 0.6, s2a: 8.0, s2b: 10.3, s2c: 13.1, s3a: 16.3,
  s3b: 17.8, s4a: 29.0, s4b: 33.9, s5a: 41.8, s5b: 43.9,
};

// Trechos destacados nas legendas: [trecho, cor, brilho?]
const DESTAQUES = {
  s1: [['comprar ou vender', 'vermelho'], ['dor de cabeça', 'vermelho']],
  s2a: [['taxas absurdas', 'vermelho']],
  s2b: [['complicadas', 'amarelo']],
  s2c: [['zero segurança', 'vermelho']],
  s3a: [['calma', 'amarelo']],
  s3b: [['marketplace rural', 'verde', true]],
  s4a: [['compradores', 'verde'], ['tudo em um só lugar', 'amarelo']],
  s4b: [['vendedores', 'verde'], ['lucram mais', 'verde'], ['taxas justas', 'amarelo'], ['pagamentos seguros', 'verde']],
  s5a: [['perder tempo', 'vermelho']],
  s5b: [['cadastre-se agora mesmo', 'amarelo'], ['futuro das vendas', 'verde']],
};

// ── Leitura da locução ───────────────────────────────────────
function lerWav(arquivo) {
  const b = readFileSync(arquivo);
  let p = 12, fmt, data;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), tam = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { canais: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + tam)); break; }
    p += 8 + tam + (tam & 1);
  }
  return { ...fmt, data, duracao: data.length / (fmt.canais * fmt.bits / 8) / fmt.sr };
}

const normaliza = (s) => s.toLowerCase().replace(/[.,!?]/g, '');
const tempos = JSON.parse(readFileSync(join(VOZ, 'tempos.json'), 'utf8').replace(/^﻿/, ''));

const falas = {};
for (const [id, inicio] of Object.entries(FALAS)) {
  const { texto, palavras: cues } = tempos[id];
  const tokens = [...texto.matchAll(/\S+/g)].map((m) => ({ bruto: m[0], de: m.index, ate: m.index + m[0].length, t: null }));
  for (const cue of [].concat(cues)) {
    const tk = tokens.find((k) => cue.pos >= k.de && cue.pos < k.ate);
    if (tk && tk.t === null) tk.t = cue.inicio;
  }
  tokens.forEach((k, i) => { if (k.t === null) k.t = i ? tokens[i - 1].t + 0.25 : 0; });

  // cor de cada palavra, pelos trechos destacados
  (DESTAQUES[id] || []).forEach(([trecho, cor, brilho], n) => {
    const alvo = trecho.split(' ');
    for (let i = 0; i + alvo.length <= tokens.length; i++) {
      if (alvo.every((w, j) => normaliza(tokens[i + j].bruto) === w)) {
        for (let j = 0; j < alvo.length; j++) Object.assign(tokens[i + j], { cor, brilho: !!brilho, grupo: `${id}-${n}` });
        break;
      }
    }
  });
  const { duracao } = lerWav(join(VOZ, `${id}.wav`));
  const fim = inicio + Math.min(duracao - 0.1, tokens.at(-1).t + 0.7);
  falas[id] = {
    inicio, fim, duracao,
    palavras: tokens.map((k) => ({
      texto: k.bruto.replace(/[.,]+$/, '').toUpperCase(),
      chave: normaliza(k.bruto),
      t: +(inicio + k.t).toFixed(3),
      cor: k.cor || null,
      brilho: k.brilho || false,
      grupo: k.grupo || null,
      quebra: /[.,!?]$/.test(k.bruto),
    })),
  };
}

const palavra = (id, chave) => {
  const p = falas[id].palavras.find((w) => w.chave === chave);
  if (!p) throw new Error(`palavra "${chave}" não encontrada em ${id}`);
  return p.t;
};

// Momentos-chave usados pela animação (dados.js) e pelos efeitos sonoros.
const ev = {
  relogio: palavra('s1', 'tentou'),
  dinheiro: palavra('s1', 'vender'),
  dor: palavra('s1', 'dor'),
  whip: 7.45,
  bloco1: FALAS.s2a + 0.05,
  bloco2: FALAS.s2b + 0.05,
  travar: palavra('s2b', 'complicadas') + 0.45,
  bloco3: FALAS.s2c + 0.05,
  quebrar: palavra('s2c', 'segurança'),
  escurecer: 15.9,
  revelar: 16.2,
  marca: palavra('s3b', 'marketplace'),
  logoTopo: Math.max(22.3, falas.s3b.fim + 0.15),
  divide: 28.3,
  caixa1: palavra('s4a', 'encontram'),
  caixa2: palavra('s4a', 'tudo'),
  caixa3: palavra('s4a', 'lugar'),
  barras: palavra('s4b', 'lucram'),
  moedas: palavra('s4b', 'taxas'),
  escudo: palavra('s4b', 'pagamentos'),
  zoom: 41.3,
  clique: palavra('s5b', 'agora'),
  final: Math.min(DURACAO - 3, falas.s5b.fim + 0.2),
};
ev.celular = ev.logoTopo + 0.2;
ev.selos = [0, 1, 2].map((i) => +(ev.celular + 1.1 + i * 1.5).toFixed(3)); // recursos ao lado do celular
ev.cursor = ev.clique - 1.1;

// Legendas: blocos curtos (até 3 palavras), quebrando na pontuação e
// mantendo cada trecho destacado inteiro no mesmo bloco (até 4 palavras).
const legendas = [];
for (const id of Object.keys(FALAS)) {
  const ws = falas[id].palavras;
  let bloco = [];
  const fecha = () => { if (bloco.length) legendas.push({ fala: id, palavras: bloco }); bloco = []; };
  for (const w of ws) {
    const ant = bloco.at(-1);
    if (ant) {
      const chars = bloco.reduce((n, x) => n + x.texto.length + 1, 0) + w.texto.length;
      const dentro = w.grupo && w.grupo === ant.grupo;
      const comeca = w.grupo && w.grupo !== ant.grupo;
      const termina = ant.grupo && w.grupo !== ant.grupo;
      const tamGrupo = ws.filter((x) => x.grupo && x.grupo === w.grupo).length;
      if (dentro) { if (bloco.length >= 5) fecha(); }
      else if (comeca) { if (bloco.length >= 2 || termina || tamGrupo >= 4) fecha(); }
      else if (termina || bloco.length >= 3 || chars > 17) fecha();
    }
    bloco.push(w);
    if (w.quebra) fecha();
  }
  fecha();
}
legendas.forEach((l, i) => {
  const prox = legendas[i + 1];
  l.inicio = +(l.palavras[0].t - 0.06).toFixed(3);
  const fimFala = falas[l.fala].fim;
  l.fim = +(prox && prox.fala === l.fala ? prox.palavras[0].t - 0.06 : fimFala).toFixed(3);
});

writeFileSync(join(RAIZ, 'dados.js'),
  '// Gerado por audio/build.mjs — não editar à mão.\n' +
  `window.DADOS = ${JSON.stringify({ duracao: DURACAO, eventos: ev, legendas }, null, 1)};\n`);

// ── Síntese ──────────────────────────────────────────────────
let semente = 20261104;
const rnd = () => (semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0) / 4294967296;
const ruido = () => rnd() * 2 - 1;
const N = Math.ceil(DURACAO * SR);
const canal = () => [new Float32Array(N), new Float32Array(N)];
const musica = canal(), sfx = canal();
const nota = (m) => 440 * 2 ** ((m - 69) / 12);

// soma um som (gen(t) → amostra) em buf a partir de t0; pan de -1 a 1 (ou função de t)
function add(buf, t0, dur, gen, ganho = 1, pan = 0) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const k = i0 + i;
    if (k < 0 || k >= N) continue;
    const t = i / SR, v = gen(t) * ganho;
    const p = typeof pan === 'function' ? pan(t) : pan;
    const a = (Math.max(-1, Math.min(1, p)) + 1) * Math.PI / 4;
    buf[0][k] += v * Math.cos(a);
    buf[1][k] += v * Math.sin(a);
  }
}

// filtro de estado variável (Chamberlin)
function filtro() {
  let low = 0, band = 0;
  return (x, fc, amort = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    low += f * band;
    const high = x - low - amort * band;
    band += f * high;
    return { low, band, high };
  };
}

const sino = (t, f, decai) =>
  [[1, 1, 1], [2, 0.5, 1.3], [2.76, 0.35, 1.8], [5.4, 0.15, 3]]
    .reduce((s, [m, a, d]) => s + a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t * decai * d), 0);

// ── Efeitos sonoros ──
function whoosh(t0, dur = 0.5, ganho = 0.5, panDe = -0.6, panAte = 0.6) {
  const fl = filtro();
  add(sfx, t0, dur, (t) => {
    const p = t / dur;
    return fl(ruido(), 250 + 3400 * Math.sin(Math.PI * p), 0.55).band * Math.sin(Math.PI * p) ** 2;
  }, ganho, (t) => panDe + (panAte - panDe) * (t / dur));
}

function pop(t0, f = 520, ganho = 0.5, pan = 0) {
  add(sfx, t0, 0.2, (t) =>
    Math.sin(2 * Math.PI * f * (t + 1.6 * (1 - Math.exp(-t * 45)) / 45)) *
    Math.min(1, t * 900) * Math.exp(-t * 26), ganho, pan);
}

function thud(t0, ganho = 0.7) {
  const fl = filtro();
  add(sfx, t0, 0.5, (t) =>
    Math.tanh(1.6 * Math.sin(2 * Math.PI * (45 * t + 70 * (1 - Math.exp(-t * 25)) / 25))) * Math.exp(-t * 9) +
    fl(ruido(), 380).low * Math.exp(-t * 35) * 1.5, ganho);
}

function glitch(t0, ganho = 0.45) {
  const trechos = Array.from({ length: 14 }, () => ({ f: 160 + rnd() * 900, liga: rnd() > 0.3 }));
  const fl = filtro();
  add(sfx, t0, 0.56, (t) => {
    const s = trechos[Math.min(trechos.length - 1, Math.floor(t / 0.04))];
    const tom = s.liga ? Math.round(Math.sign(Math.sin(2 * Math.PI * s.f * t)) * 2) / 4 : 0;
    const arranhado = fl(ruido(), 700 + 2600 * Math.abs(Math.sin(2 * Math.PI * 6 * t)), 0.3).band;
    return (tom * 0.6 + arranhado * 1.4) * Math.min(1, t * 200) * Math.exp(-t * 3);
  }, ganho);
}

function ding(t0, ganho = 0.35) {
  add(sfx, t0, 1.4, (t) => sino(t, 1318.5, 3), ganho, -0.1);
  add(sfx, t0 + 0.12, 1.3, (t) => sino(t, 1975.5, 3), ganho * 0.8, 0.1);
}

function moedas(t0, n = 6, espalha = 1.2, ganho = 0.25) {
  let t = t0;
  for (let i = 0; i < n; i++) {
    const f0 = 2600 + rnd() * 1600, pan = rnd() * 1.2 - 0.6;
    add(sfx, t, 0.3, (x) =>
      [1, 1.47, 2.09, 2.56].reduce((s, m, j) => s + Math.sin(2 * Math.PI * f0 * m * x) / (j + 1), 0) *
      Math.min(1, x * 2000) * Math.exp(-x * 22), ganho, pan);
    t += (espalha / n) * (0.5 + rnd());
  }
}

function caixaRegistradora(t0, ganho = 0.5) {
  const fl = filtro();
  add(sfx, t0, 0.09, (t) => fl(ruido(), 2400, 0.4).band * Math.exp(-t * 40), ganho * 1.2);
  thud(t0 + 0.02, ganho * 0.4);
  add(sfx, t0 + 0.08, 1.1, (t) => sino(t, 2093, 3.2) + 0.6 * sino(t, 2637, 3.6), ganho * 0.45);
  moedas(t0 + 0.16, 4, 0.5, ganho * 0.5);
}

function clique(t0, ganho = 0.7) {
  for (const [dt, g] of [[0, 1], [0.075, 0.55]]) {
    add(sfx, t0 + dt, 0.04, (t) =>
      (ruido() * Math.exp(-t * 900) + Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 500)), ganho * g);
  }
}

function magia(t0, ganho = 0.4) {
  const fl = filtro();
  add(sfx, t0, 0.9, (t) => {
    const p = t / 0.9;
    return fl(ruido(), 400 + 5600 * p, 0.5).band * Math.sin(Math.PI * p) ** 2;
  }, ganho * 0.8, (t) => -0.5 + t);
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) =>
    add(sfx, t0 + 0.3 + i * 0.08, 1.2, (t) => sino(t, f * (1 + 0.003 * Math.sin(2 * Math.PI * 6 * t)), 4), ganho * 0.35, i / 3 - 0.6));
}

function brilhos(t0, ganho = 0.25) {
  for (let i = 0; i < 6; i++) {
    const f = 2500 + rnd() * 2800;
    add(sfx, t0 + i * 0.07 + rnd() * 0.04, 0.25, (t) => Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 18), ganho, rnd() * 1.6 - 0.8);
  }
}

// Cena 1
glitch(0);
whoosh(0.05, 0.4, 0.3);
pop(ev.relogio, 620, 0.5, -0.5);
pop(ev.dinheiro, 480, 0.5, 0.5);
thud(ev.dor, 0.6);
// Cena 2
whoosh(ev.whip, 0.42, 0.6, 0.9, -0.9);
pop(ev.bloco1, 520); thud(ev.bloco1 + 0.02, 0.35);
pop(ev.bloco2, 470); thud(ev.bloco2 + 0.02, 0.35);
pop(ev.bloco3, 420); thud(ev.bloco3 + 0.02, 0.35);
thud(ev.quebrar, 0.5);
// Cena 3
whoosh(ev.escurecer, 0.45, 0.3, 0, 0);
magia(ev.revelar);
whoosh(ev.logoTopo, 0.35, 0.25, 0.2, -0.2);
pop(ev.celular + 0.1, 560, 0.45);
ev.selos.forEach((t, i) => pop(t, 600 + i * 80, 0.4, i % 2 ? 0.5 : -0.5));
// Cena 4
whoosh(ev.divide, 0.45, 0.5, -0.3, 0.3);
pop(ev.caixa1, 430, 0.45, -0.5); pop(ev.caixa2, 500, 0.45, -0.5); pop(ev.caixa3, 580, 0.45, -0.5);
caixaRegistradora(ev.barras, 0.55);
moedas(ev.moedas, 8, 1.4, 0.22);
ding(ev.escudo + 0.35);
// Cena 5
whoosh(ev.zoom, 0.45, 0.5, 0, 0);
pop(ev.zoom + 0.25, 440, 0.45);
whoosh(ev.cursor, 1.0, 0.18, 0.8, 0);
clique(ev.clique, 0.75);
brilhos(ev.clique + 0.05);
pop(ev.clique + 0.04, 700, 0.35);
whoosh(ev.final - 0.1, 0.5, 0.45, -0.4, 0.4);
whoosh(DURACAO - 0.9, 0.7, 0.35, 0.5, -0.5);

// ── Trilha lo-fi (90 BPM; compasso de 2,667 s → a parte animada entra aos 16 s) ──
const BEAT = 60 / 90, COMPASSO = 4 * BEAT;
const ANIMADA = 6, ULTIMO = Math.floor(DURACAO / COMPASSO);
const PARTE_A = { acordes: [[57, 60, 64], [57, 60, 65], [57, 60, 64], [56, 59, 64]], baixos: [45, 41, 45, 40] }; // Am F Am E
const PARTE_B = { acordes: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]], baixos: [36, 43, 45, 41] }; // C G Am F

const pad = (t0, notas, dur, g) => notas.forEach((m) => {
  const f = nota(m);
  add(musica, t0, dur, (t) => (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) *
    Math.min(1, t / 0.5, (dur - t) / 0.5), g, (m % 3 - 1) * 0.3);
});
const teclas = (t0, notas, dur, g) => notas.forEach((m) => {
  const f = nota(m);
  add(musica, t0, dur, (t) => Math.sin(2 * Math.PI * f * t + 0.8 * Math.exp(-t * 6) * Math.sin(4 * Math.PI * f * t)) *
    Math.min(1, t * 200, (dur - t) * 20) * Math.exp(-t * 2.5) * (1 + 0.1 * Math.sin(2 * Math.PI * 5 * t)), g, (m % 2 ? 0.25 : -0.25));
});
const baixo = (t0, m, dur, g) => {
  const f = nota(m);
  add(musica, t0, dur, (t) => Math.tanh(1.4 * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t))) *
    Math.min(1, t * 100, (dur - t) * 30) * Math.exp(-t * 1.8), g);
};
const bumbo = (t0, g) => add(musica, t0, 0.5, (t) =>
  Math.tanh(1.5 * Math.sin(2 * Math.PI * (48 * t + 90 * (1 - Math.exp(-t * 35)) / 35))) * Math.exp(-t * 7), g);
const caixa = (t0, g) => {
  const fl = filtro();
  add(musica, t0, 0.3, (t) => fl(ruido(), 1800, 0.8).band * 1.8 * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) * 0.5, g);
};
const chimbal = (t0, g) => {
  const fl = filtro();
  add(musica, t0, 0.08, (t) => fl(ruido(), 7000, 0.6).high * Math.exp(-t * 60), g, 0.2);
};

for (let b = 0; b <= ULTIMO; b++) {
  const t0 = b * COMPASSO;
  if (b === ULTIMO) { // acorde final, soando até o fim
    const resto = DURACAO - t0;
    teclas(t0, PARTE_B.acordes[0], resto, 0.07);
    pad(t0, PARTE_B.acordes[0], resto, 0.03);
    baixo(t0, 36, resto, 0.2);
    bumbo(t0, 0.55);
    break;
  }
  const animada = b >= ANIMADA;
  const parte = animada ? PARTE_B : PARTE_A;
  const i = (animada ? b - ANIMADA : b) % 4;
  pad(t0, parte.acordes[i], COMPASSO + 0.5, animada ? 0.028 : 0.04);
  for (let k = 0; k < 8; k++) {
    chimbal(t0 + k * BEAT / 2 + (k % 2 ? 0.1 * BEAT : 0), (animada ? 0.12 : 0.06) * (k % 2 ? 0.7 : 1));
  }
  if (!animada) {
    baixo(t0, parte.baixos[i], COMPASSO, 0.12);
    continue;
  }
  for (const k of [0, 1.5, 2.5]) bumbo(t0 + k * BEAT, 0.6);
  for (const k of [1, 3]) caixa(t0 + k * BEAT, 0.28);
  baixo(t0, parte.baixos[i], 1.4 * BEAT, 0.22);
  baixo(t0 + 2.5 * BEAT, parte.baixos[i], 1.2 * BEAT, 0.18);
  teclas(t0, parte.acordes[i], 1.3 * BEAT, 0.06);
  teclas(t0 + 1.5 * BEAT, parte.acordes[i], BEAT, 0.045);
  teclas(t0 + 3 * BEAT, parte.acordes[i], 0.6 * BEAT, 0.035);
}

// chiado de vinil + passa-baixa para o timbre lo-fi
{
  let estalo = 0;
  for (let k = 0; k < N; k++) {
    if (rnd() < 0.0003) estalo = ruido() * 0.12;
    estalo *= 0.85;
    musica[0][k] += estalo; musica[1][k] += estalo;
  }
  const a = 1 - Math.exp(-2 * Math.PI * 4200 / SR);
  for (const c of musica) { let y = 0; for (let k = 0; k < N; k++) { y += a * (c[k] - y); c[k] = y; } }
}

// ── Locução (posicionada pelo ffmpeg) ──
const ids = Object.keys(FALAS);
const vozArq = join(RAIZ, 'audio', 'voz-posicionada.wav');
execFileSync('ffmpeg', [
  '-y', '-v', 'error',
  ...ids.flatMap((id) => ['-i', join(VOZ, `${id}.wav`)]),
  '-filter_complex',
  ids.map((id, i) => `[${i}:a]aresample=${SR},adelay=${Math.round(FALAS[id] * 1000)}:all=1[v${i}]`).join(';') + ';' +
  ids.map((_, i) => `[v${i}]`).join('') +
  `amix=inputs=${ids.length}:normalize=0,highpass=f=90,equalizer=f=3000:t=q:w=1:g=2,` +
  `acompressor=threshold=-20dB:ratio=3:attack=5:release=90,pan=stereo|c0=c0|c1=c0,apad,atrim=0:${DURACAO}[voz]`,
  '-map', '[voz]', '-ar', String(SR), '-c:a', 'pcm_s16le', vozArq,
]);
const voz = lerWav(vozArq);
const vozL = new Float32Array(N), vozR = new Float32Array(N);
for (let k = 0; k < N && k * 4 + 3 < voz.data.length; k++) {
  vozL[k] = voz.data.readInt16LE(k * 4) / 32768;
  vozR[k] = voz.data.readInt16LE(k * 4 + 2) / 32768;
}
let picoVoz = 0;
for (let k = 0; k < N; k++) picoVoz = Math.max(picoVoz, Math.abs(vozL[k]));

// ── Mixagem: a trilha abaixa enquanto há fala ──
const falando = ids.map((id) => [falas[id].inicio - 0.1, falas[id].fim + 0.1]);
const saida = Buffer.alloc(44 + N * 4);
let duck = 1, pico = 0;
const mix = new Float32Array(N * 2);
const aDuck = 1 - Math.exp(-1 / (0.08 * SR));
for (let k = 0; k < N; k++) {
  const t = k / SR;
  const alvo = falando.some(([a, b]) => t >= a && t <= b) ? 0.35 : 1;
  duck += aDuck * (alvo - duck);
  const entra = Math.min(1, t / 1.0), sai = Math.min(1, (DURACAO - t) / 1.2);
  for (let c = 0; c < 2; c++) {
    const v = (c ? vozR[k] : vozL[k]) * (0.9 / picoVoz) + musica[c][k] * 0.55 * duck * entra * sai + sfx[c][k] * 0.8;
    mix[k * 2 + c] = v;
    pico = Math.max(pico, Math.abs(v));
  }
}
const ganhoFinal = 0.95 / pico;
saida.write('RIFF', 0); saida.writeUInt32LE(36 + N * 4, 4); saida.write('WAVE', 8);
saida.write('fmt ', 12); saida.writeUInt32LE(16, 16); saida.writeUInt16LE(1, 20); saida.writeUInt16LE(2, 22);
saida.writeUInt32LE(SR, 24); saida.writeUInt32LE(SR * 4, 28); saida.writeUInt16LE(4, 32); saida.writeUInt16LE(16, 34);
saida.write('data', 36); saida.writeUInt32LE(N * 4, 40);
for (let k = 0; k < N * 2; k++) saida.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[k] * ganhoFinal)) * 32767), 44 + k * 2);
writeFileSync(join(RAIZ, 'audio', 'mix.wav'), saida);

console.log('legendas:', legendas.length, '| eventos:', JSON.stringify(ev));
