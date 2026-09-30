const express = require('express');
const { getDb, HORAS, DIAS, iso, br, wrap } = require('../db');
const router = express.Router();

// segunda-feira da semana atual (+ offset semanas)
function segunda(offset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const w = d.getDay();
    d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w) + offset * 7);
    return d;
}

// data/hora válidos, dentro da grade e ainda no futuro?
function slotValido(data, hora) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !HORAS.includes(hora)) return false;
    const dia = new Date(data + 'T00:00:00');
    if (isNaN(dia) || dia.getDay() === 0) return false;
    return new Date(`${data}T${hora}:00`) > new Date();
}

const nomeDoDia = (data) => DIAS[new Date(data + 'T00:00:00').getDay() - 1];

async function capacidade(data, hora) {
    const dow = new Date(data + 'T00:00:00').getDay();
    const cfg = await getDb().collection('config').findOne({ diaSemana: dow, hora });
    return cfg ? cfg.capacidade : 0;
}

// ---------- calendário semanal ----------
router.get('/', wrap(async (req, res) => {
    const db = getDb();
    const semana = Math.max(0, parseInt(req.query.semana) || 0);
    const ini = segunda(semana);

    const dias = DIAS.map((nome, i) => {
        const d = new Date(ini);
        d.setDate(ini.getDate() + i);
        return { nome, data: iso(d), dataBR: br(iso(d)).slice(0, 5) };
    });

    const cfgs = await db.collection('config').find().toArray();
    const cap = {};
    cfgs.forEach((c) => (cap[`${c.diaSemana}_${c.hora}`] = c.capacidade));

    const ocup = {};
    const vs = await db.collection('vagas').find({ data: { $in: dias.map((d) => d.data) } }).toArray();
    vs.forEach((v) => (ocup[`${v.data}_${v.hora}`] = v.ocupadas));

    const agora = new Date();
    const linhas = HORAS.map((hora) => ({
        hora,
        celulas: dias.map((d, i) => {
            const vagas = (cap[`${i + 1}_${hora}`] || 0) - (ocup[`${d.data}_${hora}`] || 0);
            const futuro = new Date(`${d.data}T${hora}:00`) > agora;
            return { livre: vagas > 0 && futuro, data: d.data, hora, rotulo: vagas === 1 ? '1 vaga' : `${vagas} vagas` };
        }),
    }));

    res.render('home', { dias, linhas, temAnterior: semana > 0, anterior: semana - 1, proxima: semana + 1 });
}));

// ---------- formulário de agendamento ----------
router.get('/agendar', wrap(async (req, res) => {
    const { data, hora } = req.query;
    if (!slotValido(data, hora)) return res.status(400).render('resultado', { erro: 'Horário inválido ou já passou.' });
    const cap = await capacidade(data, hora);
    const v = await getDb().collection('vagas').findOne({ data, hora });
    if (cap - (v ? v.ocupadas : 0) <= 0) return res.render('resultado', { erro: 'Esse horário está esgotado.' });
    res.render('agendar', { data, hora, dataBR: br(data), diaNome: nomeDoDia(data) });
}));

// ---------- confirmar agendamento ----------
router.post('/agendar', wrap(async (req, res) => {
    const db = getDb();
    const { data, hora } = req.body;
    const nome = (req.body.nome || '').trim();
    const cpf = (req.body.cpf || '').replace(/\D/g, '');

    if (!slotValido(data, hora)) return res.status(400).render('resultado', { erro: 'Horário inválido ou já passou.' });

    if (!nome || cpf.length !== 11) {
        return res.status(400).render('agendar', {
            data, hora, dataBR: br(data), diaNome: nomeDoDia(data),
            nome, cpf: req.body.cpf, erro: 'Informe o nome e um CPF com 11 dígitos.',
        });
    }

    const cap = await capacidade(data, hora);
    if (cap < 1) return res.render('resultado', { erro: 'Não há atendimento nesse horário.' });

    if (await db.collection('agendamentos').findOne({ data, hora, cpf })) {
        return res.render('resultado', { erro: 'Esse CPF já tem agendamento neste horário.' });
    }

    // 1) Reserva atômica: só incrementa se ocupadas < capacidade.
    //    Se o slot já estiver cheio, o upsert tenta criar um documento duplicado
    //    e o índice único dispara o erro 11000.
    try {
        await db.collection('vagas').updateOne(
            { data, hora, ocupadas: { $lt: cap } },
            { $inc: { ocupadas: 1 } },
            { upsert: true }
        );
    } catch (e) {
        if (e.code === 11000) return res.render('resultado', { erro: 'Que pena, esse horário acabou de esgotar.' });
        throw e;
    }

    // 2) Registra cliente e agendamento (se falhar, devolve a vaga)
    try {
        const cliente = await db.collection('clientes').findOneAndUpdate(
            { cpf }, { $set: { nome } }, { upsert: true, returnDocument: 'after' }
        );
        await db.collection('agendamentos').insertOne({
            data, hora, clienteId: cliente._id, nome, cpf, criadoEm: new Date(),
        });
    } catch (e) {
        await db.collection('vagas').updateOne({ data, hora }, { $inc: { ocupadas: -1 } });
        throw e;
    }

    res.render('resultado', { ok: true, dataBR: br(data), hora, nome });
}));

module.exports = router;
