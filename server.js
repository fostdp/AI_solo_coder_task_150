const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/simulations', async (req, res) => {
  try {
    const simulations = await db.getSimulations();
    res.json(simulations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations/:id', async (req, res) => {
  try {
    const simulation = await db.getSimulationById(req.params.id);
    if (!simulation) {
      return res.status(404).json({ error: 'Simulation not found' });
    }
    res.json(simulation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/simulations', async (req, res) => {
  try {
    const id = await db.createSimulation(req.body);
    res.status(201).json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/simulations/:id', async (req, res) => {
  try {
    await db.deleteSimulation(req.params.id);
    res.json({ message: 'Simulation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/snapshots', async (req, res) => {
  try {
    const id = await db.saveTemperatureSnapshot(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations/:id/snapshots', async (req, res) => {
  try {
    const snapshots = await db.getSnapshotsBySimulationId(req.params.id);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parameters', async (req, res) => {
  try {
    const id = await db.saveRunParameter(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations/:id/parameters', async (req, res) => {
  try {
    const parameters = await db.getRunParametersBySimulationId(req.params.id);
    res.json(parameters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batch-snapshots', async (req, res) => {
  try {
    const { snapshots } = req.body;
    const ids = [];
    for (const snapshot of snapshots) {
      const id = await db.saveTemperatureSnapshot(snapshot);
      ids.push(id);
    }
    res.status(201).json({ ids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await db.initDatabase();
    console.log('数据库初始化完成');
    app.listen(PORT, () => {
      console.log(`聚变堆偏滤器热负荷模拟服务器运行在 http://localhost:${PORT}`);
      console.log('按 Ctrl+C 停止服务器');
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
