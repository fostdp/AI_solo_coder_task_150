const HeatModel = (function() {

  const SOLPhysics = (function() {
    const SOL_WIDTH_COEFF = 0.01;
    const DENSITY_REFERENCE = 5.0e19;
    const DENSITY_EFFECT_STRENGTH = 2.0;
    const Q_PARALLEL_COEFF = 1.5;

    function calculateSOLWidth(electronTemperature, magneticField, electronDensity) {
      const normalizedDensity = electronDensity * 1e-19;
      return SOL_WIDTH_COEFF * Math.sqrt(electronTemperature) / 
             (magneticField * Math.sqrt(normalizedDensity));
    }

    function calculateStrikePointOffset(electronDensity, solWidth) {
      const densityEffect = (electronDensity - DENSITY_REFERENCE) / DENSITY_REFERENCE;
      return densityEffect * solWidth * DENSITY_EFFECT_STRENGTH;
    }

    function calculateStrikePointPosition(params, time, solWidth) {
      const { strikePointPosition, electronDensity, strikePointOscillation, oscillationFrequency } = params;
      
      const offset = calculateStrikePointOffset(electronDensity, solWidth);
      const oscAmplitude = strikePointOscillation / 100;
      const oscillation = oscAmplitude * Math.sin(2 * Math.PI * oscillationFrequency * time);
      
      return strikePointPosition + offset + oscillation;
    }

    function calculateParallelHeatFlux(params) {
      const { plasmaCurrent, electronTemperature, electronDensity, magneticField } = params;
      const normalizedDensity = electronDensity * 1e-19;
      return Q_PARALLEL_COEFF * plasmaCurrent * 
             Math.sqrt(electronTemperature * normalizedDensity) / magneticField;
    }

    function compute(params, time) {
      const solWidth = calculateSOLWidth(
        params.electronTemperature, 
        params.magneticField, 
        params.electronDensity
      );
      
      const strikePoint = calculateStrikePointPosition(params, time, solWidth);
      const qParallel = calculateParallelHeatFlux(params);

      return {
        solWidth,
        strikePoint,
        qParallel,
        strikePointOffset: calculateStrikePointOffset(params.electronDensity, solWidth)
      };
    }

    return {
      calculateSOLWidth,
      calculateStrikePointOffset,
      calculateStrikePointPosition,
      calculateParallelHeatFlux,
      compute
    };
  })();

  const ImpurityRadiation = (function() {
    const IMPURITY_PROPERTIES = {
      Ne: { atomicNumber: 10, atomicWeight: 20.18, radiationCoeff: 2.0, transportTime: 0.5e-3 },
      Ar: { atomicNumber: 18, atomicWeight: 39.95, radiationCoeff: 5.0, transportTime: 0.8e-3 },
      Kr: { atomicNumber: 36, atomicWeight: 83.80, radiationCoeff: 12.0, transportTime: 1.2e-3 },
      Xe: { atomicNumber: 54, atomicWeight: 131.29, radiationCoeff: 20.0, transportTime: 1.5e-3 },
      N: { atomicNumber: 7, atomicWeight: 28.01, radiationCoeff: 1.5, transportTime: 0.3e-3 }
    };

    const MIN_RADIATION_FACTOR = 0.1;
    const MIN_TRANSPORT_TIME = 0.01;

    let state = {
      effectiveConcentration: 0.02,
      lastConcentration: 0.02
    };

    function getImpurityProperties(impurityType) {
      return IMPURITY_PROPERTIES[impurityType] || IMPURITY_PROPERTIES.Ne;
    }

    function calculateRadiationLoss(effectiveConcentration, radiationCoeff, electronDensity, electronTemperature) {
      const normalizedDensity = electronDensity * 1e-19;
      return effectiveConcentration * radiationCoeff * normalizedDensity * Math.sqrt(electronTemperature);
    }

    function calculateRadiationFactor(radiationLoss) {
      return Math.max(MIN_RADIATION_FACTOR, 1 - radiationLoss);
    }

    function updateTransport(params, dt) {
      const impurity = getImpurityProperties(params.impurityType);
      const targetConc = params.impurityConcentration;
      const transportTime = impurity.transportTime;
      const tau = Math.max(transportTime, MIN_TRANSPORT_TIME);
      
      state.effectiveConcentration += 
        (targetConc - state.effectiveConcentration) * (dt / tau);
      
      state.lastConcentration = targetConc;
    }

    function compute(params, solPhysicsResult) {
      const impurity = getImpurityProperties(params.impurityType);
      const { electronDensity, electronTemperature } = params;
      
      const radiationLoss = calculateRadiationLoss(
        state.effectiveConcentration,
        impurity.radiationCoeff,
        electronDensity,
        electronTemperature
      );
      
      const radiationFactor = calculateRadiationFactor(radiationLoss);
      const q0 = solPhysicsResult.qParallel * radiationFactor;

      return {
        effectiveConcentration: state.effectiveConcentration,
        radiationLoss,
        radiationFactor,
        q0,
        impurityProperties: impurity
      };
    }

    function getState() {
      return { ...state };
    }

    function resetState(defaultConcentration = 0.02) {
      state.effectiveConcentration = defaultConcentration;
      state.lastConcentration = defaultConcentration;
    }

    function setEffectiveConcentration(conc) {
      state.effectiveConcentration = conc;
      state.lastConcentration = conc;
    }

    function getImpurityTypes() {
      return Object.keys(IMPURITY_PROPERTIES);
    }

    return {
      calculateRadiationLoss,
      calculateRadiationFactor,
      updateTransport,
      compute,
      getState,
      resetState,
      setEffectiveConcentration,
      getImpurityTypes,
      getImpurityProperties
    };
  })();

  const TargetHeatConduction = (function() {
    const TARGET_MATERIAL = {
      name: 'Tungsten (W)',
      atomicWeight: 183.84,
      atomicNumber: 74,
      density: 19300,
      specificHeat: 134,
      thermalConductivity: 173,
      meltingPoint: 3422,
      sputteringThreshold: 150,
      surfaceBondEnergy: 8.9
    };

    const TARGET_THICKNESS = 0.005;
    const EDGE_SOFTENING_WIDTH = 0.1;
    const FAR_FIELD_DECAY = 2;

    function calculateSpatialHeatFluxDistribution(q0, solWidth, strikePoint, position, targetWidth) {
      const decayWidth = solWidth * 3;
      const distanceFromStrike = Math.abs(position - strikePoint);

      let heatFlux;
      if (distanceFromStrike < decayWidth) {
        const normalizedDist = distanceFromStrike / decayWidth;
        heatFlux = q0 * Math.exp(-normalizedDist * normalizedDist) * (1 - 0.3 * normalizedDist);
      } else {
        heatFlux = q0 * 0.1 * Math.exp(-(distanceFromStrike - decayWidth) / (decayWidth * FAR_FIELD_DECAY));
      }

      const edgeFactor = 1 / (1 + Math.exp(-(Math.abs(position) - targetWidth / 2 + EDGE_SOFTENING_WIDTH) * 50));
      heatFlux *= (1 - edgeFactor);

      return Math.max(0, heatFlux);
    }

    function calculateTemperatureDerivative(temperatures, i, dx, heatFlux, ambientTemperature) {
      const k = TARGET_MATERIAL.thermalConductivity;
      const rho = TARGET_MATERIAL.density;
      const cp = TARGET_MATERIAL.specificHeat;
      const alpha = k / (rho * cp);

      if (i === 0 || i === temperatures.length - 1) {
        return (ambientTemperature - temperatures[i]) / 10.0;
      }

      const d2Tdx2 = (temperatures[i + 1] - 2 * temperatures[i] + temperatures[i - 1]) / (dx * dx);
      const surfaceHeat = heatFlux / (rho * cp * TARGET_THICKNESS);
      
      return alpha * d2Tdx2 + surfaceHeat;
    }

    function calculatePhysicalSputtering(temperature, heatFlux, electronTemperature) {
      if (heatFlux < 0.1) return 0;

      const ionEnergy = 2 * electronTemperature * 1000;
      const thresholdEnergy = TARGET_MATERIAL.sputteringThreshold;

      if (ionEnergy <= thresholdEnergy) return 0;

      const reducedEnergy = ionEnergy / thresholdEnergy;
      const s = 0.01 * (reducedEnergy - 1) * Math.exp(1 - reducedEnergy / 5);
      const flux = heatFlux * 1e6 / ionEnergy;
      const enhancedYield = s * (1 + 0.01 * (temperature - 300) / 100);

      return Math.max(0, enhancedYield * flux * 1e-23);
    }

    function compute(params, prevTemperatures, dt, time, solPhysicsResult, radiationResult) {
      const { numGridPoints, targetWidth, ambientTemperature, electronTemperature } = params;
      const dx = targetWidth / (numGridPoints - 1);

      let temperatures;
      if (Array.isArray(prevTemperatures)) {
        temperatures = prevTemperatures;
      } else {
        temperatures = new Array(numGridPoints).fill(ambientTemperature);
      }

      const newTemperatures = [...temperatures];
      const heatFluxes = [];
      const sputteringRates = [];

      let maxTemp = ambientTemperature;
      let maxHeatFlux = 0;
      let maxSputtering = 0;
      let avgTemp = 0;
      let peakHeatFluxPosition = 0;

      const { strikePoint, solWidth } = solPhysicsResult;
      const { q0 } = radiationResult;

      for (let i = 0; i < numGridPoints; i++) {
        const position = -targetWidth / 2 + i * dx;
        
        const localHeatFlux = calculateSpatialHeatFluxDistribution(
          q0, solWidth, strikePoint, position, targetWidth
        );
        heatFluxes.push(localHeatFlux);

        if (localHeatFlux > maxHeatFlux) {
          maxHeatFlux = localHeatFlux;
          peakHeatFluxPosition = position;
        }

        const dTdt = calculateTemperatureDerivative(
          temperatures, i, dx, localHeatFlux * 1e6, ambientTemperature
        );

        newTemperatures[i] = temperatures[i] + dTdt * dt;
        newTemperatures[i] = Math.max(
          ambientTemperature, 
          Math.min(TARGET_MATERIAL.meltingPoint, newTemperatures[i])
        );

        const sputtering = calculatePhysicalSputtering(
          newTemperatures[i], localHeatFlux, electronTemperature
        );
        sputteringRates.push(sputtering);
        maxSputtering = Math.max(maxSputtering, sputtering);

        maxTemp = Math.max(maxTemp, newTemperatures[i]);
        avgTemp += newTemperatures[i];
      }

      avgTemp /= numGridPoints;

      return {
        temperatures: newTemperatures,
        heatFluxes,
        sputteringRates,
        maxTemperature: maxTemp,
        avgTemperature: avgTemp,
        maxHeatFlux,
        maxSputteringRate: maxSputtering,
        peakHeatFluxPosition
      };
    }

    function getTargetMaterial() {
      return { ...TARGET_MATERIAL };
    }

    return {
      calculateSpatialHeatFluxDistribution,
      calculateTemperatureDerivative,
      calculatePhysicalSputtering,
      compute,
      getTargetMaterial
    };
  })();

  const HeatFluxFramework = (function() {
    const DEFAULT_PARAMS = {
      plasmaCurrent: 1.5,
      magneticField: 2.5,
      electronDensity: 5.0e19,
      electronTemperature: 3.0,
      impurityType: 'Ne',
      impurityConcentration: 0.02,
      strikePointPosition: 0.0,
      strikePointOscillation: 0.0,
      oscillationFrequency: 1.0,
      targetWidth: 3.0,
      numGridPoints: 200,
      ambientTemperature: 20
    };

    function validateParams(params) {
      const errors = [];
      
      if (params.plasmaCurrent < 0.1 || params.plasmaCurrent > 10) {
        errors.push('等离子体电流应在0.1-10 MA范围内');
      }
      if (params.magneticField < 0.1 || params.magneticField > 10) {
        errors.push('磁场强度应在0.1-10 T范围内');
      }
      if (params.electronDensity < 1e18 || params.electronDensity > 1e21) {
        errors.push('电子密度应在1e18-1e21 m⁻³范围内');
      }
      if (params.electronTemperature < 0.1 || params.electronTemperature > 20) {
        errors.push('电子温度应在0.1-20 keV范围内');
      }
      if (params.impurityConcentration < 0 || params.impurityConcentration > 1) {
        errors.push('杂质浓度应在0-1范围内');
      }
      if (!ImpurityRadiation.getImpurityProperties(params.impurityType)) {
        errors.push('无效的杂质类型');
      }

      return errors;
    }

    function calculateHeatFlux(params, position, time) {
      const solPhysicsResult = SOLPhysics.compute(params, time);
      const radiationResult = ImpurityRadiation.compute(params, solPhysicsResult);
      
      const heatFlux = TargetHeatConduction.calculateSpatialHeatFluxDistribution(
        radiationResult.q0,
        solPhysicsResult.solWidth,
        solPhysicsResult.strikePoint,
        position,
        params.targetWidth
      );

      return {
        heatFlux,
        strikePoint: solPhysicsResult.strikePoint,
        qParallel: solPhysicsResult.qParallel,
        radiationFactor: radiationResult.radiationFactor,
        solWidth: solPhysicsResult.solWidth,
        radiationLoss: radiationResult.radiationLoss,
        solPhysicsResult,
        radiationResult
      };
    }

    function calculateTemperatureDistribution(params, prevTemperatures, dt, time) {
      ImpurityRadiation.updateTransport(params, dt);
      
      const solPhysicsResult = SOLPhysics.compute(params, time);
      const radiationResult = ImpurityRadiation.compute(params, solPhysicsResult);
      const conductionResult = TargetHeatConduction.compute(
        params, prevTemperatures, dt, time, solPhysicsResult, radiationResult
      );

      return {
        ...conductionResult,
        strikePointX: solPhysicsResult.strikePoint,
        effectiveImpurityConcentration: radiationResult.effectiveConcentration,
        radiationFactor: radiationResult.radiationFactor,
        solWidth: solPhysicsResult.solWidth,
        solPhysicsResult,
        radiationResult
      };
    }

    function getDefaultParams() {
      return { ...DEFAULT_PARAMS };
    }

    function getImpurityTypes() {
      return ImpurityRadiation.getImpurityTypes();
    }

    function getTargetMaterial() {
      return TargetHeatConduction.getTargetMaterial();
    }

    function getImpurityState() {
      return ImpurityRadiation.getState();
    }

    function resetImpurityState(defaultConcentration) {
      ImpurityRadiation.resetState(defaultConcentration);
    }

    function setEffectiveImpurityConcentration(conc) {
      ImpurityRadiation.setEffectiveConcentration(conc);
    }

    function getSOLPhysics() {
      return SOLPhysics;
    }

    function getImpurityRadiation() {
      return ImpurityRadiation;
    }

    function getTargetHeatConduction() {
      return TargetHeatConduction;
    }

    return {
      calculateHeatFlux,
      calculateTemperatureDistribution,
      calculatePhysicalSputtering: TargetHeatConduction.calculatePhysicalSputtering,
      getDefaultParams,
      getImpurityTypes,
      getTargetMaterial,
      getImpurityState,
      resetImpurityState,
      setEffectiveImpurityConcentration,
      getSOLPhysics,
      getImpurityRadiation,
      getTargetHeatConduction,
      validateParams
    };
  })();

  return HeatFluxFramework;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeatModel;
}