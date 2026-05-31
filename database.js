const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'divertor_sim.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS simulations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          plasma_current REAL,
          magnetic_field REAL,
          electron_density REAL,
          electron_temperature REAL,
          impurity_concentration REAL,
          impurity_type TEXT,
          strike_point_position REAL,
          description TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS temperature_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER,
          timestamp REAL,
          strike_point_x REAL,
          max_temperature REAL,
          avg_temperature REAL,
          max_sputtering_rate REAL,
          max_heat_flux REAL,
          peak_heat_flux_position REAL,
          temperature_data TEXT,
          sputtering_data TEXT,
          heat_flux_data TEXT,
          FOREIGN KEY (simulation_id) REFERENCES simulations(id)
        )
      `);

      db.run(`ALTER TABLE temperature_snapshots ADD COLUMN max_heat_flux REAL`, (err) => {});
      db.run(`ALTER TABLE temperature_snapshots ADD COLUMN peak_heat_flux_position REAL`, (err) => {});
      db.run(`ALTER TABLE temperature_snapshots ADD COLUMN heat_flux_data TEXT`, (err) => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS run_parameters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          parameter_name TEXT,
          parameter_value REAL,
          FOREIGN KEY (simulation_id) REFERENCES simulations(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function createSimulation(params) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO simulations (
        name, plasma_current, magnetic_field, electron_density,
        electron_temperature, impurity_concentration, impurity_type,
        strike_point_position, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      params.name || `Simulation ${Date.now()}`,
      params.plasmaCurrent,
      params.magneticField,
      params.electronDensity,
      params.electronTemperature,
      params.impurityConcentration,
      params.impurityType,
      params.strikePointPosition,
      params.description || '',
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

function getSimulations() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM simulations ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getSimulationById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM simulations WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function saveTemperatureSnapshot(snapshot) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO temperature_snapshots (
        simulation_id, timestamp, strike_point_x, max_temperature,
        avg_temperature, max_sputtering_rate, max_heat_flux, 
        peak_heat_flux_position, temperature_data, sputtering_data, heat_flux_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      snapshot.simulationId,
      snapshot.timestamp,
      snapshot.strikePointX,
      snapshot.maxTemperature,
      snapshot.avgTemperature,
      snapshot.maxSputteringRate,
      snapshot.maxHeatFlux || 0,
      snapshot.peakHeatFluxPosition || 0,
      JSON.stringify(snapshot.temperatureData),
      JSON.stringify(snapshot.sputteringData),
      JSON.stringify(snapshot.heatFluxData || []),
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

function getSnapshotsBySimulationId(simulationId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM temperature_snapshots 
      WHERE simulation_id = ? 
      ORDER BY timestamp ASC
    `, [simulationId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function saveRunParameter(param) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO run_parameters (
        simulation_id, parameter_name, parameter_value
      ) VALUES (?, ?, ?)
    `);
    
    stmt.run(
      param.simulationId,
      param.parameterName,
      param.parameterValue,
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

function getRunParametersBySimulationId(simulationId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM run_parameters 
      WHERE simulation_id = ? 
      ORDER BY timestamp ASC
    `, [simulationId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function deleteSimulation(id) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM temperature_snapshots WHERE simulation_id = ?', [id]);
      db.run('DELETE FROM run_parameters WHERE simulation_id = ?', [id]);
      db.run('DELETE FROM simulations WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = {
  initDatabase,
  createSimulation,
  getSimulations,
  getSimulationById,
  saveTemperatureSnapshot,
  getSnapshotsBySimulationId,
  saveRunParameter,
  getRunParametersBySimulationId,
  deleteSimulation
};
