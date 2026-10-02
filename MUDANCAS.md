# Mudanças Implementadas — Integração com Backend

## ✅ Alterações Realizadas no index.html:

### 1. **Nova URL de Backend (Ajustes)**
- ✔ Adicionado campo: "URL do Backend (novo sistema)"
- ✔ Campo de entrada aceita URLs como: `http://192.168.1.70:3000`
- ✔ Campo salvo em: `settings.backendUrl`

### 2. **Sincronização Inteligente (Auto-detecção)**
- ✔ `attemptSync()` agora verifica: se `backendUrl` está configurado, usa o Backend novo; senão usa Power Automate legacy
- ✔ Endpoint do Backend: `http://192.168.1.70:3000/api/operacoes`
- ✔ Payload enviado: `{evento, record}`

### 3. **Consulta de Operações Abertas**
- ✔ Novafunção `consultarOperacoesAbertas()`: Consulta `GET /api/operacoes-abertas?trator=MT02`
- ✔ Acionada ao preencher campo "Trator" na tela de Iniciar Operação
- ✔ Avisa o operador se já existe operação em aberto (best-effort, timeout 4s)

### 4. **Versão do Cache**
- ⚠️ **PRÓXIMO PASSO**: Incrementar `CACHE_VERSION` de `v7` para `v8` no `service-worker.js`

---

## 📋 Próximos Passos para Você:

### PASSO 1: Baixar os Arquivos do GitHub
```powershell
cd C:\agrohama-integracao

# Baixar manifest.json
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AGROHAMA/checklist-trator-app/main/manifest.json" -OutFile "manifest.json"

# Baixar service-worker.js
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AGROHAMA/checklist-trator-app/main/service-worker.js" -OutFile "service-worker.js"

# Verificar
ls
```

### PASSO 2: Modificar service-worker.js
Abra `service-worker.js` em Bloco de Notas e procure por:
```javascript
const CACHE_VERSION = 'v7';
```

Mude para:
```javascript
const CACHE_VERSION = 'v8';
```

**Salve o arquivo.**

### PASSO 3: Fazer Upload no GitHub
1. Acesse: https://github.com/AGROHAMA/checklist-trator-app
2. Clique em "Add file" → "Upload files"
3. Selecione os 3 arquivos:
   - `index.html` (modificado)
   - `manifest.json` (atualizado)
   - `service-worker.js` (cache versão v8)
4. Coloque mensagem: `Integração com Backend + consulta de operações abertas`
5. Clique em "Commit changes"

### PASSO 4: Configurar a URL do Backend no App
1. Abra o app PWA: https://agrohama.github.io/checklist-trator-app/
2. Vá em: **⚙️ Ajustes**
3. Na seção "Integração com Backend / Banco de Dados", preencha:
   ```
   URL do Backend: http://192.168.1.70:3000
   ```
4. Clique "Salvar ajustes"

---

## 🔧 O Que o Backend Precisa Responder:

### Endpoint 1: Salvar Operação
```
POST /api/operacoes
Content-Type: application/json

{
  "evento": "inicio" | "fechamento" | "problema" | "problema_resolvido",
  "record": { ...objeto completo da operação... }
}

Resposta esperada:
200 OK
{ "recebido": true }
```

### Endpoint 2: Consultar Operações em Aberto
```
GET /api/operacoes-abertas?trator=MT02

Resposta esperada (se houver operação aberta):
200 OK
{
  "trator": "MT02",
  "operador": "Dyego",
  "horaInicio": "14:32",
  "horimetro": 12450
}

Resposta esperada (se não houver):
200 OK
{}  ou null
```

---

## ✨ Pronto!

- ✅ App totalmente compatível (offline-first mantido)
- ✅ Sincronização automática com Backend
- ✅ Aviso de operações em aberto
- ✅ Sem quebrar Power Automate (fallback automático)
- ✅ Todos os dados do aparelho protegidos (localStorage)

Próximo passo: conectar o Backend real ao Banco de Dados PostgreSQL!
