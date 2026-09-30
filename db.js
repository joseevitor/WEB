const { MongoClient } = require('mongodb');

const client = new MongoClient(
    process.env.MONGO_URL ||
    'mongodb+srv://josevitormiranda96_db_user:fBSCyt15N6Xopmpl@cluster0.xtjkpje.mongodb.net/?appName=Cluster0'
);
let db;

const HORAS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']; // diaSemana = índice + 1

async function connect() {
    await client.connect();
    db = client.db('petshop');
    // config: capacidade semanal por dia da semana + hora
    await db.collection('config').createIndex({ diaSemana: 1, hora: 1 }, { unique: true });
    // clientes: um por CPF
    await db.collection('clientes').createIndex({ cpf: 1 }, { unique: true });
    // vagas: contador de ocupação por data+hora (a reserva atômica depende deste índice único)
    await db.collection('vagas').createIndex({ data: 1, hora: 1 }, { unique: true });
    await db.collection('agendamentos').createIndex({ data: 1, hora: 1 });
}

const getDb = () => db;

// "2026-10-01" a partir de um Date local
const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// "2026-10-01" -> "01/10/2026"
const br = (s) => s.split('-').reverse().join('/');

// captura erros de funções async (Express 4 não faz isso sozinho)
const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        console.error(e);
        res.status(500).send('Erro interno no servidor.');
    });

module.exports = { connect, getDb, HORAS, DIAS, iso, br, wrap };