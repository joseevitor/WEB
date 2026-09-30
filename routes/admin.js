const express = require('express');
const { getDb, HORAS, DIAS, br, wrap } = require('../db');
const router = express.Router();

// ---------- configuração da agenda ----------
router.get('/ajustaPetAgenda', wrap(async (req, res) => {
    const cfgs = await getDb().collection('config').find().toArray();
    const m = {};
    cfgs.forEach((c) => (m[`${c.diaSemana}_${c.hora}`] = c.capacidade));

    const linhas = HORAS.map((hora) => ({
        hora,
        celulas: DIAS.map((_, i) => ({ nome: `c_${i + 1}_${hora}`, valor: m[`${i + 1}_${hora}`] || 0 })),
    }));
    res.render('ajustaPetAgenda', { dias: DIAS, linhas, salvo: req.query.salvo });
}));

router.post('/ajustaPetAgenda', wrap(async (req, res) => {
    const ops = [];
    DIAS.forEach((_, i) =>
        HORAS.forEach((hora) => {
            const v = Math.max(0, parseInt(req.body[`c_${i + 1}_${hora}`]) || 0);
            ops.push({ updateOne: { filter: { diaSemana: i + 1, hora }, update: { $set: { capacidade: v } }, upsert: true } });
        })
    );
    await getDb().collection('config').bulkWrite(ops);
    res.redirect('/ajustaPetAgenda?salvo=1');
}));

// ---------- lista de agendamentos ----------
router.get('/listaPetAgenda', wrap(async (req, res) => {
    const ags = await getDb().collection('agendamentos').find().sort({ data: 1, hora: 1 }).toArray();
    const rows = ags.map((a) => ({
        dataBR: br(a.data),
        hora: a.hora,
        nome: a.nome,
        cpf: a.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
    }));
    res.render('listaPetAgenda', { rows });
}));

module.exports = router;
