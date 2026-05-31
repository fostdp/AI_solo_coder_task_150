const App = (function() {
  let params = HeatModel.getDefaultParams();
  let currentSimulationId = null;
  let simulationName = '';
  
  let isRunning = false;
  let isPaused = false;
  let simulationTime = 0;
  let lastFrameTime = 0;
  let animationFrameId = null;
  
  let temperatures = null;
  let simulationData = null;
  
  let simulationSpeed = 1.0;
  let autoSaveInterval = 5;
  let lastSaveTime = 0;
  let pendingSnapshots = [];

  const elements = {};

  function init() {
    cacheElements();
    setupEventListeners();
    CanvasRenderer.init('mainCanvas', 'tempProfileCanvas', 'sputterProfileCanvas', 'historyCanvas');
    loadSimulations();
    resetSimulation();
    render();
  }

  function cacheElements() {
    elements.plasmaCurrent = document.getElementById('plasmaCurrent');
    elements.plasmaCurrentValue = document.getElementById('plasmaCurrentValue');
    elements.magneticField = document.getElementById('magneticField');
    elements.magneticFieldValue = document.getElementById('magneticFieldValue');
    elements.electronDensity = document.getElementById('electronDensity');
    elements.electronDensityValue = document.getElementById('electronDensityValue');
    elements.electronTemp = document.getElementById('electronTemp');
    elements.electronTempValue = document.getElementById('electronTempValue');
    elements.impurityType = document.getElementById('impurityType');
    elements.impurityConc = document.getElementById('impurityConc');
    elements.impurityConcValue = document.getElementById('impurityConcValue');
    elements.strikePointPos = document.getElementById('strikePointPos');
    elements.strikePointPosValue = document.getElementById('strikePointPosValue');
    elements.strikePointOsc = document.getElementById('strikePointOsc');
    elements.strikePointOscValue = document.getElementById('strikePointOscValue');
    elements.oscFrequency = document.getElementById('oscFrequency');
    elements.oscFrequencyValue = document.getElementById('oscFrequencyValue');
    elements.startBtn = document.getElementById('startBtn');
    elements.pauseBtn = document.getElementById('pauseBtn');
    elements.resetBtn = document.getElementById('resetBtn');
    elements.simSpeed = document.getElementById('simSpeed');
    elements.simSpeedValue = document.getElementById('simSpeedValue');
    elements.autoSaveInterval = document.getElementById('autoSaveInterval');
    elements.autoSaveIntervalValue = document.getElementById('autoSaveIntervalValue');
    elements.maxTempDisplay = document.getElementById('maxTempDisplay');
    elements.avgTempDisplay = document.getElementById('avgTempDisplay');
    elements.maxHeatFluxDisplay = document.getElementById('maxHeatFluxDisplay');
    elements.maxSputterDisplay = document.getElementById('maxSputterDisplay');
    elements.runTimeDisplay = document.getElementById('runTimeDisplay');
    elements.effImpurityDisplay = document.getElementById('effImpurityDisplay');
    elements.radFactorDisplay = document.getElementById('radFactorDisplay');
    elements.solWidthDisplay = document.getElementById('solWidthDisplay');
    elements.simulationSelect = document.getElementById('simulationSelect');
    elements.newSimBtn = document.getElementById('newSimBtn');
    elements.saveSimBtn = document.getElementById('saveSimBtn');
    elements.deleteSimBtn = document.getElementById('deleteSimBtn');
    elements.newSimModal = document.getElementById('newSimModal');
    elements.simName = document.getElementById('simName');
    elements.simDescription = document.getElementById('simDescription');
    elements.createSimBtn = document.getElementById('createSimBtn');
    elements.cancelSimBtn = document.getElementById('cancelSimBtn');
  }

  function setupEventListeners() {
    elements.plasmaCurrent.addEventListener('input', updateParamsFromUI);
    elements.magneticField.addEventListener('input', updateParamsFromUI);
    elements.electronDensity.addEventListener('input', updateParamsFromUI);
    elements.electronTemp.addEventListener('input', updateParamsFromUI);
    elements.impurityType.addEventListener('change', updateParamsFromUI);
    elements.impurityConc.addEventListener('input', updateParamsFromUI);
    elements.strikePointPos.addEventListener('input', updateParamsFromUI);
    elements.strikePointOsc.addEventListener('input', updateParamsFromUI);
    elements.oscFrequency.addEventListener('input', updateParamsFromUI);
    elements.simSpeed.addEventListener('input', () => {
      simulationSpeed = parseFloat(elements.simSpeed.value);
      elements.simSpeedValue.textContent = simulationSpeed.toFixed(1);
    });
    elements.autoSaveInterval.addEventListener('input', () => {
      autoSaveInterval = parseInt(elements.autoSaveInterval.value);
      elements.autoSaveIntervalValue.textContent = autoSaveInterval;
    });

    elements.startBtn.addEventListener('click', startSimulation);
    elements.pauseBtn.addEventListener('click', togglePause);
    elements.resetBtn.addEventListener('click', resetSimulation);

    elements.newSimBtn.addEventListener('click', () => {
      elements.newSimModal.classList.add('active');
      elements.simName.value = `模拟 ${new Date().toLocaleString('zh-CN')}`;
      elements.simDescription.value = '';
    });
    elements.cancelSimBtn.addEventListener('click', () => {
      elements.newSimModal.classList.remove('active');
    });
    elements.createSimBtn.addEventListener('click', createNewSimulation);

    elements.saveSimBtn.addEventListener('click', saveCurrentParams);
    elements.deleteSimBtn.addEventListener('click', deleteCurrentSimulation);
    elements.simulationSelect.addEventListener('change', loadSimulation);

    elements.newSimModal.addEventListener('click', (e) => {
      if (e.target === elements.newSimModal) {
        elements.newSimModal.classList.remove('active');
      }
    });

    window.addEventListener('resize', () => {
      setTimeout(render, 100);
    });
  }

  function updateParamsFromUI() {
    params.plasmaCurrent = parseFloat(elements.plasmaCurrent.value);
    params.magneticField = parseFloat(elements.magneticField.value);
    params.electronDensity = parseFloat(elements.electronDensity.value) * 1e19;
    params.electronTemperature = parseFloat(elements.electronTemp.value);
    params.impurityType = elements.impurityType.value;
    params.impurityConcentration = parseFloat(elements.impurityConc.value) / 100;
    params.strikePointPosition = parseFloat(elements.strikePointPos.value);
    params.strikePointOscillation = parseFloat(elements.strikePointOsc.value);
    params.oscillationFrequency = parseFloat(elements.oscFrequency.value);

    elements.plasmaCurrentValue.textContent = params.plasmaCurrent.toFixed(1);
    elements.magneticFieldValue.textContent = params.magneticField.toFixed(1);
    elements.electronDensityValue.textContent = (params.electronDensity * 1e-19).toFixed(1);
    elements.electronTempValue.textContent = params.electronTemperature.toFixed(1);
    elements.impurityConcValue.textContent = (params.impurityConcentration * 100).toFixed(1);
    elements.strikePointPosValue.textContent = params.strikePointPosition.toFixed(2);
    elements.strikePointOscValue.textContent = params.strikePointOscillation.toFixed(1);
    elements.oscFrequencyValue.textContent = params.oscillationFrequency.toFixed(1);

    if (!isRunning) {
      performSimulationStep(0);
      render();
    }
  }

  function startSimulation() {
    if (!currentSimulationId) {
      alert('请先创建或选择一个模拟');
      return;
    }

    if (isRunning && !isPaused) return;

    if (isPaused) {
      isPaused = false;
      elements.pauseBtn.textContent = '暂停';
    } else {
      isRunning = true;
      isPaused = false;
      lastFrameTime = performance.now();
    }

    elements.startBtn.disabled = true;
    elements.pauseBtn.disabled = false;
    lastSaveTime = simulationTime;

    simulationLoop();
  }

  function togglePause() {
    isPaused = !isPaused;
    elements.pauseBtn.textContent = isPaused ? '继续' : '暂停';
    
    if (!isPaused) {
      lastFrameTime = performance.now();
      simulationLoop();
    }
  }

  function resetSimulation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    isRunning = false;
    isPaused = false;
    simulationTime = 0;
    temperatures = null;
    pendingSnapshots = [];
    CanvasRenderer.clearHistory();

    elements.startBtn.disabled = false;
    elements.pauseBtn.disabled = true;
    elements.pauseBtn.textContent = '暂停';

    performSimulationStep(0);
    updateDataDisplay();
    render();
  }

  function simulationLoop(timestamp) {
    if (!isRunning || isPaused) return;

    const dt = Math.min(0.05, (timestamp - lastFrameTime) / 1000) * simulationSpeed;
    lastFrameTime = timestamp;

    simulationTime += dt;

    performSimulationStep(dt);
    updateDataDisplay();
    render();

    if (simulationTime - lastSaveTime >= autoSaveInterval) {
      autoSaveSnapshot();
      lastSaveTime = simulationTime;
    }

    animationFrameId = requestAnimationFrame(simulationLoop);
  }

  function performSimulationStep(dt) {
    const result = HeatModel.calculateTemperatureDistribution(
      params,
      temperatures,
      dt,
      simulationTime
    );

    temperatures = result.temperatures;
    simulationData = result;
  }

  function render() {
    if (!simulationData) return;

    CanvasRenderer.drawDivertor(params, simulationData, simulationTime);
    CanvasRenderer.drawTemperatureProfile(params, simulationData);
    CanvasRenderer.drawSputteringProfile(params, simulationData);
    CanvasRenderer.drawHistory(simulationTime, simulationData.maxTemperature, simulationData.avgTemperature);

    document.getElementById('colorBarMax').textContent = 
      Math.round(Math.max(1200, simulationData.maxTemperature));
  }

  function updateDataDisplay() {
    if (!simulationData) return;

    elements.maxTempDisplay.textContent = `${simulationData.maxTemperature.toFixed(1)} °C`;
    elements.avgTempDisplay.textContent = `${simulationData.avgTemperature.toFixed(1)} °C`;
    elements.maxHeatFluxDisplay.textContent = `${simulationData.maxHeatFlux.toFixed(2)} MW/m²`;
    elements.maxSputterDisplay.textContent = simulationData.maxSputteringRate.toExponential(2);
    elements.runTimeDisplay.textContent = `${simulationTime.toFixed(1)} s`;
    elements.effImpurityDisplay.textContent = `${(simulationData.effectiveImpurityConcentration * 100).toFixed(2)}%`;
    elements.radFactorDisplay.textContent = simulationData.radiationFactor.toFixed(3);
    elements.solWidthDisplay.textContent = `${(simulationData.solWidth * 1000).toFixed(2)} mm`;
  }

  async function loadSimulations() {
    try {
      const response = await fetch('/api/simulations');
      const simulations = await response.json();
      
      elements.simulationSelect.innerHTML = '<option value="">-- 选择/创建模拟 --</option>';
      simulations.forEach(sim => {
        const option = document.createElement('option');
        option.value = sim.id;
        option.textContent = `${sim.name} (${new Date(sim.created_at).toLocaleString('zh-CN')})`;
        elements.simulationSelect.appendChild(option);
      });

      if (currentSimulationId) {
        elements.simulationSelect.value = currentSimulationId;
      }
    } catch (error) {
      console.error('加载模拟列表失败:', error);
    }
  }

  async function createNewSimulation() {
    const name = elements.simName.value.trim();
    const description = elements.simDescription.value.trim();

    if (!name) {
      alert('请输入模拟名称');
      return;
    }

    const simParams = {
      name,
      description,
      plasmaCurrent: params.plasmaCurrent,
      magneticField: params.magneticField,
      electronDensity: params.electronDensity,
      electronTemperature: params.electronTemperature,
      impurityConcentration: params.impurityConcentration,
      impurityType: params.impurityType,
      strikePointPosition: params.strikePointPosition
    };

    try {
      const response = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simParams)
      });
      const result = await response.json();
      
      currentSimulationId = result.id;
      simulationName = name;
      elements.newSimModal.classList.remove('active');
      
      await loadSimulations();
      elements.simulationSelect.value = currentSimulationId;
      
      console.log('模拟创建成功:', result);
    } catch (error) {
      console.error('创建模拟失败:', error);
      alert('创建模拟失败');
    }
  }

  async function loadSimulation() {
    const id = elements.simulationSelect.value;
    if (!id) {
      currentSimulationId = null;
      return;
    }

    try {
      const response = await fetch(`/api/simulations/${id}`);
      const sim = await response.json();
      
      currentSimulationId = sim.id;
      simulationName = sim.name;

      params.plasmaCurrent = sim.plasma_current;
      params.magneticField = sim.magnetic_field;
      params.electronDensity = sim.electron_density;
      params.electronTemperature = sim.electron_temperature;
      params.impurityConcentration = sim.impurity_concentration;
      params.impurityType = sim.impurity_type;
      params.strikePointPosition = sim.strike_point_position;

      updateUIFromParams();
      resetSimulation();
      loadSimulationHistory(id);
    } catch (error) {
      console.error('加载模拟失败:', error);
    }
  }

  async function loadSimulationHistory(simulationId) {
    try {
      const response = await fetch(`/api/simulations/${simulationId}/snapshots`);
      const snapshots = await response.json();
      
      CanvasRenderer.clearHistory();
      snapshots.forEach(snap => {
        CanvasRenderer.drawHistory(snap.timestamp, snap.max_temperature, snap.avg_temperature);
      });
    } catch (error) {
      console.error('加载历史数据失败:', error);
    }
  }

  function updateUIFromParams() {
    elements.plasmaCurrent.value = params.plasmaCurrent;
    elements.magneticField.value = params.magneticField;
    elements.electronDensity.value = params.electronDensity * 1e-19;
    elements.electronTemp.value = params.electronTemperature;
    elements.impurityType.value = params.impurityType;
    elements.impurityConc.value = params.impurityConcentration * 100;
    elements.strikePointPos.value = params.strikePointPosition;

    updateParamsFromUI();
  }

  async function saveCurrentParams() {
    if (!currentSimulationId) {
      alert('请先选择一个模拟');
      return;
    }

    const paramNames = [
      'plasmaCurrent', 'magneticField', 'electronDensity',
      'electronTemperature', 'impurityConcentration', 'strikePointPosition'
    ];

    try {
      for (const name of paramNames) {
        await fetch('/api/parameters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulationId: currentSimulationId,
            parameterName: name,
            parameterValue: params[name]
          })
        });
      }
      console.log('参数保存成功');
      alert('参数已保存');
    } catch (error) {
      console.error('保存参数失败:', error);
      alert('保存参数失败');
    }
  }

  async function autoSaveSnapshot() {
    if (!currentSimulationId || !simulationData) return;

    const snapshot = {
      simulationId: currentSimulationId,
      timestamp: simulationTime,
      strikePointX: simulationData.strikePointX,
      maxTemperature: simulationData.maxTemperature,
      avgTemperature: simulationData.avgTemperature,
      maxSputteringRate: simulationData.maxSputteringRate,
      maxHeatFlux: simulationData.maxHeatFlux,
      peakHeatFluxPosition: simulationData.peakHeatFluxPosition,
      temperatureData: simulationData.temperatures,
      sputteringData: simulationData.sputteringRates,
      heatFluxData: simulationData.heatFluxes
    };

    pendingSnapshots.push(snapshot);

    if (pendingSnapshots.length >= 5) {
      try {
        await fetch('/api/batch-snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshots: pendingSnapshots })
        });
        pendingSnapshots = [];
      } catch (error) {
        console.error('批量保存快照失败:', error);
      }
    }
  }

  async function deleteCurrentSimulation() {
    if (!currentSimulationId) {
      alert('请先选择一个模拟');
      return;
    }

    if (!confirm(`确定要删除模拟 "${simulationName}" 吗？所有相关数据都将被删除。`)) {
      return;
    }

    try {
      await fetch(`/api/simulations/${currentSimulationId}`, {
        method: 'DELETE'
      });
      
      if (isRunning) {
        resetSimulation();
      }
      
      currentSimulationId = null;
      simulationName = '';
      await loadSimulations();
      
      console.log('模拟删除成功');
    } catch (error) {
      console.error('删除模拟失败:', error);
      alert('删除模拟失败');
    }
  }

  return {
    init
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
