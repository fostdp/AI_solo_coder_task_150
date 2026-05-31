const CanvasRenderer = (function() {
  let mainCanvas, mainCtx;
  let tempProfileCanvas, tempProfileCtx;
  let sputterProfileCanvas, sputterProfileCtx;
  let historyCanvas, historyCtx;
  let width, height;
  let temperatureHistory = [];
  const maxHistoryPoints = 200;

  const COLOR_SCHEMES = {
    temperature: [
      { temp: 20, color: [0, 0, 128] },
      { temp: 100, color: [0, 0, 255] },
      { temp: 200, color: [0, 128, 255] },
      { temp: 400, color: [0, 255, 255] },
      { temp: 600, color: [0, 255, 128] },
      { temp: 800, color: [128, 255, 0] },
      { temp: 1000, color: [255, 255, 0] },
      { temp: 1200, color: [255, 128, 0] },
      { temp: 1500, color: [255, 0, 0] },
      { temp: 2000, color: [204, 0, 0] },
      { temp: 3000, color: [128, 0, 0] }
    ]
  };

  function init(mainCanvasId, tempProfileId, sputterProfileId, historyId) {
    mainCanvas = document.getElementById(mainCanvasId);
    mainCtx = mainCanvas.getContext('2d');
    
    tempProfileCanvas = document.getElementById(tempProfileId);
    tempProfileCtx = tempProfileCanvas.getContext('2d');
    
    sputterProfileCanvas = document.getElementById(sputterProfileId);
    sputterProfileCtx = sputterProfileCanvas.getContext('2d');
    
    historyCanvas = document.getElementById(historyId);
    historyCtx = historyCanvas.getContext('2d');

    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
  }

  function resizeCanvases() {
    [mainCanvas, tempProfileCanvas, sputterProfileCanvas, historyCanvas].forEach(canvas => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    });

    const rect = mainCanvas.parentElement.getBoundingClientRect();
    width = mainCanvas.width;
    height = mainCanvas.height;
  }

  function getTemperatureColor(temp, minTemp, maxTemp) {
    const scheme = COLOR_SCHEMES.temperature;
    const normalized = (temp - minTemp) / (maxTemp - minTemp);
    const clamped = Math.max(0, Math.min(1, normalized));
    const index = clamped * (scheme.length - 1);
    const lower = Math.floor(index);
    const upper = Math.min(lower + 1, scheme.length - 1);
    const frac = index - lower;

    const c1 = scheme[lower].color;
    const c2 = scheme[upper].color;

    const r = Math.round(c1[0] + (c2[0] - c1[0]) * frac);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * frac);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * frac);

    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawDivertor(params, simulationData, time) {
    const ctx = mainCtx;
    const { temperatures, heatFluxes, strikePointX, maxTemperature } = simulationData;
    const { targetWidth, numGridPoints, ambientTemperature } = params;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 60, bottom: 80, left: 80, right: 60 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    drawScrapeOffLayer(ctx, padding, plotWidth, plotHeight, strikePointX, params, time);

    const targetY = padding.top + plotHeight * 0.75;
    const targetHeight = 40;

    for (let i = 0; i < numGridPoints; i++) {
      const x = padding.left + (i / (numGridPoints - 1)) * plotWidth;
      const temp = temperatures[i];
      const color = getTemperatureColor(temp, ambientTemperature, Math.max(1200, maxTemperature));
      
      const segmentWidth = plotWidth / numGridPoints + 1;
      ctx.fillStyle = color;
      ctx.fillRect(x, targetY, segmentWidth, targetHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x, targetY, segmentWidth, 3);
    }

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding.left, targetY, plotWidth, targetHeight);

    drawStrikePointIndicator(ctx, padding, plotWidth, targetY, targetHeight, strikePointX, targetWidth);

    drawHeatFluxLines(ctx, padding, plotWidth, heatFluxes, targetY, targetWidth, numGridPoints);

    drawMainAxes(ctx, padding, plotWidth, plotHeight, targetWidth, maxTemperature);

    drawPlasmaRegion(ctx, padding, plotWidth, plotHeight, time);

    drawTitle(ctx, width, simulationData);
  }

  function drawScrapeOffLayer(ctx, padding, plotWidth, plotHeight, strikePointX, params, time) {
    const targetY = padding.top + plotHeight * 0.75;
    const centerX = padding.left + plotWidth / 2;
    
    const gradient = ctx.createLinearGradient(centerX, padding.top, centerX, targetY);
    gradient.addColorStop(0, 'rgba(0, 100, 200, 0.1)');
    gradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 255, 200, 0.3)');

    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.quadraticCurveTo(centerX, padding.top + plotHeight * 0.3, padding.left + plotWidth * 0.3, targetY);
    ctx.lineTo(padding.left + plotWidth * 0.7, targetY);
    ctx.quadraticCurveTo(centerX, padding.top + plotHeight * 0.3, padding.left + plotWidth, padding.top);
    ctx.lineTo(padding.left, padding.top);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    const magneticLines = 8;
    for (let i = 0; i < magneticLines; i++) {
      const t = i / (magneticLines - 1);
      const startX = padding.left + plotWidth * (0.1 + t * 0.8);
      const wobble = Math.sin(time * 2 + i) * 3;
      
      ctx.beginPath();
      ctx.moveTo(startX, padding.top + 10);
      ctx.quadraticCurveTo(
        centerX + wobble,
        padding.top + plotHeight * 0.4,
        padding.left + plotWidth * 0.5 + (t - 0.5) * plotWidth * 0.6,
        targetY
      );
      ctx.strokeStyle = `rgba(255, 100, 100, ${0.3 + t * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawStrikePointIndicator(ctx, padding, plotWidth, targetY, targetHeight, strikePointX, targetWidth) {
    const normalizedPos = (strikePointX + targetWidth / 2) / targetWidth;
    const x = padding.left + normalizedPos * plotWidth;

    const gradient = ctx.createLinearGradient(x, targetY - 150, x, targetY);
    gradient.addColorStop(0, 'rgba(255, 50, 50, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 200, 50, 0.9)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - 20, targetY - 150);
    ctx.lineTo(x + 20, targetY - 150);
    ctx.lineTo(x + 8, targetY);
    ctx.lineTo(x - 8, targetY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, targetY, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, targetY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * window.devicePixelRatio}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`打击点: ${strikePointX.toFixed(2)} m`, x, targetY + targetHeight + 25);
  }

  function drawHeatFluxLines(ctx, padding, plotWidth, heatFluxes, targetY, targetWidth, numGridPoints) {
    const maxFlux = Math.max(...heatFluxes, 1);

    ctx.beginPath();
    for (let i = 0; i < numGridPoints; i++) {
      const x = padding.left + (i / (numGridPoints - 1)) * plotWidth;
      const flux = heatFluxes[i];
      const height = (flux / maxFlux) * 100;
      const y = targetY - height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = 'rgba(255, 150, 50, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(padding.left + plotWidth, targetY);
    ctx.lineTo(padding.left, targetY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 150, 50, 0.2)';
    ctx.fill();
  }

  function drawMainAxes(ctx, padding, plotWidth, plotHeight, targetWidth, maxTemperature) {
    const targetY = padding.top + plotHeight * 0.75;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, targetY + 50);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padding.left - 10, targetY + 50);
    ctx.lineTo(padding.left + plotWidth + 10, targetY + 50);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${11 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';

    for (let i = -1; i <= 1; i += 0.5) {
      const x = padding.left + ((i + targetWidth / 2) / targetWidth) * plotWidth;
      ctx.fillText(i.toFixed(1) + 'm', x, targetY + 70);
      
      ctx.beginPath();
      ctx.moveTo(x, targetY + 50);
      ctx.lineTo(x, targetY + 55);
      ctx.stroke();
    }

    ctx.fillText('靶板位置 (m)', padding.left + plotWidth / 2, targetY + 95);

    ctx.save();
    ctx.translate(20, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('温度 (°C)', 0, 0);
    ctx.restore();
  }

  function drawPlasmaRegion(ctx, padding, plotWidth, plotHeight, time) {
    const centerX = padding.left + plotWidth / 2;
    const centerY = padding.top + plotHeight * 0.25;
    const radiusX = plotWidth * 0.3;
    const radiusY = plotHeight * 0.18;

    for (let i = 3; i >= 0; i--) {
      const r = i / 3;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusX * (0.5 + r * 0.5));
      gradient.addColorStop(0, `rgba(255, 100, 50, ${0.3 * (1 - r)})`);
      gradient.addColorStop(0.5, `rgba(255, 200, 100, ${0.2 * (1 - r)})`);
      gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX * (0.8 + r * 0.2), radiusY * (0.8 + r * 0.2), 0, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    const particles = 20;
    for (let i = 0; i < particles; i++) {
      const angle = (i / particles) * Math.PI * 2 + time * 0.5;
      const r = 0.7 + Math.sin(time * 2 + i) * 0.1;
      const px = centerX + Math.cos(angle) * radiusX * r;
      const py = centerY + Math.sin(angle) * radiusY * r;
      
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 100, ${0.5 + Math.sin(time * 3 + i) * 0.3})`;
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${12 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('等离子体', centerX, centerY + 4);
  }

  function drawTitle(ctx, width, data) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `bold ${16 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('偏滤器靶板热负荷分布', width / 2, 30);

    ctx.font = `${11 * window.devicePixelRatio}px 'Courier New', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `Tmax: ${data.maxTemperature.toFixed(1)}°C  |  热通量: ${data.maxHeatFlux.toFixed(2)} MW/m²`,
      width - 20,
      30
    );
  }

  function drawTemperatureProfile(params, simulationData) {
    const ctx = tempProfileCtx;
    const canvas = tempProfileCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const padding = { left: 50, right: 20, top: 20, bottom: 30 };

    ctx.clearRect(0, 0, w, h);

    const { temperatures } = simulationData;
    const { targetWidth, numGridPoints, ambientTemperature } = params;
    const maxTemp = Math.max(1200, simulationData.maxTemperature);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * (h - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const temp = maxTemp - (i / 4) * (maxTemp - ambientTemperature);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = `${10 * window.devicePixelRatio}px 'Courier New', monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(temp.toFixed(0) + '°', padding.left - 5, y + 3);
    }

    ctx.beginPath();
    for (let i = 0; i < numGridPoints; i++) {
      const x = padding.left + (i / (numGridPoints - 1)) * (w - padding.left - padding.right);
      const temp = temperatures[i];
      const y = padding.top + (1 - (temp - ambientTemperature) / (maxTemp - ambientTemperature)) * (h - padding.top - padding.bottom);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(0.5, '#ffaa00');
    gradient.addColorStop(1, '#4488ff');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${10 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('位置 (m)', w / 2, h - 8);
  }

  function drawSputteringProfile(params, simulationData) {
    const ctx = sputterProfileCtx;
    const canvas = sputterProfileCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const padding = { left: 50, right: 20, top: 20, bottom: 30 };

    ctx.clearRect(0, 0, w, h);

    const { sputteringRates } = simulationData;
    const { numGridPoints } = params;
    const maxSputter = Math.max(0.001, simulationData.maxSputteringRate);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * (h - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const rate = maxSputter * (1 - i / 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = `${10 * window.devicePixelRatio}px 'Courier New', monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(rate.toExponential(1), padding.left - 5, y + 3);
    }

    ctx.beginPath();
    for (let i = 0; i < numGridPoints; i++) {
      const x = padding.left + (i / (numGridPoints - 1)) * (w - padding.left - padding.right);
      const rate = sputteringRates[i];
      const y = padding.top + (1 - rate / maxSputter) * (h - padding.top - padding.bottom);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${10 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('位置 (m)', w / 2, h - 8);
  }

  function drawHistory(time, maxTemp, avgTemp) {
    temperatureHistory.push({ time, maxTemp, avgTemp });
    if (temperatureHistory.length > maxHistoryPoints) {
      temperatureHistory.shift();
    }

    const ctx = historyCtx;
    const canvas = historyCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const padding = { left: 60, right: 20, top: 20, bottom: 30 };

    ctx.clearRect(0, 0, w, h);

    if (temperatureHistory.length < 2) return;

    const maxT = Math.max(1200, ...temperatureHistory.map(p => p.maxTemp));
    const minT = 20;
    const timeRange = Math.max(1, temperatureHistory[temperatureHistory.length - 1].time - temperatureHistory[0].time);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * (h - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const temp = maxT - (i / 5) * (maxT - minT);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = `${10 * window.devicePixelRatio}px 'Courier New', monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(temp.toFixed(0) + '°C', padding.left - 5, y + 3);
    }

    ctx.beginPath();
    temperatureHistory.forEach((point, i) => {
      const x = padding.left + ((point.time - temperatureHistory[0].time) / timeRange) * (w - padding.left - padding.right);
      const y = padding.top + (1 - (point.maxTemp - minT) / (maxT - minT)) * (h - padding.top - padding.bottom);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ff6644';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    temperatureHistory.forEach((point, i) => {
      const x = padding.left + ((point.time - temperatureHistory[0].time) / timeRange) * (w - padding.left - padding.right);
      const y = padding.top + (1 - (point.avgTemp - minT) / (maxT - minT)) * (h - padding.top - padding.bottom);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${11 * window.devicePixelRatio}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('■ 最高温度', padding.left + 10, padding.top + 15);
    ctx.fillStyle = '#ff6644';
    ctx.fillText('■', padding.left + 10, padding.top + 15);
    
    ctx.fillStyle = '#44aaff';
    ctx.fillText('■', padding.left + 110, padding.top + 15);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('平均温度', padding.left + 125, padding.top + 15);

    ctx.textAlign = 'center';
    ctx.fillText('时间 (s)', w / 2, h - 8);
  }

  function clearHistory() {
    temperatureHistory = [];
  }

  return {
    init,
    drawDivertor,
    drawTemperatureProfile,
    drawSputteringProfile,
    drawHistory,
    clearHistory,
    getTemperatureColor
  };
})();
