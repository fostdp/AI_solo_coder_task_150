const db = require('./database');
const HeatModel = require('./public/js/heatModel.js');

function assert(condition, testName, expected, actual) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    return { passed: true, name: testName };
  } else {
    console.log(`❌ FAIL: ${testName}`);
    console.log(`   期望: ${expected}`);
    console.log(`   实际: ${actual}`);
    return { passed: false, name: testName, expected, actual };
  }
}

function testModuleArchitecture() {
  console.log('\n========================================');
  console.log('测试0: 模块架构验证');
  console.log('========================================\n');

  const results = [];

  results.push(assert(
    typeof HeatModel.getSOLPhysics === 'function',
    '应暴露SOLPhysics模块',
    'getSOLPhysics是函数',
    typeof HeatModel.getSOLPhysics
  ));

  results.push(assert(
    typeof HeatModel.getImpurityRadiation === 'function',
    '应暴露ImpurityRadiation模块',
    'getImpurityRadiation是函数',
    typeof HeatModel.getImpurityRadiation
  ));

  results.push(assert(
    typeof HeatModel.getTargetHeatConduction === 'function',
    '应暴露TargetHeatConduction模块',
    'getTargetHeatConduction是函数',
    typeof HeatModel.getTargetHeatConduction
  ));

  const solPhysics = HeatModel.getSOLPhysics();
  results.push(assert(
    typeof solPhysics.calculateSOLWidth === 'function',
    'SOLPhysics应暴露calculateSOLWidth方法',
    'calculateSOLWidth是函数',
    typeof solPhysics.calculateSOLWidth
  ));

  results.push(assert(
    typeof solPhysics.calculateStrikePointOffset === 'function',
    'SOLPhysics应暴露calculateStrikePointOffset方法',
    'calculateStrikePointOffset是函数',
    typeof solPhysics.calculateStrikePointOffset
  ));

  results.push(assert(
    typeof solPhysics.calculateParallelHeatFlux === 'function',
    'SOLPhysics应暴露calculateParallelHeatFlux方法',
    'calculateParallelHeatFlux是函数',
    typeof solPhysics.calculateParallelHeatFlux
  ));

  const impurityRadiation = HeatModel.getImpurityRadiation();
  results.push(assert(
    typeof impurityRadiation.calculateRadiationLoss === 'function',
    'ImpurityRadiation应暴露calculateRadiationLoss方法',
    'calculateRadiationLoss是函数',
    typeof impurityRadiation.calculateRadiationLoss
  ));

  results.push(assert(
    typeof impurityRadiation.calculateRadiationFactor === 'function',
    'ImpurityRadiation应暴露calculateRadiationFactor方法',
    'calculateRadiationFactor是函数',
    typeof impurityRadiation.calculateRadiationFactor
  ));

  results.push(assert(
    typeof impurityRadiation.updateTransport === 'function',
    'ImpurityRadiation应暴露updateTransport方法',
    'updateTransport是函数',
    typeof impurityRadiation.updateTransport
  ));

  const targetHeatConduction = HeatModel.getTargetHeatConduction();
  results.push(assert(
    typeof targetHeatConduction.calculateSpatialHeatFluxDistribution === 'function',
    'TargetHeatConduction应暴露calculateSpatialHeatFluxDistribution方法',
    'calculateSpatialHeatFluxDistribution是函数',
    typeof targetHeatConduction.calculateSpatialHeatFluxDistribution
  ));

  results.push(assert(
    typeof targetHeatConduction.calculateTemperatureDerivative === 'function',
    'TargetHeatConduction应暴露calculateTemperatureDerivative方法',
    'calculateTemperatureDerivative是函数',
    typeof targetHeatConduction.calculateTemperatureDerivative
  ));

  return results;
}

