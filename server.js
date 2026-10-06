const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'postgres123',
  host: 'localhost',
  port: 5432,
  database: 'agrohama'
});

client.connect();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Backend funcionando com PostgreSQL!' }));
    return;
  }

  if (req.url.startsWith('/api/operacoes-abertas')) {
    const trator = new URL('http://localhost' + req.url).searchParams.get('trator');
    try {
      const result = await client.query(
        'SELECT * FROM operacoes WHERE tractor = $1 AND status = $2 LIMIT 1',
        [trator, 'andamento']
      );
      const row = result.rows[0];
      const normalized = row ? {
        id: row.id,
        tractor: row.tractor,
        operator: row.operator,
        farm: row.farm,
        plot: row.plot,
        culture: row.culture,
        operation: row.operation,
        implement: row.implement,
        formNumber: row.formnumber,
        horaInicio: row.horainicio,
        horaFinal: row.horafinal,
        horimetroInicial: row.horimetroinicial,
        horimetroFinal: row.horimetrofinal,
        obs: row.obs,
        status: row.status,
        createdAt: new Date(row.createdat).getTime(),
        updatedAt: new Date(row.updatedat).getTime(),
        date: row.date
      } : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(normalized));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: err.message }));
    }
    return;
  }

  if (req.url === '/api/operacoes' && req.method === 'GET') {
    try {
      const result = await client.query('SELECT * FROM operacoes ORDER BY createdAt DESC');
      const normalized = result.rows.map(r => ({
        id: r.id,
        tractor: r.tractor,
        operator: r.operator,
        farm: r.farm,
        plot: r.plot,
        culture: r.culture,
        operation: r.operation,
        implement: r.implement,
        formNumber: r.formnumber,
        horaInicio: r.horainicio,
        horaFinal: r.horafinal,
        horimetroInicial: r.horimetroinicial,
        horimetroFinal: r.horimetrofinal,
        obs: r.obs,
        status: r.status,
        synced: true,
        createdAt: new Date(r.createdat).getTime(),
        updatedAt: new Date(r.updatedat).getTime(),
        date: r.date,
        fotos: null,
        checklist: null,
        problema: null,
        launched: false
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(normalized));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: err.message }));
    }
    return;
  }

  if (req.url === '/api/operacoes' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('POST /api/operacoes - Dados recebidos:', data);

        const status = data.evento === 'inicio' ? 'andamento' : data.evento;
        const orNull = (val) => val === '' || val === null ? null : val;

        await client.query(
          `INSERT INTO operacoes (id, tractor, operator, farm, plot, culture, operation, implement, formnumber, horainicio, horafinal, horimetroinicial, horimetrofinal, obs, status, date, updatedat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO UPDATE SET
             tractor = $2,
             operator = $3,
             farm = $4,
             plot = $5,
             culture = $6,
             operation = $7,
             implement = $8,
             formnumber = $9,
             horainicio = $10,
             horafinal = $11,
             horimetroinicial = $12,
             horimetrofinal = $13,
             obs = $14,
             status = $15,
             date = $16,
             updatedat = $17`,
          [
            data.record.id,
            orNull(data.record.tractor),
            orNull(data.record.operator),
            orNull(data.record.farm),
            orNull(data.record.plot),
            orNull(data.record.culture),
            orNull(data.record.operation),
            orNull(data.record.implement),
            orNull(data.record.formNumber),
            orNull(data.record.horaInicio),
            orNull(data.record.horaFinal),
            orNull(data.record.horimetroInicial),
            orNull(data.record.horimetroFinal),
            orNull(data.record.obs),
            status,
            new Date(),
            new Date().getTime()
          ]
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ recebido: true }));
      } catch (err) {
        console.log('ERRO:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: err.message }));
      }
    });
    return;
  }

  if (req.url.startsWith('/api/operacoes/') && req.method === 'DELETE') {
    const id = req.url.split('/').pop();
    try {
      await client.query('DELETE FROM operacoes WHERE id = $1', [id]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deletado: true }));
    } catch (err) {
      console.log('ERRO ao deletar:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: err.message }));
    }
    return;
  }

  // Servir arquivos estáticos
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: 'Não encontrado' }));
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : 
                       ext === '.js' ? 'application/javascript' :
                       ext === '.json' ? 'application/json' :
                       'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(3000, '0.0.0.0', function() {
  console.log('Backend com PostgreSQL rodando em http://192.168.1.70:3000');
});