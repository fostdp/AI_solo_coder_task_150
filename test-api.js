const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testAPI() {
  console.log('测试后端API...\n');
  
  try {
    const simData = JSON.stringify({
      name: 'API测试',
      plasmaCurrent: 1.5,
      magneticField: 2.5,
      electronDensity: 5e19,
      electronTemperature: 3.0,
      impurityConcentration: 0.02,
      impurityType: 'Ne',
      strikePointPosition: 0.0
    });

    console.log('1. 创建模拟...');
    const createResult = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/simulations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, simData);
    
    console.log('   状态:', createResult.statusCode);
    console.log('   响应:', JSON.stringify(createResult.body).substring(0, 200));
    
    if (createResult.body && createResult.body.id) {
      const simId = createResult.body.id;
      
      const snapshot = JSON.stringify({
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

      console.log('\n2. 保存快照...');
      const snapResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/snapshots',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, snapshot);
      
      console.log('   状态:', snapResult.statusCode);
      console.log('   响应:', JSON.stringify(snapResult.body));

      console.log('\n3. 获取快照...');
      const getResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/simulations/${simId}/snapshots`,
        method: 'GET'
      });
      
      console.log('   状态:', getResult.statusCode);
      console.log('   快照数量:', Array.isArray(getResult.body) ? getResult.body.length : 0);
      
      if (Array.isArray(getResult.body) && getResult.body.length > 0) {
        const snap = getResult.body[0];
        console.log('   max_heat_flux:', snap.max_heat_flux);
        console.log('   peak_heat_flux_position:', snap.peak_heat_flux_position);
        console.log('   heat_flux_data存在:', snap.heat_flux_data !== undefined);
      }

      console.log('\n4. 清理测试数据...');
      const delResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/simulations/${simId}`,
        method: 'DELETE'
      });
      
      console.log('   状态:', delResult.statusCode);
    }
  } catch (error) {
    console.error('错误:', error.message);
  }
}

testAPI();