function testSOLPhysicsModule() {
  console.log('\n========================================');
  console.log('测试1: 刮削层物理模块 (SOLPhysics)');
  console.log('========================================\n');

  const results = [];
  const solPhysics = HeatModel.getSOLPhysics();

  const solWidth1 = solPhysics.calculateSOLWidth(3.0, 2.5, 1e19);
  const solWidth2 = solPhysics.calculateSOLWidth(3.0, 2.5, 5e19);
  const solWidth3 = solPhysics.calculateSOLWidth(3.0, 2.5, 10e19);

  results.push(assert(
    solWidth1 > solWidth2 && solWidth2 > solWidth3,
    'SOL宽度应随密度增加而减小',
    'solWidth(1e19) > solWidth(5e19) > solWidth(10e19)',
    `${(solWidth1*1000).toFixed(2)}mm > ${(solWidth2*1000).toFixed(2)}mm > ${(solWidth3*1000).toFixed(2)}mm`
  ));

  const solWidthLowB = solPhysics.calculateSOLWidth(3.0, 1.0, 5e19);
  const solWidthHighB = solPhysics.calculateSOLWidth(3.0, 5.0, 5e19);

  results.push(assert(
    solWidthLowB > solWidthHighB,
    'SOL宽度应随磁场增加而减小',
    'solWidth(1T) > solWidth(5T)',
    `${(solWidthLowB*1000).toFixed(2)}mm > ${(solWidthHighB*1000).toFixed(2)}mm`
  ));

  const offsetLow = solPhysics.calculateStrikePointOffset(1e19, solWidth1);
  const offsetHigh = solPhysics.calculateStrikePointOffset(10e19, solWidth3);

  results.push(assert(
    offsetLow < 0 && offsetHigh > 0,
    '低密度时打击点应向内偏移，高密度时应向外偏移',
    'offset(1e19) < 0 < offset(10e19)',
    `${offsetLow.toFixed(4)} < 0 < ${offsetHigh.toFixed(4)}`
  ));

  const qParallel = solPhysics.calculateParallelHeatFlux({
    plasmaCurrent: 1.5,
    electronTemperature: 3.0,
    electronDensity: 5e19,
    magneticField: 2.5
  });

  results.push(assert(
    qParallel > 0,
    '平行热通量应为正值',
    'qParallel > 0',
    `${qParallel.toFixed(4)} MW/m²`
  ));

  const computeResult = solPhysics.compute({
    plasmaCurrent: 1.5,
    magneticField: 2.5,
    electronDensity: 5e19,
    electronTemperature: 3.0,
    strikePointPosition: 0.0,
    strikePointOscillation: 0.0,
    oscillationFrequency: 1.0
  }, 0);

  results.push(assert(
    'solWidth' in computeResult && 'strikePoint' in computeResult && 'qParallel' in computeResult,
    'compute方法应返回solWidth, strikePoint, qParallel',
    '返回对象包含必需字段',
    JSON.stringify(Object.keys(computeResult))
  ));

  return results;
}

function testImpurityRadiationModule() {
  console.log('\n========================================');
  console.log('测试2: 杂质辐射模块 (ImpurityRadiation)');
  console.log('========================================\n');

  const results = [];
  const impurityRadiation = HeatModel.getImpurityRadiation();

  HeatModel.resetImpurityState(0.0);

  const radiationLoss = impurityRadiation.calculateRadiationLoss(0.05, 5.0, 5e19, 3.0);
  const radiationFactor = impurityRadiation.calculateRadiationFactor(radiationLoss);

  results.push(assert(
    radiationFactor < 1.0,
    '有杂质时辐射因子应小于1',
    'radiationFactor < 1.0',
    `${radiationFactor.toFixed(4)}`
  ));

  const radiationLossLow = impurityRadiation.calculateRadiationLoss(0.02, 5.0, 5e19, 3.0);
  const radiationLossHigh = impurityRadiation.calculateRadiationLoss(0.08, 5.0, 5e19, 3.0);

  results.push(assert(
    radiationLossHigh > radiationLossLow,
    '辐射损失应随杂质浓度增加而增加',
    'radiationLoss(8%) > radiationLoss(2%)',
    `${radiationLossHigh.toFixed(4)} > ${radiationLossLow.toFixed(4)}`
  ));

  const radiationLossXe = impurityRadiation.calculateRadiationLoss(0.05, 20.0, 5e19, 3.0);
  const radiationLossNe = impurityRadiation.calculateRadiationLoss(0.05, 2.0, 5e19, 3.0);

  results.push(assert(
    radiationLossXe > radiationLossNe,
    '重杂质(Xe)应比轻杂质(Ne)产生更多辐射损失',
    'radiationLoss(Xe) > radiationLoss(Ne)',
    `${radiationLossXe.toFixed(4)} > ${radiationLossNe.toFixed(4)}`
  ));

  HeatModel.setEffectiveImpurityConcentration(0.0);
  const stateBefore = HeatModel.getImpurityState();

  impurityRadiation.updateTransport({
    impurityType: 'Ar',
    impurityConcentration: 0.05
  }, 0.1);

  const stateAfter = HeatModel.getImpurityState();

  results.push(assert(
    stateAfter.effectiveConcentration > stateBefore.effectiveConcentration,
    '杂质输运应使有效浓度向目标浓度增加',
    '有效浓度应增加',
    `${stateBefore.effectiveConcentration.toFixed(4)} -> ${stateAfter.effectiveConcentration.toFixed(4)}`
  ));

  return results;
}

