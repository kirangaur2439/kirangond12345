// Constants
const N = 1000; // Number of samples
const time = Array.from({ length: N }, (_, i) => i * 0.001); // Time array (0 to 1s in 1ms steps)
const SAMPLE_RATE = 1000; // 1kHz sample rate
const FFT_SIZE = 1024; // Size for FFT calculations

// Get all canvas elements and their contexts
const messageCanvas = document.getElementById('messageCanvas');
const messageCtx = messageCanvas.getContext('2d');
const carrierCanvas = document.getElementById('carrierCanvas');
const carrierCtx = carrierCanvas.getContext('2d');
const modulatedCanvas = document.getElementById('modulatedCanvas');
const modulatedCtx = modulatedCanvas.getContext('2d');
const croCanvas = document.getElementById('croCanvas');
const croCtx = croCanvas.getContext('2d');
const spectrumCanvas = document.getElementById('spectrumCanvas');
const spectrumCtx = spectrumCanvas.getContext('2d');

// Set canvas dimensions
function resizeCanvases() {
  const canvases = [messageCanvas, carrierCanvas, modulatedCanvas, croCanvas, spectrumCanvas];
  canvases.forEach(canvas => {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  });
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();

// Generate waveform functions
function generateSine(amp, freq, t, phase = 0) {
  return amp * Math.sin(2 * Math.PI * freq * t + phase);
}

function generateTriangle(amp, freq, t) {
  const period = 1 / freq;
  const posInPeriod = (t % period) / period;
  let val = 0;
  
  if (posInPeriod < 0.25) {
    val = posInPeriod * 4;
  } else if (posInPeriod < 0.75) {
    val = 2 - posInPeriod * 4;
  } else {
    val = -4 + posInPeriod * 4;
  }
  
  return amp * val;
}

function generateSquare(amp, freq, t) {
  const period = 1 / freq;
  return ((t % period) / period) < 0.5 ? amp : -amp;
}

// Simple FFT implementation for demonstration
class FFT {
  constructor(size, sampleRate) {
    this.size = size;
    this.sampleRate = sampleRate;
    this.real = new Array(size).fill(0);
    this.imag = new Array(size).fill(0);
  }
  
  forward(input) {
    for (let k = 0; k < this.size; k++) {
      this.real[k] = 0;
      this.imag[k] = 0;
      
      for (let n = 0; n < this.size; n++) {
        const angle = -2 * Math.PI * k * n / this.size;
        this.real[k] += input[n] * Math.cos(angle);
        this.imag[k] += input[n] * Math.sin(angle);
      }
    }
  }
  
  inverse() {
    const outputReal = new Array(this.size).fill(0);
    
    for (let n = 0; n < this.size; n++) {
      outputReal[n] = 0;
      
      for (let k = 0; k < this.size; k++) {
        const angle = 2 * Math.PI * k * n / this.size;
        outputReal[n] += this.real[k] * Math.cos(angle) - this.imag[k] * Math.sin(angle);
      }
      
      outputReal[n] /= this.size;
    }
    
    this.real = outputReal;
    this.imag = new Array(this.size).fill(0);
  }
}

// Hilbert transform approximation (using FFT)
function hilbertTransform(signal) {
  const fft = new FFT(FFT_SIZE, SAMPLE_RATE);
  const paddedSignal = [...signal, ...Array(FFT_SIZE - signal.length).fill(0)];
  fft.forward(paddedSignal);
  
  // Apply Hilbert transform in frequency domain
  for (let i = 0; i < FFT_SIZE / 2; i++) {
    fft.imag[i] = -fft.real[i];
    fft.real[i] = fft.imag[i];
  }
  for (let i = FFT_SIZE / 2; i < FFT_SIZE; i++) {
    fft.imag[i] = fft.real[i];
    fft.real[i] = -fft.imag[i];
  }
  
  // Inverse FFT
  fft.inverse();
  return fft.real.slice(0, N); // Return only the first N samples
}

// Generate signals based on current settings
function generateSignals() {
  const msgAmp = parseFloat(document.getElementById('msgAmp').value);
  const msgFreq = parseFloat(document.getElementById('msgFreq').value);
  const msgWaveform = document.getElementById('msgWaveform').value;
  const carAmp = parseFloat(document.getElementById('carAmp').value);
  const carFreq = parseFloat(document.getElementById('carFreq').value);
  const modType = document.getElementById('modType').value;
  const ssbType = document.querySelector('input[name="ssbType"]:checked').value;
  
  // Generate message signal
  const messageSignal = time.map(t => {
    switch (msgWaveform) {
      case 'sine': return generateSine(msgAmp, msgFreq, t);
      case 'triangle': return generateTriangle(msgAmp, msgFreq, t);
      case 'square': return generateSquare(msgAmp, msgFreq, t);
      default: return generateSine(msgAmp, msgFreq, t);
    }
  });

  // Generate carrier signal
  const carrierSignal = time.map(t => generateSine(carAmp, carFreq, t));

  // Generate modulated signal
  let modulatedSignal;
  if (modType === 'dsb') {
    // DSB-AM: s(t) = [A_c + m(t)] * cos(2πf_c t)
    modulatedSignal = time.map((t, i) => 
      (carAmp + messageSignal[i]) * Math.cos(2 * Math.PI * carFreq * t)
    );
  } else {
    // SSB-AM using Hilbert transform method
    const hilbert = hilbertTransform(messageSignal);
    if (ssbType === 'lsb') {
      // Lower sideband
      modulatedSignal = time.map((t, i) => 
        messageSignal[i] * Math.cos(2 * Math.PI * carFreq * t) + 
        hilbert[i] * Math.sin(2 * Math.PI * carFreq * t)
      );
    } else {
      // Upper sideband
      modulatedSignal = time.map((t, i) => 
        messageSignal[i] * Math.cos(2 * Math.PI * carFreq * t) - 
        hilbert[i] * Math.sin(2 * Math.PI * carFreq * t)
      );
    }
  }

  return { messageSignal, carrierSignal, modulatedSignal };
}

// Draw waveform on canvas
function drawWaveform(ctx, signal, color = 'blue') {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const midY = height / 2;
  const scaleY = height / 2 / (Math.max(...signal.map(Math.abs)) || 1);
  
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  signal.forEach((value, i) => {
    const x = (i / N) * width;
    const y = midY - value * scaleY;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
}

// Draw spectrum on canvas
function drawSpectrum(ctx, signal) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Compute FFT
  const fft = new FFT(FFT_SIZE, SAMPLE_RATE);
  const paddedSignal = [...signal, ...Array(FFT_SIZE - signal.length).fill(0)];
  fft.forward(paddedSignal);
  
  // Compute magnitude spectrum
  const spectrum = new Array(FFT_SIZE / 2).fill(0);
  for (let i = 0; i < FFT_SIZE / 2; i++) {
    spectrum[i] = Math.sqrt(fft.real[i] ** 2 + fft.imag[i] ** 2);
  }
  
  // Normalize spectrum
  const maxSpectrum = Math.max(...spectrum) || 1;
  const normalizedSpectrum = spectrum.map(val => val / maxSpectrum);
  
  // Draw spectrum
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 2;
  
  normalizedSpectrum.forEach((value, i) => {
    const x = (i / (FFT_SIZE / 2)) * width;
    const y = height - value * height;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
}

// Draw CRO display (X-Y plot)
function drawCRO(ctx, signalX, signalY) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const midX = width / 2;
  const midY = height / 2;
  
  // Scale signals to fit canvas
  const scaleX = width / 2 / (Math.max(...signalX.map(Math.abs)) || 1);
  const scaleY = height / 2 / (Math.max(...signalY.map(Math.abs)) || 1);
  
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = 'purple';
  ctx.lineWidth = 2;
  
  signalX.forEach((valueX, i) => {
    const x = midX + valueX * scaleX;
    const y = midY - signalY[i] * scaleY;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
}

// Update all displays
function updateDisplays() {
  const { messageSignal, carrierSignal, modulatedSignal } = generateSignals();
  
  drawWaveform(messageCtx, messageSignal, 'blue');
  drawWaveform(carrierCtx, carrierSignal, 'red');
  drawWaveform(modulatedCtx, modulatedSignal, 'green');
  drawCRO(croCtx, messageSignal, modulatedSignal);
  drawSpectrum(spectrumCtx, modulatedSignal);
}

// Initialize event listeners
document.getElementById('msgAmp').addEventListener('input', updateDisplays);
document.getElementById('msgFreq').addEventListener('input', updateDisplays);
document.getElementById('msgWaveform').addEventListener('change', updateDisplays);
document.getElementById('carAmp').addEventListener('input', updateDisplays);
document.getElementById('carFreq').addEventListener('input', updateDisplays);
document.getElementById('modType').addEventListener('change', updateDisplays);
document.querySelectorAll('input[name="ssbType"]').forEach(radio => {
  radio.addEventListener('change', updateDisplays);
});

// Initial display
updateDisplays();