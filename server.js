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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0] || {}));
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
        createdAt: r.createdat,
        updatedAt: r.updatedat,
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

        await client.query(
          'INSERT INTO operacoes (id, tractor, operator, farm, plot, culture, operation, implement, formNumber, horaInicio, horaFinal, horimetroInicial, horimetroFinal, obs, status, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
          [
            data.record.id,
            data.record.tractor,
            data.record.operator,
            data.record.farm,
            data.record.plot,
            data.record.culture,
            data.record.operation,
            data.record.implement,
            data.record.formNumber,
            data.record.horaInicio,
            data.record.horaFinal,
            data.record.horimetroInicial,
            data.record.horimetroFinal,
            data.record.obs,
            status,
            new Date()
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