function testTargetHeatConductionModule() {
  console.log('\n========================================');
  console.log('测试3: 靶板热传导模块 (TargetHeatConduction)');
  console.log('========================================\n');

  const results = [];
  const targetHeatConduction = HeatModel.getTargetHeatConduction();

  const heatFluxAtCenter = targetHeatConduction.calculateSpatialHeatFluxDistribution(
    10.0, 0.001, 0.0, 0.0, 3.0
  );
  const heatFluxAtEdge = targetHeatConduction.calculateSpatialHeatFluxDistribution(
    10.0, 0.001, 0.0, 1.4, 3.0
  );

  results.push(assert(
    heatFluxAtCenter > heatFluxAtEdge,
    '打击点处热通量应高于边缘',
    'heatFlux(center) > heatFlux(edge)',
    `${heatFluxAtCenter.toFixed(2)} > ${heatFluxAtEdge.toFixed(2)}`
  ));

  const temperatures = [20, 100, 200, 400, 600];
  const dTdt = targetHeatConduction.calculateTemperatureDerivative(
    temperatures, 2, 0.01, 1e6, 20
  );

  results.push(assert(
    typeof dTdt === 'number' && !isNaN(dTdt),
    '温度导数计算应返回有效数值',
    'dTdt是有效数值',
    `${dTdt.toFixed(4)} K/s`
  ));

  const sputtering = targetHeatConduction.calculatePhysicalSputtering(
    500, 10.0, 3.0
  );

  results.push(assert(
    sputtering >= 0,
    '溅射率应为非负值',
    'sputtering >= 0',
    sputtering.toExponential(4)
  ));

  const sputteringCold = targetHeatConduction.calculatePhysicalSputtering(
    20, 0.01, 1.0
  );

  results.push(assert(
    sputteringCold === 0,
    '低温低热通量时溅射率应为零',
    'sputtering = 0',
    `${sputteringCold}`
  ));

  return results;
}

function testUnifiedHeatFluxFramework() {
  console.log('\n========================================');
  console.log('测试4: 统一热通量框架集成测试');
  console.log('========================================\n');

  const results = [];
  const params = HeatModel.getDefaultParams();

  params.plasmaCurrent = 1.5;
  params.magneticField = 2.5;
  params.electronDensity = 5e19;
  params.electronTemperature = 3.0;
  params.impurityType = 'Ar';
  params.impurityConcentration = 0.05;
  params.strikePointPosition = 0.0;

  HeatModel.setEffectiveImpurityConcentration(0.05);

  const heatFluxResult = HeatModel.calculateHeatFlux(params, 0, 0);

  results.push(assert(
    'heatFlux' in heatFluxResult,
    'calculateHeatFlux应返回heatFlux字段',
    'heatFlux字段存在',
    `heatFlux = ${heatFluxResult.heatFlux.toFixed(4)} MW/m²`
  ));

  results.push(assert(
    'solPhysicsResult' in heatFluxResult,
    '结果应包含solPhysicsResult',
    'solPhysicsResult字段存在',
    'solPhysicsResult字段存在'
  ));

  results.push(assert(
    'radiationResult' in heatFluxResult,
    '结果应包含radiationResult',
    'radiationResult字段存在',
    'radiationResult字段存在'
  ));

  const tempDistribution = HeatModel.calculateTemperatureDistribution(
    params, null, 0.1, 0
  );

  results.push(assert(
    Array.isArray(tempDistribution.temperatures),
    '应返回温度数组',
    'temperatures是数组',
    `温度数组长度: ${tempDistribution.temperatures.length}`
  ));

  results.push(assert(
    Array.isArray(tempDistribution.heatFluxes),
    '应返回热通量数组',
    'heatFluxes是数组',
    `热通量数组长度: ${tempDistribution.heatFluxes.length}`
  ));

  results.push(assert(
    'maxTemperature' in tempDistribution && tempDistribution.maxTemperature > 0,
    '应返回有效最大温度',
    'maxTemperature > 0',
    `maxTemperature = ${tempDistribution.maxTemperature.toFixed(1)} °C`
  ));

  results.push(assert(
    'maxHeatFlux' in tempDistribution && tempDistribution.maxHeatFlux > 0,
    '应返回有效最大热通量',
    'maxHeatFlux > 0',
    `maxHeatFlux = ${tempDistribution.maxHeatFlux.toFixed(2)} MW/m²`
  ));

  return results;
}

