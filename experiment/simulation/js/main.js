(() => {
  const canvas = document.getElementById('waveCanvas');
  const ctx = canvas.getContext('2d');
  const harmonicsRange = document.getElementById('harmonicsRange');
  const harmonicsCountLabel = document.getElementById('harmonicsCount');
  const harmonicsInfo = document.getElementById('harmonicsInfo');

  const width = canvas.width;
  const height = canvas.height;
  const margin = { left: 50, right: 30, top: 20, bottom: 50 };
  const f0 = 1;

  function drawGrid() {
    ctx.clearRect(0, 0, width, height);

    const gradBg = ctx.createRadialGradient(width / 2, height / 2, height / 4, width / 2, height / 2, height);
    gradBg.addColorStop(0, '#111a1f');
    gradBg.addColorStop(1, '#000000');
    ctx.fillStyle = gradBg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#244e57';
    ctx.lineWidth = 1;
    ctx.font = '12px Roboto Mono, monospace';
    ctx.fillStyle = '#448899';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gridStepX = 60;
    for (let i = 0; i <= Math.floor((width - margin.left - margin.right) / gridStepX); i++) {
      let x = margin.left + i * gridStepX;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, height - margin.bottom);
      ctx.stroke();
      let tMs = (i * gridStepX) / (width - margin.left - margin.right) * 1000;
      ctx.fillText(tMs.toFixed(0) + ' ms', x, height - margin.bottom + 18);
    }

    const gridStepY = 40;
    ctx.textAlign = 'right';
    for (let i = -Math.floor((height - margin.top - margin.bottom) / gridStepY); i <= Math.floor((height - margin.top - margin.bottom) / gridStepY); i++) {
      let y = height / 2 - i * gridStepY;
      if (y < margin.top || y > height - margin.bottom) continue;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
      ctx.fillText(i.toFixed(0), margin.left - 7, y);
    }

    ctx.strokeStyle = '#23fff1';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#23fff1';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(margin.left, height / 2);
    ctx.lineTo(width - margin.right, height / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = '#2afff9';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#2afff9';
    ctx.shadowBlur = 6;
    ctx.fillText('Time →', width / 2, height - 15);

    ctx.save();
    ctx.translate(18, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    ctx.shadowBlur = 0;
  }

  function drawFundamental(samples, amplitudeScale, yCenter) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(97, 218, 251, 0.25)';
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      let t = i / samples;
      let x = margin.left + i;
      let y = Math.sin(2 * Math.PI * f0 * t);
      let py = yCenter - y * amplitudeScale;
      if (i === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }

  let lastWaveformPoints = [];
  let animationId = null;

  function drawWave(harmonicsCount) {
    drawGrid();

    harmonicsCountLabel.textContent = harmonicsCount;
    harmonicsInfo.innerHTML = `
      Fundamental Frequency: 1 Hz (fixed for demonstration)<br />
      Displaying odd harmonics from n = 1 to ${harmonicsCount}
    `;

    const samples = width - margin.left - margin.right;
    const yCenter = height / 2;
    const amplitudeScale = (height - margin.top - margin.bottom) / 4;

    let targetPoints = [];
    for (let i = 0; i <= samples; i++) {
      let t = i / samples;
      let y = 0;
      for (let n = 1; n <= harmonicsCount; n += 2) {
        y += (1 / n) * Math.sin(2 * Math.PI * f0 * n * t);
      }
      y *= 4 / Math.PI;
      targetPoints.push(y);
    }

    let progress = 0;
    const startPoints = lastWaveformPoints.length === samples + 1 ? lastWaveformPoints : targetPoints.slice();

    if (animationId) cancelAnimationFrame(animationId);

    function animate() {
      progress += 1 / 60;
      if (progress > 1) progress = 1;

      ctx.clearRect(0, 0, width, height);
      drawGrid();
      drawFundamental(samples, amplitudeScale, yCenter);

      ctx.lineWidth = 4;
      ctx.shadowColor = '#0ffefb';
      ctx.shadowBlur = 18;

      let grad = ctx.createLinearGradient(margin.left, 0, width - margin.right, 0);
      grad.addColorStop(0, '#00ffd5');
      grad.addColorStop(0.5, '#00bfff');
      grad.addColorStop(1, '#00f0ff');

      ctx.strokeStyle = grad;
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        let x = margin.left + i;
        let interpY = startPoints[i] + (targetPoints[i] - startPoints[i]) * progress;
        let py = yCenter - interpY * amplitudeScale;
        if (i === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      const legendX = width - margin.right - 200;
      const legendY = margin.top + 20;
      ctx.fillStyle = '#16d9e3';
      ctx.font = 'bold 15px Roboto Mono, monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = '#16d9e3';
      ctx.shadowBlur = 12;
      ctx.fillText('Blue Glow: Sum of Odd Harmonics', legendX, legendY);
      ctx.fillText('Light Cyan: Fundamental (n=1)', legendX, legendY + 26);

      ctx.shadowBlur = 0;

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(legendX - 80, legendY - 6);
      ctx.lineTo(legendX - 50, legendY - 6);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(97, 218, 251, 0.25)';
      ctx.beginPath();
      ctx.moveTo(legendX - 80, legendY + 20);
      ctx.lineTo(legendX - 50, legendY + 20);
      ctx.stroke();

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        lastWaveformPoints = targetPoints.slice();
      }
    }

    animate();
  }

  function update() {
    let harmonicsCount = parseInt(harmonicsRange.value);
    if (harmonicsCount % 2 === 0) harmonicsCount -= 1;
    harmonicsRange.value = harmonicsCount;
    drawWave(harmonicsCount);
  }

  harmonicsRange.addEventListener('input', update);

  update();
})();