async function testBackendHeatFluxData() {
  console.log('\n========================================');
  console.log('测试5: 后端温度快照热流数据');
  console.log('========================================\n');

  const results = [];

  try {
    await db.initDatabase();

    const simId = await db.createSimulation({
      name: '架构重构测试',
      plasmaCurrent: 1.5,
      magneticField: 2.5,
      electronDensity: 5e19,
      electronTemperature: 3.0,
      impurityConcentration: 0.02,
      impurityType: 'Ne',
      strikePointPosition: 0.0
    });

    results.push(assert(
      simId !== undefined,
      '创建模拟应返回ID',
      '返回模拟ID',
      `ID: ${simId}`
    ));

    const snapshotId = await db.saveTemperatureSnapshot({
      simulationId: simId,
      timestamp: 1.0,
      strikePointX: 0.05,
      maxTemperature: 850.5,
      avgTemperature: 450.2,
      maxSputteringRate: 1.5e-20,
      maxHeatFlux: 25.5,
      peakHeatFluxPosition: 0.03,
      temperatureData: [20, 100, 200, 400, 600, 800, 850, 700, 400, 100],
      sputteringData: [0, 0, 1e-21, 5e-21, 1e-20, 1.5e-20, 1e-20, 5e-21, 1e-21, 0],
      heatFluxData: [0.5, 2.0, 5.0, 10.0, 18.0, 25.5, 22.0, 15.0, 8.0, 2.0]
    });

    results.push(assert(
      snapshotId !== undefined,
      '保存快照应返回ID',
      '返回快照ID',
      `快照ID: ${snapshotId}`
    ));

    const snapshots = await db.getSnapshotsBySimulationId(simId);

    results.push(assert(
      Array.isArray(snapshots) && snapshots.length > 0,
      '应能获取保存的快照',
      '返回至少1个快照',
      `返回 ${snapshots.length} 个快照`
    ));

    if (snapshots.length > 0) {
      const savedSnap = snapshots[0];

      results.push(assert(
        savedSnap.max_heat_flux === 25.5,
        '峰值热流值应正确保存',
        '25.5',
        `${savedSnap.max_heat_flux}`
      ));

      results.push(assert(
        savedSnap.heat_flux_data !== null,
        '热流数据数组应正确保存',
        'heat_flux_data非空',
        savedSnap.heat_flux_data ? `长度: ${JSON.parse(savedSnap.heat_flux_data).length}` : 'null'
      ));
    }

    await db.deleteSimulation(simId);
    console.log('\n测试模拟已清理');

  } catch (error) {
    console.error('测试失败:', error.message);
  }

  return results;
}

function printFinalResults(results) {
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`总测试数: ${results.length}`);
  console.log(`✅ 通过: ${passed.length}`);
  console.log(`❌ 失败: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n失败用例明细:');
    failed.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}`);
      console.log(`     期望: ${f.expected}`);
      console.log(`     实际: ${f.actual}`);
    });
  }

  console.log('');
  return { passed: passed.length, failed: failed.length, total: results.length };
}

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   聚变堆偏滤器热负荷模拟 - 架构重构测试     ║');
  console.log('╚══════════════════════════════════════════════╝');

  const allResults = [];

  allResults.push(...testModuleArchitecture());
  allResults.push(...testSOLPhysicsModule());
  allResults.push(...testImpurityRadiationModule());
  allResults.push(...testTargetHeatConductionModule());
  allResults.push(...testUnifiedHeatFluxFramework());
  
  const backendResults = await testBackendHeatFluxData();
  allResults.push(...backendResults);

  const finalResult = printFinalResults(allResults);

  process.exit(finalResult.failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
  console.error('测试运行失败:', e);
  process.exit(1);
});